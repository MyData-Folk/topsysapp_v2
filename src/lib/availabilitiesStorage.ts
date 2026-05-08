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
