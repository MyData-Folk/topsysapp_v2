import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight,
  BarChart3, RefreshCw, Database, CalendarRange, AlertTriangle, Trash2, Users
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { AppConfig, HotelConfig } from '../types';
import { AuthState } from '../hooks/useAuth';
import { fetchSnapshotsForEvolution, SnapshotWithDays, DayAvailability, deleteSnapshot } from '../lib/availabilitiesStorage';
import { cn } from '../utils/cn';
import { logger } from '../utils/logger';

import { EvolutionState } from '../types';

interface EvolutionTabProps {
  config: AppConfig;
  hotel: HotelConfig | null;
  auth: AuthState;
  onShowToast: (msg: string, type?: 'ok' | 'error') => void;
  state: EvolutionState;
  onStateChange: (updates: EvolutionState | ((prev: EvolutionState) => EvolutionState)) => void;
}

const COLORS = ['#d4b162', '#60a5fa', '#34d399', '#f59e0b', '#ef4444', '#a78bfa', '#f472b6'];

// Format ISO YYYY-MM-DD → affichage court
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// Étiquette courte d'un snapshot pour les axes
function snapLabel(s: SnapshotWithDays) {
  return s.edition_date
    ? `Éd. ${s.edition_date}`
    : s.period_str
      ? s.period_str.replace(/^du\s+/i, '').slice(0, 14)
      : `Import ${new Date(s.import_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
}

// Étiquette détaillée
function snapFullLabel(s: SnapshotWithDays) {
  const edition = s.edition_date ? `Édition: ${s.edition_date}` : '';
  const period = s.period_str ? `Période: ${s.period_str}` : '';
  return [edition, period].filter(Boolean).join(' · ');
}

// Renvoie le min/max de date parmi tous les jours de snapshots chargés
function dateRangeOfSnaps(snaps: SnapshotWithDays[]): { min: string; max: string } | null {
  const all = snaps.flatMap(s => s.days.map(d => d.date));
  if (all.length === 0) return null;
  return { min: all.reduce((a, b) => (a < b ? a : b)), max: all.reduce((a, b) => (a > b ? a : b)) };
}

export function EvolutionTab({ config, hotel, auth, onShowToast, state, onStateChange }: EvolutionTabProps) {
  const { dateFrom, dateTo, selectedIds, comparisonIds, viewMode, snapshots } = state;

  const setDateFrom = (val: string) => onStateChange(prev => ({ ...prev, dateFrom: val }));
  const setDateTo = (val: string) => onStateChange(prev => ({ ...prev, dateTo: val }));
  const setSelectedIds = (val: Set<string>) => onStateChange(prev => ({ ...prev, selectedIds: val }));
  const setComparisonIds = (val: [string, string] | null) => onStateChange(prev => ({ ...prev, comparisonIds: val }));
  const setViewMode = (val: 'rate' | 'volume') => onStateChange(prev => ({ ...prev, viewMode: val }));
  const setSnapshots = (val: SnapshotWithDays[]) => onStateChange(prev => ({ ...prev, snapshots: val }));

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(snapshots.length > 0);

  // Refs pour éviter les boucles de chargement
  const isFetchingRef = useRef(false);
  const lastHotelIdRef = useRef<string | null>(snapshots.length > 0 ? hotel?.id || null : null);

  const canLoad = auth.user && hotel?.supabaseRegistered;

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!canLoad || !hotel || isFetchingRef.current) return;
    logger.info('Evolution', 'Démarrage chargement snapshots', { hotelId: hotel.id, dateFrom, dateTo });
    
    isFetchingRef.current = true;
    setLoading(true);
    try {
      let result = await fetchSnapshotsForEvolution(hotel.id, dateFrom, dateTo);
      
      // Dédoublonnage par date d'édition et hôtel
      const seen = new Set();
      result = result.filter(s => {
        const key = `${s.edition_date}-${s.hotel_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Tri chronologique croissant (le plus ancien en premier, le plus récent en dernier)
      result.sort((a, b) => {
        const dateA = a.edition_date || a.import_date;
        const dateB = b.edition_date || b.import_date;
        return dateA.localeCompare(dateB);
      });

      setSnapshots(result);
      setLoaded(true);
      logger.info('Evolution', `${result.length} snapshots chargés et traités`);

      // Par défaut, on sélectionne tout
      setSelectedIds(new Set(result.map(s => s.id)));
      
      // Références de comparaison : les deux plus récents
      if (result.length >= 2) {
        setComparisonIds([result[result.length - 2].id, result[result.length - 1].id]);
      } else {
        setComparisonIds(null);
      }

      if (result.length === 0) onShowToast('Aucun snapshot trouvé pour cette plage', 'error');
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur chargement', 'error');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, hotel?.id, dateFrom, dateTo]);

  // Gestion du cycle de vie des données (Reset sur changement d'hôtel + Chargement auto)
  useEffect(() => {
    if (!hotel?.id || !canLoad) return;

    // Si l'hôtel a réellement changé, on reset
    if (lastHotelIdRef.current !== hotel.id) {
      logger.debug('Evolution', 'Changement hôtel détecté, reset état', { from: lastHotelIdRef.current, to: hotel.id });
      lastHotelIdRef.current = hotel.id;
      setSnapshots([]);
      setLoaded(false);
      return; // On laisse le prochain cycle de render lancer le chargement via le bloc suivant
    }

    // Chargement si nécessaire
    if (!loaded && !loading && !isFetchingRef.current) {
      logger.debug('Evolution', 'Déclenchement chargement auto', { hotelId: hotel.id });
      load();
    }
  }, [canLoad, hotel?.id, loaded, loading, load]);

  // ── Données Filtrées/Sélectionnées ──────────────────────────────────────────
  
  // Calcul enrichi des snapshots pour éviter les calculs dans le render
  const enrichedSnaps = useMemo(() => {
    return snapshots.map(s => {
      const snapDates = s.days.map(d => d.date);
      const minD = snapDates[0] || '';
      const maxD = snapDates[snapDates.length - 1] || '';
      const coversRange = minD <= dateFrom && maxD >= dateTo;
      const overlapsAny = snapDates.some(d => d >= dateFrom && d <= dateTo);
      
      const hasRooms = s.days.some(d => 
        d.rooms && Object.keys(d.rooms).length > 0 &&
        Object.values(d.rooms).some(r => r.occupied > 0 || r.libres > 0)
      );

      return {
        ...s,
        minD,
        maxD,
        coversRange,
        overlapsAny,
        hasRooms,
        isSelected: selectedIds.has(s.id),
        label: snapLabel(s)
      };
    });
  }, [snapshots, selectedIds, dateFrom, dateTo]);

  const selectedSnaps = useMemo(() => 
    enrichedSnaps.filter(s => s.isSelected),
    [enrichedSnaps]
  );

  // 1. Évolution du taux moyen par snapshot (barre)
  const avgRateChart = useMemo(() =>
    selectedSnaps.map((s, i) => ({
      name: s.label,
      taux: Math.round(s.avgRate * 10) / 10,
      occupees: s.totalOcc,
      libres: s.totalLibres,
      color: COLORS[i % COLORS.length],
      snapshotId: s.id,
    })),
    [selectedSnaps]
  );

  // 2. Évolution jour par jour sur la plage — une courbe par snapshot
  const dailyChart = useMemo(() => {
    if (selectedSnaps.length === 0) return [];
    
    // Construire la liste de toutes les dates dans la plage de manière optimisée
    const datesSet = new Set<string>();
    selectedSnaps.forEach(s => s.days.forEach(d => datesSet.add(d.date)));
    const allDates = Array.from(datesSet).sort();

    return allDates.map(date => {
      const point: Record<string, number | string | null> = { 
        date: fmtDate(date), 
        dateISO: date 
      };
      selectedSnaps.forEach((s, i) => {
        const day = s.days.find(d => d.date === date);
        point[`snap_${i}`] = day != null ? Math.round(day.taux * 10) / 10 : null;
      });
      return point;
    });
  }, [selectedSnaps]);

  // 3. Variation jour par jour entre les deux snapshots de comparaison
  const deltaChart = useMemo(() => {
    if (!comparisonIds) return [];
    const first = enrichedSnaps.find(s => s.id === comparisonIds[0]);
    const last = enrichedSnaps.find(s => s.id === comparisonIds[1]);
    if (!first || !last || first.id === last.id) return [];

    const firstDaysMap = new Map(first.days.map(d => [d.date, d]));
    const lastDaysMap = new Map(last.days.map(d => [d.date, d]));
    
    const commonDates = Array.from(firstDaysMap.keys())
      .filter(d => lastDaysMap.has(d))
      .sort();

    return commonDates.map(date => {
      const d1 = firstDaysMap.get(date)!;
      const d2 = lastDaysMap.get(date)!;
      const delta = d2.taux - d1.taux;
      return {
        date: fmtDate(date),
        dateISO: date,
        delta: Math.round(delta * 10) / 10,
        deltaOcc: d2.occupied_total - d1.occupied_total,
        isPositive: delta >= 0,
      };
    });
  }, [enrichedSnaps, comparisonIds]);

  // 4. Évolution par type de chambre (tableau)
  const typeEvolution = useMemo(() => {
    if (selectedSnaps.length === 0 || !hotel) return [];
    return hotel.types.map(type => {
      const bySnap = selectedSnaps.map(s => {
        const days = s.days;
        const hasRooms = days.some(d => d.rooms[type.code] != null);
        const totalOcc = days.reduce((sum, d) => sum + (d.rooms[type.code]?.occupied ?? 0), 0);
        const totalCap = type.capacity * days.length;
        const rate = (hasRooms && totalCap > 0) ? (totalOcc / totalCap) * 100 : null;
        return {
          snapshotLabel: s.label,
          rate: rate != null ? Math.round(rate * 10) / 10 : null,
          occupied: totalOcc,
          incomplete: !hasRooms || (totalOcc === 0 && totalCap > 0), 
        };
      });

      const validForTrend = bySnap.filter(b => b.rate !== null && !b.incomplete);
      if (validForTrend.length === 0) return null;

      let diff = 0;
      if (comparisonIds) {
        const t1snap = enrichedSnaps.find(s => s.id === comparisonIds[0]);
        const t2snap = enrichedSnaps.find(s => s.id === comparisonIds[1]);
        if (t1snap && t2snap) {
          const da = t1snap.edition_date || t1snap.import_date || '';
          const db = t2snap.edition_date || t2snap.import_date || '';
          const older = da <= db ? t1snap : t2snap;
          const newer  = da <= db ? t2snap : t1snap;
          const olderMap = new Map(older.days.map(d => [d.date, d]));
          const newerMap  = new Map(newer.days.map(d => [d.date, d]));
          const common = Array.from(olderMap.keys()).filter(d => newerMap.has(d));
          if (common.length > 0) {
            const cap = type.capacity * common.length;
            const v1 = common.reduce((s, d) => s + (olderMap.get(d)!.rooms[type.code]?.occupied ?? 0), 0);
            const v2 = common.reduce((s, d) => s + (newerMap.get(d)!.rooms[type.code]?.occupied ?? 0), 0);
            
            if (viewMode === 'volume') {
              diff = v2 - v1;
            } else {
              const r1 = cap > 0 ? (v1 / cap) * 100 : 0;
              const r2 = cap > 0 ? (v2 / cap) * 100 : 0;
              diff = r2 - r1;
            }
          }
        }
      } else {
        const older = validForTrend[0];
        const newer = validForTrend[validForTrend.length - 1];
        if (viewMode === 'volume') {
          diff = (newer.occupied || 0) - (older.occupied || 0);
        } else {
          diff = (newer.rate || 0) - (older.rate || 0);
        }
      }

      return { type: type.label, code: type.code, bySnap, diff };
    }).filter(Boolean) as {
      type: string;
      code: string;
      bySnap: { snapshotLabel: string; rate: number | null; occupied: number; incomplete: boolean }[];
      diff: number;
    }[];
  }, [selectedSnaps, hotel.types, comparisonIds, enrichedSnaps, viewMode]);

  // 5. KPIs — calculés sur les DATES COMMUNES aux deux snapshots (évite le biais de plage)
  const kpis = useMemo(() => {
    if (!comparisonIds) return null;
    const s1 = enrichedSnaps.find(s => s.id === comparisonIds[0]);
    const s2 = enrichedSnaps.find(s => s.id === comparisonIds[1]);
    if (!s1 || !s2) return null;

    // Tri chronologique : first = le plus ancien, last = le plus récent
    const d1 = s1.edition_date || s1.import_date || '';
    const d2 = s2.edition_date || s2.import_date || '';
    const first = d1 <= d2 ? s1 : s2;
    const last  = d1 <= d2 ? s2 : s1;

    // ── Intersection des dates ────────────────────────────────────────────────
    // CRITIQUE : comparer sur la même période pour que taux et volume soient
    // cohérents entre eux. Sans ça, un snapshot couvrant plus de jours aura
    // mécaniquement un taux moyen plus bas même si les ventes progressent.
    const firstDaysMap = new Map(first.days.map(d => [d.date, d]));
    const lastDaysMap  = new Map(last.days.map(d =>  [d.date, d]));
    const commonDates  = Array.from(firstDaysMap.keys()).filter(d => lastDaysMap.has(d)).sort();

    if (commonDates.length === 0) {
      return {
        rateDiff: 0, occDiff: 0,
        firstRate: first.avgRate, lastRate: last.avgRate,
        firstOcc: first.totalOcc, lastOcc: last.totalOcc,
        firstLabel: first.label, lastLabel: last.label,
        occDiffByType: [], snapshotsCount: selectedSnaps.length,
        daysCount: last.days.length, commonDatesCount: 0, noCommonDates: true,
      };
    }

    const firstCommon = commonDates.map(d => firstDaysMap.get(d)!);
    const lastCommon  = commonDates.map(d => lastDaysMap.get(d)!);

    // Taux moyen sur dates communes
    const firstAvgRate = firstCommon.reduce((s, d) => s + d.taux, 0) / commonDates.length;
    const lastAvgRate  = lastCommon.reduce((s, d)  => s + d.taux, 0) / commonDates.length;

    // Volume de chambres vendues sur dates communes
    const firstTotalOcc = firstCommon.reduce((s, d) => s + d.occupied_total, 0);
    const lastTotalOcc  = lastCommon.reduce((s, d)  => s + d.occupied_total, 0);

    const rateDiff = lastAvgRate - firstAvgRate;
    const occDiff  = lastTotalOcc - firstTotalOcc;

    // Évolution par type sur dates communes
    const occDiffByType = hotel.types.map(type => {
      const v1 = firstCommon.reduce((sum, d) => sum + (d.rooms[type.code]?.occupied ?? 0), 0);
      const v2 = lastCommon.reduce((sum, d)  => sum + (d.rooms[type.code]?.occupied ?? 0), 0);
      return { label: type.label, code: type.code, diff: v2 - v1, v1, v2 };
    }).filter(d => d.v1 > 0 || d.v2 > 0);

    return {
      rateDiff,
      occDiff,
      firstRate: firstAvgRate,
      lastRate: lastAvgRate,
      firstOcc: firstTotalOcc,
      lastOcc: lastTotalOcc,
      firstLabel: first.label,
      lastLabel: last.label,
      occDiffByType,
      snapshotsCount: selectedSnaps.length,
      daysCount: last.days.length,
      commonDatesCount: commonDates.length,
      noCommonDates: false,
    };
  }, [enrichedSnaps, comparisonIds, hotel.types, selectedSnaps.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer (dépublier) ce rapport du Cloud ?')) return;
    try {
      await deleteSnapshot(id);
      onShowToast?.('Rapport supprimé avec succès', 'ok');
      load();
    } catch (err: any) {
      onShowToast?.(err.message, 'error');
    }
  };

  const dateRange = dateRangeOfSnaps(snapshots);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  if (!hotel) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div className="text-center py-24 opacity-60">
          <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={32} />
          </div>
          <h3 className="text-lg font-bold text-text mb-2">Mode Global Actif</h3>
          <p className="text-sm text-text-dim">Désactivez l'accès à tous les hôtels dans le sélecteur en haut pour accéder à l'évolution d'un établissement spécifique.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">

      {/* Header + contrôles */}
      <div className="bg-surf1 p-5 rounded-2xl border border-border space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-serif font-bold flex items-center gap-3">
              <BarChart3 size={22} className="text-gold" /> Évolution des disponibilités
            </h2>
            <p className="text-xs text-text-dark mt-1">
              Suivez l'évolution des réservations et annulations sur une plage de dates,
              snapshot par snapshot, pour <strong className="text-text">{hotel.name}</strong>.
            </p>
          </div>
        </div>

        {!auth.user ? (
          <div className="flex items-center gap-3 p-3 bg-amber/10 border border-amber/20 rounded-xl text-amber text-xs">
            <AlertTriangle size={15} className="shrink-0" />
            Connectez-vous dans l'onglet <strong>Cloud</strong> pour accéder à l'évolution depuis Supabase.
          </div>
        ) : !hotel.supabaseRegistered ? (
          <div className="flex items-center gap-3 p-3 bg-amber/10 border border-amber/20 rounded-xl text-amber text-xs">
            <AlertTriangle size={15} className="shrink-0" />
            Cet hôtel n'est pas enregistré dans Supabase. Allez dans <strong>Paramètres</strong> pour l'activer.
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[9px] font-bold text-text-dark uppercase tracking-widest">Du</label>
              <input
                type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-surf2 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[9px] font-bold text-text-dark uppercase tracking-widest">Au</label>
              <input
                type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-surf2 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-gold text-bg font-bold rounded-xl text-xs hover:bg-gold-light transition-all disabled:opacity-50 shrink-0"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                : <Database size={14} />}
              Charger
            </button>
            {loaded && (
              <button
                onClick={load}
                disabled={loading}
                className="p-2 text-text-dark hover:text-gold border border-border rounded-xl transition-all disabled:opacity-50 shrink-0"
                title="Rafraîchir"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={!loaded || snapshots.length < 1}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-surf2 border border-border text-text font-bold rounded-xl text-xs hover:border-gold/50 transition-all disabled:opacity-50 shrink-0"
            >
              <BarChart3 size={14} className="text-gold" />
              Rapport PDF
            </button>
          </div>
        )}

        {/* Liste des snapshots chargés — pour sélection et comparaison */}
        {loaded && snapshots.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest flex items-center gap-2">
                <Database size={12} className="text-gold" /> Rapports disponibles pour comparaison
              </h3>
              <div className="text-[9px] text-text-dim italic">
                Cochez pour inclure dans les graphiques · Sélectionnez les deux points (◯) pour calculer l'évolution
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {enrichedSnaps.map((s, idx) => {
                const isRef1 = comparisonIds?.[0] === s.id;
                const isRef2 = comparisonIds?.[1] === s.id;
                const isRef = isRef1 || isRef2;

                return (
                  <div 
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all select-none",
                      s.isSelected ? "bg-surf2 border-gold/30" : "bg-surf1 border-border opacity-50 grayscale",
                      isRef && "ring-1 ring-gold"
                    )}
                  >
                    <input 
                      type="checkbox"
                      checked={s.isSelected}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                        setSelectedIds(next);
                      }}
                      className="accent-gold cursor-pointer"
                    />
                    
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => {
                        // Toggle comparison ref
                        if (isRef1) {
                          if (comparisonIds) setComparisonIds([comparisonIds[1], s.id]); // Swap?
                        } else if (isRef2) {
                          // Already there
                        } else {
                          // Add as new last ref
                          if (comparisonIds) setComparisonIds([comparisonIds[1], s.id]);
                          else setComparisonIds([s.id, s.id]); // Should not happen
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold whitespace-nowrap">{s.label}</span>
                        {!s.coversRange && s.overlapsAny && (
                          <AlertTriangle size={12} className="text-amber" title="Couverture partielle des dates sélectionnées" />
                        )}
                        {!s.overlapsAny && (
                          <AlertTriangle size={12} className="text-red" title="Aucune date commune avec la plage sélectionnée" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border/50">
                      <button
                        title="Référence A (Ancien)"
                        onClick={() => setComparisonIds([s.id, comparisonIds?.[1] || s.id])}
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold transition-all",
                          isRef1 ? "bg-gold border-gold text-bg" : "border-border text-text-dim hover:border-gold"
                        )}
                      >
                        A
                      </button>
                      <button
                        title="Référence B (Récent)"
                        onClick={() => setComparisonIds([comparisonIds?.[0] || s.id, s.id])}
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold transition-all",
                          isRef2 ? "bg-gold border-gold text-bg" : "border-border text-text-dim hover:border-gold"
                        )}
                      >
                        B
                      </button>
                    </div>

                    <button 
                      onClick={() => handleDeleteSnapshot(s.id)}
                      className="p-1 text-text-dark hover:text-red transition-colors ml-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* État vide */}
      {loaded && snapshots.length === 0 && (
        <div className="bg-surf1 border border-border rounded-2xl p-12 text-center opacity-50">
          <CalendarRange size={48} className="mx-auto mb-4" />
          <p className="text-sm">Aucun snapshot trouvé pour cette plage.</p>
          <p className="text-xs text-text-dark mt-1">Publiez des disponibilités depuis l'onglet Analyse.</p>
        </div>
      )}

      {snapshots.length === 1 && (
        <div className="bg-amber/10 border border-amber/20 rounded-2xl p-6 text-center text-amber text-sm">
          Un seul snapshot sur cette plage — publiez un rapport plus récent pour voir l'évolution.
        </div>
      )}

      {snapshots.length >= 2 && kpis && (
        <>
          {/* Info plage de comparaison effective */}
          {dateRange && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-surf1 border border-border rounded-xl text-xs text-text-dark">
              <CalendarRange size={13} className="text-gold shrink-0" />
              <span>
                Plage effective : <strong className="text-text">{fmtDate(dateRange.min)}</strong> → <strong className="text-text">{fmtDate(dateRange.max)}</strong> ·{' '}
                <strong className="text-text">{kpis.snapshotsCount}</strong> snapshots ·{' '}
                <strong className={kpis.commonDatesCount > 0 ? "text-green" : "text-red"}>{kpis.commonDatesCount ?? kpis.daysCount}</strong> dates communes
                {kpis.commonDatesCount > 0 && <span className="text-text-dark/50 ml-1">(calculs sur cette intersection)</span>}
              </span>
            </div>
          )}

          {(kpis.noCommonDates || deltaChart.length === 0) && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red/10 border border-red/20 rounded-xl text-xs text-red">
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                <strong>Aucune date commune</strong> entre les deux rapports sélectionnés — les KPIs de comparaison ne peuvent pas être calculés. Sélectionnez deux rapports qui couvrent la même période.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. Variation Taux */}
            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                {kpis.rateDiff > 0
                  ? <ArrowUpRight size={18} className="text-green" />
                  : kpis.rateDiff < 0
                    ? <ArrowDownRight size={18} className="text-red" />
                    : <Minus size={18} className="text-text-dark" />}
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Variation Taux</span>
              </div>
              <div className={cn("text-3xl font-serif font-bold",
                kpis.rateDiff > 0 ? "text-green" : kpis.rateDiff < 0 ? "text-red" : "text-text-dim")}>
                {kpis.rateDiff > 0 ? '+' : ''}{kpis.rateDiff.toFixed(1)}%
              </div>
              <div className="text-[10px] text-text-dark mt-1 truncate">
                {kpis.firstRate.toFixed(1)}% → {kpis.lastRate.toFixed(1)}%
              </div>
            </div>

            {/* 2. Variation Volume */}
            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                {kpis.occDiff > 0
                  ? <TrendingUp size={18} className="text-green" />
                  : kpis.occDiff < 0
                    ? <TrendingDown size={18} className="text-red" />
                    : <Minus size={18} className="text-text-dark" />}
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Variation Volume</span>
              </div>
              <div className={cn("text-3xl font-serif font-bold",
                kpis.occDiff > 0 ? "text-green" : kpis.occDiff < 0 ? "text-red" : "text-text-dim")}>
                {kpis.occDiff > 0 ? '+' : ''}{kpis.occDiff.toLocaleString('fr')}
              </div>
              <div className="text-[10px] text-text-dark mt-1 truncate">
                {kpis.firstOcc.toLocaleString('fr')} → {kpis.lastOcc.toLocaleString('fr')}
              </div>
            </div>

            {/* 3. Détail par Type */}
            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-gold" />
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Détail par Type</span>
              </div>
              <div className="space-y-1.5 max-h-[60px] overflow-y-auto pr-2 custom-scrollbar">
                {kpis.occDiffByType.map(t => (
                  <div key={t.code} className="flex items-center justify-between text-[11px]">
                    <span className="text-text-dim truncate mr-2" title={t.label}>{t.label}</span>
                    <span className={cn("font-bold shrink-0", t.diff > 0 ? "text-green" : t.diff < 0 ? "text-red" : "text-text-dim")}>
                      {t.diff > 0 ? '+' : ''}{t.diff}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Infos Comparaison */}
            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={18} className="text-blue" />
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Comparaison</span>
              </div>
              <div className="text-xl font-bold text-text truncate mb-1">
                {kpis.lastLabel}
              </div>
              <div className="text-[10px] text-text-dark truncate">
                vs {kpis.firstLabel}
              </div>
              <div className="mt-2 text-[10px] bg-blue/10 text-blue px-2 py-0.5 rounded-full inline-block">
                {kpis.snapshotsCount} snapshots analysés
              </div>
            </div>
          </div>

          {/* Taux moyen par snapshot */}
          <div className="bg-surf1 border border-border p-5 rounded-2xl overflow-x-auto custom-scrollbar">
            <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-5 flex items-center gap-2">
              <TrendingUp size={12} className="text-gold" /> Taux d'occupation moyen par snapshot
            </h3>
            <div className="h-[260px] min-w-[420px] relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={avgRateChart} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--theme-text-dark)', fontSize: 9 }} interval={0} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }} domain={[0, 100]}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--theme-surf1)', border: '1px solid var(--theme-border)', borderRadius: '12px' }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'Taux moyen']}
                    labelStyle={{ color: 'var(--theme-text-dim)', fontSize: '10px' }}
                  />
                  <Bar dataKey="taux" radius={[6, 6, 0, 0]} name="Taux moyen %"
                    fill="var(--theme-gold)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Courbes journalières superposées */}
          <div className="bg-surf1 border border-border p-5 rounded-2xl overflow-x-auto custom-scrollbar">
            <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-5 flex items-center gap-2">
              <TrendingUp size={12} className="text-blue" /> Taux journalier par snapshot (superposition)
            </h3>
            <div className="h-[280px] min-w-[500px] relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--theme-text-dark)', fontSize: 9 }}
                    interval={Math.floor(dailyChart.length / 8)} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }} domain={[0, 100]}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--theme-surf1)', border: '1px solid var(--theme-border)', borderRadius: '12px' }}
                    formatter={(v: number, key: string) => {
                      const idx = parseInt(key.replace('snap_', ''));
                      return [`${v.toFixed(1)}%`, snapLabel(snapshots[idx]) || key];
                    }}
                    labelStyle={{ color: 'var(--theme-text-dim)', fontSize: '10px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }}
                    formatter={(key: string) => {
                      const idx = parseInt(key.replace('snap_', ''));
                      return snapLabel(snapshots[idx]) || key;
                    }} />
                  {snapshots.map((_, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`snap_${i}`}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={i === snapshots.length - 1 ? 2.5 : 1.5}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Suppression du graphique de variation journalière car non pertinent pour le client */}

          {/* Évolution par type de chambre */}
          {typeEvolution.length > 0 && (
            <div className="bg-surf1 border border-border p-5 rounded-2xl overflow-x-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest">
                  Évolution par type de chambre
                </h3>
                
                <div className="flex items-center gap-4">
                  {enrichedSnaps.some(s => !s.hasRooms) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber shrink-0">
                      <AlertTriangle size={11} />
                      <span className="hidden sm:inline">Snapshots incomplets <strong>⚠</strong></span>
                    </div>
                  )}

                  <div className="flex bg-surf2 p-0.5 rounded-lg border border-border">
                    <button
                      onClick={() => setViewMode('rate')}
                      className={cn(
                        "px-2 py-1 text-[9px] font-bold rounded-md transition-all",
                        viewMode === 'rate' ? "bg-gold text-bg shadow-sm" : "text-text-dark hover:text-text"
                      )}
                    >
                      Taux (%)
                    </button>
                    <button
                      onClick={() => setViewMode('volume')}
                      className={cn(
                        "px-2 py-1 text-[9px] font-bold rounded-md transition-all",
                        viewMode === 'volume' ? "bg-gold text-bg shadow-sm" : "text-text-dark hover:text-text"
                      )}
                    >
                      Volume (N)
                    </button>
                  </div>
                </div>
              </div>
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-border text-text-dark">
                    <th className="text-left p-3 font-bold uppercase text-[10px]">Type</th>
                    {selectedSnaps.map((s, i) => {
                      const incomplete = !s.hasRooms;
                      return (
                        <th key={s.id} className={cn("p-3 text-center font-bold text-[10px]", incomplete && "opacity-50 group/snap relative")}>
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="truncate max-w-[100px]">{s.label}</span>
                              {incomplete && <span className="text-amber" title="Snapshot sans données de rooms">⚠</span>}
                            </div>
                            <span className="text-[8px] text-text-dark font-normal opacity-70">
                              {s.period_str ? s.period_str.replace(/^du\s+/i, '') : ''}
                            </span>
                          </div>
                          
                          {/* Bouton de suppression au survol */}
                          <button
                            onClick={() => handleDeleteSnapshot(s.id)}
                            className="absolute -top-1 -right-1 p-1 bg-red/10 text-red rounded-md opacity-0 group-hover/snap:opacity-100 transition-opacity hover:bg-red/20"
                            title="Supprimer ce snapshot du Cloud"
                          >
                            <Trash2 size={10} />
                          </button>
                        </th>
                      );
                    })}
                    <th className="p-3 text-center font-bold text-[10px]">Tendance</th>
                  </tr>
                </thead>
                <tbody>
                  {typeEvolution.map(te => (
                    <tr key={te.code} className="border-b border-border/50 hover:bg-surf2/50">
                      <td className="p-3 font-bold text-text">{te.type}</td>
                      {te.bySnap.map((b, i) => (
                        <td key={i} className={cn("p-3 text-center font-mono", b.incomplete ? "text-text-dark/30" : "text-text-dim")}>
                          {b.rate != null 
                            ? (viewMode === 'rate' ? `${b.rate.toFixed(1)}%` : b.occupied) 
                            : '—'}
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <div className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px]",
                          te.diff > 0 ? "bg-green/10 text-green" : te.diff < 0 ? "bg-red/10 text-red" : "bg-surf2 text-text-dark"
                        )}>
                          {te.diff > 0 ? <ArrowUpRight size={10} /> : te.diff < 0 ? <ArrowDownRight size={10} /> : null}
                          {te.diff > 0 ? '+' : ''}{viewMode === 'rate' ? `${te.diff.toFixed(1)}%` : te.diff}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surf2/30 font-bold border-t-2 border-border">
                  <tr>
                    <td className="p-3 text-text uppercase text-[10px] tracking-wider">Total (Global)</td>
                    {selectedSnaps.map((s, i) => (
                      <td key={s.id} className="p-3 text-center font-mono text-text">
                        {Math.round(s.avgRate * 10) / 10}%
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      {kpis && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm",
                          kpis.rateDiff > 1 ? "bg-green text-bg" : kpis.rateDiff < -1 ? "bg-red text-bg" : "bg-gold text-bg"
                        )}>
                          {kpis.rateDiff > 0 ? <TrendingUp size={12} /> : kpis.rateDiff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                          {kpis.rateDiff > 0 ? '+' : ''}{kpis.rateDiff.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* État initial avant premier chargement */}
      {!loaded && canLoad && !loading && (
        <div className="text-center py-20 opacity-40">
          <Database size={56} className="mx-auto mb-4" />
          <p className="text-sm">Sélectionnez une plage de dates et cliquez sur <strong>Charger</strong>.</p>
        </div>
      )}
    </div>
  );
}
