import { supabase } from './supabaseClient'
import { OccupancyData, HotelConfig } from '../types'

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré — ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local')
  return supabase
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SnapshotMeta {
  id: string
  hotel_id: string
  import_date: string
  edition_date: string
  period_str: string
  filename: string
  days_count: number
  created_by: string
}

// ── Hôtels ───────────────────────────────────────────────────────────────────

export async function registerHotel(hotel: HotelConfig): Promise<void> {
  const client = requireClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const { error } = await client
    .from('hotels')
    .upsert(
      {
        id:             hotel.id,
        owner_id:       user.id,
        name:           hotel.name,
        address:        hotel.address,
        reference:      hotel.reference,
        total_capacity: hotel.totalCapacity,
        types:          hotel.types,
      },
      { onConflict: 'id' }
    )

  if (error) throw new Error(`Erreur enregistrement hôtel : ${error.message}`)
}

export async function isHotelRegistered(hotelId: string): Promise<boolean> {
  const client = requireClient()
  const { data, error } = await client
    .from('hotels')
    .select('id')
    .eq('id', hotelId)
    .maybeSingle()

  if (error) throw new Error(`Erreur vérification hôtel : ${error.message}`)
  return data !== null
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export async function listSnapshots(hotelId: string): Promise<SnapshotMeta[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('availability_snapshots')
    .select('id, hotel_id, import_date, edition_date, period_str, filename, days_count, created_by')
    .eq('hotel_id', hotelId)
    .order('import_date', { ascending: false })

  if (error) throw new Error(`Erreur listage snapshots : ${error.message}`)
  return (data ?? []) as SnapshotMeta[]
}

// ── Push disponibilités ──────────────────────────────────────────────────────

export async function pushAvailabilities(
  report: OccupancyData,
  hotel: HotelConfig,
): Promise<string> {
  const client = requireClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Non connecté')

  // 1. S'assurer que l'hôtel est enregistré
  await registerHotel(hotel)

  // 2. Créer le snapshot
  const { data: snap, error: snapErr } = await client
    .from('availability_snapshots')
    .insert({
      hotel_id:     hotel.id,
      created_by:   user.id,
      edition_date: report.editionDate || '',
      period_str:   report.periodStr   || '',
      filename:     report.fileName    || '',
      days_count:   report.daysCount,
    })
    .select('id')
    .single()

  if (snapErr || !snap) throw new Error(`Erreur création snapshot : ${snapErr?.message}`)
  const snapshotId = snap.id

  // 3. Construire les lignes de disponibilités
  const rows = []
  for (let i = 0; i < report.daysCount; i++) {
    const dl = report.dateLabels[i]
    if (!dl?.date) continue

    const rooms: Record<string, { occupied: number; libres: number }> = {}
    for (const type of hotel.types) {
      rooms[type.code] = {
        occupied: report.occupied[type.code]?.[i]  ?? 0,
        libres:   report.libresType[type.code]?.[i] ?? 0,
      }
    }

    rows.push({
      snapshot_id:  snapshotId,
      hotel_id:     hotel.id,
      date:         dl.date.toISOString().split('T')[0],
      libres_total: report.libresTotal[i]  ?? 0,
      capacite:     report.capaciteDay[i]  ?? 0,
      prix:         report.prices[i]       ?? 0,
      rooms,
    })
  }

  if (rows.length === 0) throw new Error('Aucune date valide dans le rapport')

  // 4. Insérer par lots de 200 pour éviter les limites de payload
  const BATCH = 200
  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const { error: insertErr } = await client
      .from('availabilities')
      .insert(rows.slice(offset, offset + BATCH))
    if (insertErr) throw new Error(`Erreur insertion disponibilités : ${insertErr.message}`)
  }

  return snapshotId
}

// ── Évolution — requêtes pour l'onglet Évolution ─────────────────────────────

export interface DayAvailability {
  date: string
  libres_total: number
  capacite: number
  prix: number
  rooms: Record<string, { occupied: number; libres: number }>
  taux: number
  occupied_total: number
}

