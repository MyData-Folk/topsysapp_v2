import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight,
  BarChart3, RefreshCw, Database, CalendarRange, AlertTriangle, Trash2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { AppConfig, HotelConfig } from '../types';
import { AuthState } from '../hooks/useAuth';
import { fetchSnapshotsForEvolution, SnapshotWithDays, DayAvailability, dateRangeOfSnaps, deleteSnapshot } from '../lib/availabilitiesStorage';
import { cn } from '../utils/cn';

interface EvolutionTabProps {
  config: AppConfig;
  hotel: HotelConfig;
  auth: AuthState;
  onShowToast: (msg: string, type?: 'ok' | 'error') => void;
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

export function EvolutionTab({ config, hotel, auth, onShowToast }: EvolutionTabProps) {
  // ── État ────────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(thirtyDaysLater);
  const [snapshots, setSnapshots] = useState<SnapshotWithDays[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const canLoad = auth.user && hotel.supabaseRegistered;

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      let result = await fetchSnapshotsForEvolution(hotel.id, dateFrom, dateTo);
      
      // Dédoublonnage par date d'édition et hôtel
      const seen = new Set();
      result = result.filter(s => {
        const key = `${s.edition_date}-${s.establishment_name}`;
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
      if (result.length === 0) onShowToast('Aucun snapshot trouvé pour cette plage', 'error');
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [canLoad, hotel.id, dateFrom, dateTo]);

  // Recharger automatiquement si hôtel change
  useEffect(() => {
    if (loaded) {
      setSnapshots([]);
      setLoaded(false);
    }
  }, [hotel.id]);

  // ── Données pour les graphiques ──────────────────────────────────────────────

  // 1. Évolution du taux moyen par snapshot (barre)
  const avgRateChart = useMemo(() =>
    snapshots.map((s, i) => ({
      name: snapLabel(s),
      taux: Math.round(s.avgRate * 10) / 10,
      occupees: s.totalOcc,
      libres: s.totalLibres,
      color: COLORS[i % COLORS.length],
      snapshotId: s.id,
    })),
    [snapshots]
  );

  // 2. Évolution jour par jour sur la plage — une courbe par snapshot
  const dailyChart = useMemo(() => {
    if (snapshots.length === 0) return [];
    // Construire la liste de toutes les dates dans la plage
    const datesSet = new Set<string>();
    snapshots.forEach(s => (s.days as DayAvailability[]).forEach(d => datesSet.add(d.date)));
    const allDates: string[] = Array.from(datesSet).sort();

    return allDates.map(date => {
      const point: Record<string, number | string | null> = { date: fmtDate(date), dateISO: date };
      snapshots.forEach((s, i) => {
        const day = s.days.find(d => d.date === date);
        point[`snap_${i}`] = day != null ? Math.round(day.taux * 10) / 10 : null;
      });
      return point;
    });
  }, [snapshots]);

  // 3. Variation jour par jour entre le premier et le dernier snapshot
  const deltaChart = useMemo(() => {
    if (snapshots.length < 2) return [];
    // Utilise les snapshots avec des données d'occupation réelles (capacite > 0)
    const validSnaps = snapshots.filter(s =>
      (s.days as DayAvailability[]).some(d => d.capacite > 0 && d.libres_total < d.capacite)
    );
    const list = validSnaps.length >= 2 ? validSnaps : snapshots;
    const first = list[0];
    const last = list[list.length - 1];
    if (first.id === last.id) return [];
    const firstDates = new Set(first.days.map(d => d.date));
    const lastDates = new Set(last.days.map(d => d.date));
    const commonDates = Array.from(firstDates).filter(d => lastDates.has(d)).sort();

    if (commonDates.length === 0) return [];
    const dates = commonDates;

    return dates.map(date => {
      const d1 = first.days.find(d => d.date === date);
      const d2 = last.days.find(d => d.date === date);
      if (!d1 || !d2) return null;
      const delta = d2.taux - d1.taux;
      const deltaOcc = d2.occupied_total - d1.occupied_total;
      return {
        date: fmtDate(date),
        dateISO: date,
        delta: Math.round(delta * 10) / 10,
        deltaOcc,
        isPositive: delta >= 0,
      };
    }).filter(Boolean) as {
      date: string; dateISO: string; delta: number; deltaOcc: number; isPositive: boolean
    }[];
  }, [snapshots]);

  // Détecte si un snapshot a des données de rooms valides pour au moins un type
  const hasRoomsData = useCallback((s: SnapshotWithDays) =>
    (s.days as DayAvailability[]).some(d =>
      d.rooms && Object.keys(d.rooms).length > 0 &&
      Object.values(d.rooms).some(r => r.occupied > 0 || r.libres > 0)
    ),
  []);

  // 4. Évolution par type de chambre (tableau)
  const typeEvolution = useMemo(() => {
    if (snapshots.length === 0) return [];
    return hotel.types.map(type => {
      const bySnap = snapshots.map(s => {
        const days = s.days as DayAvailability[];
        const hasRooms = days.some(d => d.rooms[type.code] != null);
        const totalOcc = days.reduce((sum, d) => sum + (d.rooms[type.code]?.occupied ?? 0), 0);
        const totalCap = type.capacity * days.length;
        const rate = (hasRooms && totalCap > 0) ? (totalOcc / totalCap) * 100 : null;
        return {
          snapshotLabel: snapLabel(s),
          rate: rate != null ? Math.round(rate * 10) / 10 : null,
          incomplete: !hasRooms || totalOcc === 0, // Considérer incomplet si 0 occupation totale (évite le décalage)
        };
      });
      const validForTrend = bySnap.filter(b => b.rate !== null && !b.incomplete);
      if (validForTrend.length === 0) return null;

      // Tendance : premier snapshot complet → dernier snapshot complet
      const firstValid = validForTrend[0].rate!;
      const lastValid = validForTrend[validForTrend.length - 1].rate!;
      return {
        type: type.label,
        code: type.code,
        bySnap,
        diff: lastValid - firstValid, // Récent - Ancien (sur base complète)
      };
    }).filter(Boolean) as {
      type: string;
      code: string;
      bySnap: { snapshotLabel: string; rate: number | null; incomplete: boolean }[];
      diff: number;
    }[];
  }, [snapshots, hotel.types]);

  // 5. KPIs — utilise les snapshots avec données valides (taux > 0 ou libres < capacite)
  const kpis = useMemo(() => {
    if (snapshots.length < 2) return null;
    const valid = snapshots.filter(s =>
      (s.days as DayAvailability[]).some(d => d.capacite > 0 && d.libres_total < d.capacite)
    );
    // Fallback sur toute la liste si aucun valide détecté
    const list = valid.length >= 2 ? valid : snapshots;
    const first = list[0];
    const last = list[list.length - 1];
    return {
      rateDiff: last.avgRate - first.avgRate, // Récent - Ancien
      occDiff: last.totalOcc - first.totalOcc,
      libresDiff: last.totalLibres - first.totalLibres,
      firstRate: first.avgRate,
      lastRate: last.avgRate,
      firstOcc: first.totalOcc,
      lastOcc: last.totalOcc,
      firstLabel: snapLabel(first),
      lastLabel: snapLabel(last),
      snapshotsCount: snapshots.length,
      validCount: list.length,
      daysCount: first.days.length,
    };
  }, [snapshots]);

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer (dépublier) ce rapport du Cloud ?')) return;
    try {
      await deleteSnapshot(id);
      onShowToast?.('Rapport supprimé avec succès', 'ok');
      handleRefresh();
    } catch (err: any) {
      onShowToast?.(err.message, 'error');
    }
  };

  const dateRange = dateRangeOfSnaps(snapshots);

  // ── Rendu ───────────────────────────────────────────────────────────────────
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
          {/* Info plage effective */}
          {dateRange && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-surf1 border border-border rounded-xl text-xs text-text-dark">
              <CalendarRange size={13} className="text-gold shrink-0" />
              <span>
                Plage effective : <strong className="text-text">{fmtDate(dateRange.min)}</strong> → <strong className="text-text">{fmtDate(dateRange.max)}</strong> ·{' '}
                <strong className="text-text">{kpis.snapshotsCount}</strong> snapshots ·{' '}
                <strong className="text-text">{kpis.daysCount}</strong> jours communs
              </span>
            </div>
          )}

          {snapshots.length >= 2 && deltaChart.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red/10 border border-red/20 rounded-xl text-xs text-red">
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                <strong>Attention :</strong> Les snapshots sélectionnés n'ont aucune date en commun et ne peuvent pas être comparés pour le calcul du delta.
              </span>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                {kpis.rateDiff > 0
                  ? <ArrowUpRight size={18} className="text-green" />
                  : kpis.rateDiff < 0
                    ? <ArrowDownRight size={18} className="text-red" />
                    : <Minus size={18} className="text-text-dark" />}
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Variation taux</span>
              </div>
              <div className={cn("text-3xl font-serif font-bold",
                kpis.rateDiff > 0 ? "text-green" : kpis.rateDiff < 0 ? "text-red" : "text-text-dim")}>
                {kpis.rateDiff > 0 ? '+' : ''}{kpis.rateDiff.toFixed(1)}%
              </div>
              <div className="text-[10px] text-text-dark mt-1 truncate">
                {kpis.firstRate.toFixed(1)}% → {kpis.lastRate.toFixed(1)}%
              </div>
            </div>

            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                {kpis.occDiff > 0
                  ? <TrendingUp size={18} className="text-green" />
                  : <TrendingDown size={18} className="text-red" />}
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Nuitées vendues</span>
              </div>
              <div className={cn("text-3xl font-serif font-bold", kpis.occDiff >= 0 ? "text-green" : "text-red")}>
                {kpis.occDiff > 0 ? '+' : ''}{kpis.occDiff.toLocaleString('fr')}
              </div>
              <div className="text-[10px] text-text-dark mt-1">
                {kpis.firstOcc.toLocaleString('fr')} → {kpis.lastOcc.toLocaleString('fr')}
              </div>
            </div>

            <div className="p-5 bg-surf1 border border-border rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={18} className="text-blue" />
                <span className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Snapshots</span>
              </div>
              <div className="text-3xl font-serif font-bold text-blue">{kpis.snapshotsCount}</div>
              <div className="text-[10px] text-text-dark mt-1 truncate">
                {kpis.firstLabel} → {kpis.lastLabel}
              </div>
            </div>
          </div>

          {/* Taux moyen par snapshot */}
          <div className="bg-surf1 border border-border p-5 rounded-2xl overflow-x-auto custom-scrollbar">
            <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-5 flex items-center gap-2">
              <TrendingUp size={12} className="text-gold" /> Taux d'occupation moyen par snapshot
            </h3>
            <div className="h-[260px] min-w-[420px]">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-[280px] min-w-[500px]">
              <ResponsiveContainer width="100%" height="100%">
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

          {/* Delta jour par jour entre premier et dernier snapshot */}
          {deltaChart.length > 0 && (
            <div className="bg-surf1 border border-border p-5 rounded-2xl overflow-x-auto custom-scrollbar">
              <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-1 flex items-center gap-2">
                <BarChart3 size={12} className="text-amber" /> Variation journalière (dernier vs premier snapshot)
              </h3>
              <p className="text-[10px] text-text-dark mb-5">
                Positif = des chambres supplémentaires ont été réservées · Négatif = des annulations
              </p>
              <div className="h-[240px] min-w-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deltaChart} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" vertical={false} />
                    <ReferenceLine y={0} stroke="var(--theme-border)" strokeWidth={1.5} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                      tick={{ fill: 'var(--theme-text-dark)', fontSize: 9 }}
                      interval={Math.floor(deltaChart.length / 8)} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }}
                      tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--theme-surf1)', border: '1px solid var(--theme-border)', borderRadius: '12px' }}
                      formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(1)}%`, 'Variation Taux']}
                      labelStyle={{ color: 'var(--theme-text-dim)', fontSize: '10px' }}
                    />
                    <Bar dataKey="delta" radius={[4, 4, 0, 0]} name="Δ Taux"
                      fill="var(--theme-gold)"
                      // Vert si positif, rouge si négatif via Cell
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Évolution par type de chambre */}
          {typeEvolution.length > 0 && (
            <div className="bg-surf1 border border-border p-5 rounded-2xl overflow-x-auto custom-scrollbar">
              <div className="flex items-start justify-between gap-3 mb-5">
                <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest">
                  Évolution par type de chambre
                </h3>
                {snapshots.some(s => !hasRoomsData(s)) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber shrink-0">
                    <AlertTriangle size={11} />
                    Les colonnes marquées <strong>⚠</strong> n'ont pas de données par type — snapshot incomplet.
                  </div>
                )}
              </div>
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-border text-text-dark">
                    <th className="text-left p-3 font-bold uppercase text-[10px]">Type</th>
                    {snapshots.map((s, i) => {
                      const incomplete = !hasRoomsData(s);
                      return (
                        <th key={s.id} className={cn("p-3 text-center font-bold text-[10px]", incomplete && "opacity-50 group/snap relative")}>
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="truncate max-w-[100px]">{snapLabel(s)}</span>
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
                          {b.rate != null ? `${b.rate.toFixed(1)}%` : '—'}
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                          te.diff > 2 ? "bg-green/10 text-green" : te.diff < -2 ? "bg-red/10 text-red" : "bg-surf3 text-text-dark"
                        )}>
                          {te.diff > 0 ? <ArrowUpRight size={10} /> : te.diff < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                          {te.diff > 0 ? '+' : ''}{te.diff.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
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