export interface SnapshotWithDays extends SnapshotMeta {
  days: DayAvailability[]
  avgRate: number
  totalOcc: number
  totalLibres: number
}

function enrichDay(row: {
  date: string; libres_total: number; capacite: number; prix: number;
  rooms: Record<string, { occupied: number; libres: number }>
}): DayAvailability {
  const occupied_total = row.capacite - row.libres_total
  const taux = row.capacite > 0 ? (occupied_total / row.capacite) * 100 : 0
  return { ...row, occupied_total, taux }
}

function aggregateSnap(snap: SnapshotMeta, days: DayAvailability[]): SnapshotWithDays {
  const totalOcc = days.reduce((s, d) => s + d.occupied_total, 0)
  const totalLibres = days.reduce((s, d) => s + d.libres_total, 0)
  const avgRate = days.length > 0
    ? days.reduce((s, d) => s + d.taux, 0) / days.length
    : 0
  return { ...snap, days, avgRate, totalOcc, totalLibres }
}

/**
 * Charge tous les snapshots d'un hôtel sur une plage de dates,
 * triés par date d'édition du rapport (edition_date) puis par import_date.
 * Chaque snapshot ne contient que les jours dans la plage [dateFrom, dateTo].
 */
export async function fetchSnapshotsForEvolution(
  hotelId: string,
  dateFrom: string,   // 'YYYY-MM-DD'
  dateTo: string,     // 'YYYY-MM-DD'
): Promise<SnapshotWithDays[]> {
  const client = requireClient()

  // 1. Tous les snapshots de l'hôtel qui couvrent la plage
  const { data: snaps, error: snapErr } = await client
    .from('availability_snapshots')
    .select('id, hotel_id, import_date, edition_date, period_str, filename, days_count, created_by')
    .eq('hotel_id', hotelId)
    .order('edition_date', { ascending: true })
    .order('import_date', { ascending: true })

  if (snapErr) throw new Error(`Erreur chargement snapshots : ${snapErr.message}`)
  if (!snaps || snaps.length === 0) return []

  const snapIds = snaps.map(s => s.id)

  // 2. Toutes les lignes de disponibilités pour ces snapshots sur la plage
  const { data: rows, error: rowErr } = await client
    .from('availabilities')
    .select('snapshot_id, date, libres_total, capacite, prix, rooms')
    .in('snapshot_id', snapIds)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true })

  if (rowErr) throw new Error(`Erreur chargement disponibilités : ${rowErr.message}`)

  // 3. Grouper les lignes par snapshot_id
  const bySnap = new Map<string, DayAvailability[]>()
  for (const row of rows ?? []) {
    const day = enrichDay(row as any)
    if (!bySnap.has(row.snapshot_id)) bySnap.set(row.snapshot_id, [])
    bySnap.get(row.snapshot_id)!.push(day)
  }

  // 4. Ne garder que les snapshots qui ont des données sur la plage
  return snaps
    .filter(s => (bySnap.get(s.id)?.length ?? 0) > 0)
    .map(s => aggregateSnap(s as SnapshotMeta, bySnap.get(s.id) ?? []))
}

/**
 * Pour une date précise, retourne l'évolution des disponibilités
 * à travers tous les snapshots (un point par snapshot/rapport).
 */
export async function fetchDayEvolution(
  hotelId: string,
  date: string,  // 'YYYY-MM-DD'
): Promise<{ snapshot: SnapshotMeta; day: DayAvailability }[]> {
  const client = requireClient()

  const { data, error } = await client
    .from('availabilities')
    .select(`
      date, libres_total, capacite, prix, rooms,
      availability_snapshots!inner(
        id, hotel_id, import_date, edition_date, period_str, filename, days_count, created_by
      )
    `)
    .eq('hotel_id', hotelId)
    .eq('date', date)
    .order('availability_snapshots(edition_date)', { ascending: true })
    .order('availability_snapshots(import_date)', { ascending: true })

  if (error) throw new Error(`Erreur évolution journée : ${error.message}`)

  return (data ?? []).map((row: any) => ({
    snapshot: row.availability_snapshots as SnapshotMeta,
    day: enrichDay(row),
  }))
}
