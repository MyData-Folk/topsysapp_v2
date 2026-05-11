import React, { useCallback, useState, useEffect } from 'react';
import { FileUp, AlertCircle, Calendar, Trash2, Download, Cloud, RefreshCw, Eye, X, Search, History } from 'lucide-react';
import { OccupancyData, AppConfig, HotelConfig } from '../types';
import { parseTopsysPdf, detectEstablishmentName } from '../lib/pdfParser';
import { cn } from '../utils/cn';
import { hydrateReport } from '../utils/helpers';
import { DEFAULT_HOTEL } from '../utils/constants';
import { AuthState } from '../hooks/useAuth';
import { listReports, downloadReport, generateReportFilename, CloudReportMeta } from '../lib/supabaseStorage';
import { logger } from '../utils/logger';

// Normalise un nom d'hôtel pour la comparaison floue (accents, casse, caractères spéciaux)
function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hotelMatchesReport(hotel: HotelConfig, reportName: string | undefined, filename?: string): boolean {
  const h = normalizeName(hotel.name);
  const alias = normalizeName(hotel.cloudAlias || '');
  const r = normalizeName(reportName || '');
  const f = normalizeName(filename || '');
  
  if (!h && !alias) return true; // Si rien n'est configuré, on ne bloque pas
  
  // 1. Correspondance exacte ou inclusion totale (Nom ou Alias ou Fichier)
  if (r && (h === r || h.includes(r) || r.includes(h))) return true;
  if (alias && r && (alias === r || alias.includes(r) || r.includes(alias))) return true;
  if (f && (f.includes(h) || h.includes(f))) return true;
  if (alias && f && f.includes(alias)) return true;
  
  // 2. Intersection de mots significatifs
  const hWords = h.split(' ').filter(w => w.length >= 3);
  const aWords = alias.split(' ').filter(w => w.length >= 3);
  const words = [...new Set([...hWords, ...aWords])];
  
  if (words.length === 0) return true; 

  // Si l'un des mots de l'hôtel/alias est dans le nom du rapport ou le fichier
  return words.some(w => r.includes(w) || f.includes(w));
}

interface ImportTabProps {
  config: AppConfig;
  activeHotel: HotelConfig | null;
  reports: OccupancyData[];
  selectedReportId: string | null;
  isLoading: boolean;
  error: string | null;
  onAddReport: (r: OccupancyData) => boolean;
  onDeleteReport: (id: string) => void;
  onSelectReport: (id: string) => void;
  onStorePdf: (id: string, file: File) => void;
  onSwitchToAnalyse: () => void;
  onSetLoading: (v: boolean) => void;
  onSetError: (e: string | null) => void;
  onShowToast: (msg: string, type?: 'ok' | 'error') => void;
  onUpdateHotel: (updates: Partial<HotelConfig>) => void;
  onDetectNewHotel: (name: string, buffer: ArrayBuffer) => void;
  auth: AuthState;
}

export function ImportTab({
  config, activeHotel, reports, selectedReportId,
  isLoading, error,
  onAddReport, onDeleteReport, onSelectReport, onStorePdf,
  onSwitchToAnalyse, onSetLoading, onSetError, onShowToast,
  onUpdateHotel, onDetectNewHotel,
  auth,
}: ImportTabProps) {

  const [cloudReports, setCloudReports] = useState<CloudReportMeta[]>([])
  const [loadingCloud, setLoadingCloud] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [previewReport, setPreviewReport] = useState<CloudReportMeta | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [showAllCloud, setShowAllCloud] = useState(false)
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('topsys_recent_searches');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);

  // Stable refs so handleFile never needs to be recreated when config/hotel change
  const configRef = React.useRef(config)
  const activeHotelRef = React.useRef(activeHotel)
  React.useEffect(() => { configRef.current = config }, [config])
  React.useEffect(() => { activeHotelRef.current = activeHotel }, [activeHotel])

  // Guard to prevent duplicate fetchCloudReports calls when auth.user fires multiple times
  const fetchingCloudRef = React.useRef(false)

  const fetchCloudReports = useCallback(async () => {
    if (!auth.user) return
    if (fetchingCloudRef.current) return // already in flight
    fetchingCloudRef.current = true
    setLoadingCloud(true)
    setCloudError(null)
    try {
      const list = await listReports()
      setCloudReports(list)
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoadingCloud(false)
      fetchingCloudRef.current = false
    }
  }, [auth.user])

  useEffect(() => {
    if (auth.user) fetchCloudReports()
    else setCloudReports([])
  }, [auth.user, fetchCloudReports])

  const handleCloudImport = async (meta: CloudReportMeta) => {
    setImportingId(meta.id)
    try {
      const data = await downloadReport(meta.id)
      const added = onAddReport(data)
      if (!added) {
        onShowToast('Ce rapport est déjà chargé', 'error')
        return
      }
      setPreviewReport(null)
      onSwitchToAnalyse()
      onShowToast('Rapport importé depuis le cloud')
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur import cloud', 'error')
    } finally {
      setImportingId(null)
    }
  }

  const handleFile = useCallback(async (file: File) => {
    // Read current values from stable refs (avoids recreating this callback on every config change)
    const config = configRef.current;
    const activeHotel = activeHotelRef.current;

    onSetLoading(true);
    onSetError(null);
    logger.info('Import', `Début traitement fichier: ${file.name}`, { size: file.size, type: file.type });
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text) as OccupancyData;
        if (!data.id || !data.dateLabels) throw new Error("JSON invalide");
        const added = onAddReport(hydrateReport(data));
        if (!added) { onShowToast('Ce rapport est déjà chargé', 'error'); return; }
        onSwitchToAnalyse();
        onShowToast('Rapport JSON importé');
        return;
      }

      const buffer = await file.arrayBuffer();
      let hotelToUse = activeHotel;

      const detectedName = await detectEstablishmentName(buffer.slice(0));
      if (detectedName) {
        const existing = config.hotels.find(h =>
          h.name.toLowerCase() === detectedName.toLowerCase() ||
          detectedName.toLowerCase().includes(h.name.toLowerCase())
        );
        if (existing) {
          hotelToUse = existing;
        } else {
          onDetectNewHotel(detectedName, buffer.slice(0));
          return;
        }
      }

      const result = await parseTopsysPdf(buffer.slice(0), hotelToUse, config);
      result.fileName = file.name;
      const added = onAddReport(result);
      if (!added) {
        onShowToast('Ce rapport est déjà chargé', 'error');
        return;
      }
      onStorePdf(result.id, file);

      // Si on est sur l'hôtel par défaut et qu'on détecte un nom, on met à jour
      if (result.establishmentName && activeHotel?.name === DEFAULT_HOTEL.name) {
        onUpdateHotel({ name: result.establishmentName, address: result.establishmentAddress || activeHotel.address });
      }

      onSwitchToAnalyse();
      onShowToast('Rapport PDF importé avec succès');
    } catch (err: any) {
      console.error(err);
      onSetError(err.message || "Erreur lors de la lecture du fichier.");
      onShowToast(err.message || "Erreur d'import", 'error');
    } finally {
      onSetLoading(false);
    }
  }, []); // stable — reads live values via refs

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const exportReportJson = (r: OccupancyData) => {
    const filename = generateReportFilename(r, activeHotel?.name || 'Global')
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="bg-surf1 border-2 border-dashed border-border rounded-2xl p-14 text-center group hover:border-gold/40 transition-all cursor-pointer relative overflow-hidden"
      >
        <input type="file" accept=".pdf,.json" onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" />
        <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gold group-hover:scale-110 transition-transform">
          <FileUp size={28} />
        </div>
        <h3 className="font-serif text-xl font-bold text-text mb-2">Charger un rapport</h3>
        <p className="text-text-dim text-sm mb-6">
          Glissez-déposez votre fichier <strong className="text-text">Planning / Types (PDF)</strong> ou un <strong className="text-text">Export (JSON)</strong>.
        </p>
        <div className="flex justify-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-surf2 text-[10px] uppercase font-bold tracking-wider text-text-dark border border-border">PDF</span>
          <span className="px-3 py-1 rounded-lg bg-surf2 text-[10px] uppercase font-bold tracking-wider text-text-dark border border-border">JSON</span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-dim">Extraction en cours...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red/10 border border-red/20 rounded-xl flex items-center gap-3 text-red text-sm">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Report list */}
      {reports.length > 0 && (
        <div className="bg-surf1 p-5 rounded-2xl border border-border">
          <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-4">Rapports chargés ({reports.length})</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {reports.map(r => (
              <div
                key={r.id}
                className={cn(
                  "group p-3 rounded-xl border transition-all cursor-pointer",
                  selectedReportId === r.id ? "bg-gold/10 border-gold/30" : "bg-surf2 border-transparent hover:border-border-hover"
                )}
                onClick={() => { onSelectReport(r.id); onSwitchToAnalyse(); }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-text">
                      <Calendar size={12} className="text-gold shrink-0" />
                      <span>{r.dateLabels[0]?.short} au {r.dateLabels[r.daysCount - 1]?.short}</span>
                    </div>
                    <div className="text-[10px] font-bold text-gold/80 uppercase tracking-tight truncate pl-5">
                      {r.establishmentName}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={e => { e.stopPropagation(); exportReportJson(r); }} className="p-1.5 text-text-dark hover:text-blue rounded-lg hover:bg-blue/10 transition-colors" title="Export JSON">
                      <Download size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDeleteReport(r.id); }} className="p-1.5 text-text-dark hover:text-red rounded-lg hover:bg-red/10 transition-colors" title="Supprimer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-[9px] text-text-dark truncate mt-1 pl-5">{r.fileName || 'Import JSON'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cloud reports section */}
      {auth.user && (
        <div className="bg-surf1 p-5 rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest flex items-center gap-2">
                <Cloud size={12} className="text-gold" /> Rapports cloud
              </h3>
              <div 
                onClick={() => setShowAllCloud(!showAllCloud)}
                className="flex items-center gap-2 cursor-pointer group select-none"
              >
                <div className="relative">
                  <div className={cn(
                    "w-8 h-4 bg-surf2 rounded-full border border-border transition-colors",
                    showAllCloud ? "bg-gold/40 border-gold/60" : "group-hover:border-text-dark/30"
                  )} />
                  <div className={cn(
                    "absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-all shadow-sm",
                    showAllCloud ? "translate-x-4 bg-gold" : "bg-text-dark"
                  )} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold transition-colors",
                  showAllCloud ? "text-gold" : "text-text-dark group-hover:text-text-dim"
                )}>
                  {activeHotel ? 'Tous les hôtels' : 'Tous les rapports'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-md relative">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dark" />
                <input
                  type="text"
                  placeholder="Rechercher un hôtel, un fichier..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchTerm.trim()) {
                      const newRecent = [searchTerm.trim(), ...recentSearches.filter(s => s !== searchTerm.trim())].slice(0, 5);
                      setRecentSearches(newRecent);
                      localStorage.setItem('topsys_recent_searches', JSON.stringify(newRecent));
                      setShowHistory(false);
                    }
                  }}
                  className="w-full bg-surf2 border border-border rounded-lg pl-8 pr-8 py-1.5 text-[10px] focus:outline-none focus:border-gold/50 text-text"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dark hover:text-text"
                  >
                    <X size={12} />
                  </button>
                )}

                {/* Historique */}
                {showHistory && recentSearches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surf1 border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-border bg-surf2 flex justify-between items-center">
                      <span className="text-[9px] font-bold text-text-dark uppercase tracking-widest">Recherches récentes</span>
                      <button 
                        onClick={() => { setRecentSearches([]); localStorage.removeItem('topsys_recent_searches'); }}
                        className="text-[9px] text-red hover:underline"
                      >
                        Effacer
                      </button>
                    </div>
                    {recentSearches.map((s, i) => (
                      <div 
                        key={i}
                        onClick={() => { setSearchTerm(s); setShowHistory(false); }}
                        className="p-2 text-[10px] hover:bg-gold/10 cursor-pointer flex items-center gap-2 transition-colors"
                      >
                        <History size={10} className="text-text-dark" />
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={fetchCloudReports}
                disabled={loadingCloud}
                className="p-1.5 text-text-dark hover:text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
                title="Rafraîchir"
              >
                <RefreshCw size={13} className={loadingCloud ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {cloudError && (
            <div className="p-3 bg-red/10 border border-red/20 rounded-xl flex items-center gap-2 text-red text-xs mb-3">
              <AlertCircle size={13} /> {cloudError}
            </div>
          )}

          {loadingCloud ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cloudReports.length === 0 ? (
            <p className="text-xs text-text-dim text-center py-6">Aucun rapport dans le cloud.</p>
          ) : (() => {
            // Filtrage appliqué
            const filtered = cloudReports.filter(r => {
              // 1. Filtre global (si désactivé, on ne montre que l'hôtel actif)
              if (!showAllCloud && activeHotel) {
                if (!hotelMatchesReport(activeHotel, r.establishment_name, r.filename)) return false;
              }

              // 2. Recherche textuelle
              if (searchTerm.trim()) {
                const s = normalizeName(searchTerm);
                const matchName = r.establishment_name && normalizeName(r.establishment_name).includes(s);
                const matchFile = r.filename && normalizeName(r.filename).includes(s);
                if (!matchName && !matchFile) return false;
              }
              
              return true;
            }).sort((a, b) => {
              // Tri par date d'édition décroissante (plus récent en haut)
              const dateA = a.edition_date || a.created_at || '';
              const dateB = b.edition_date || b.created_at || '';
              return dateB.localeCompare(dateA);
            });

            if (filtered.length === 0) {
              return (
                <div className="py-6 text-center space-y-3">
                  <p className="text-xs text-text-dim">
                    Aucun rapport cloud pour <strong className="text-text">{activeHotel?.name}</strong>.
                  </p>
                  <button
                    onClick={() => setShowAllCloud(true)}
                    className="text-[10px] font-bold text-gold hover:text-gold-light underline underline-offset-2 transition-colors"
                  >
                    Afficher tous les hôtels
                  </button>
                </div>
              );
            }

            return (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {filtered
                .sort((a, b) => {
                  // 1. Non-importés en premier, importés en bas
                  const aImported = reports.some(lr => lr.periodStr === a.period_str && lr.establishmentName === a.establishment_name);
                  const bImported = reports.some(lr => lr.periodStr === b.period_str && lr.establishmentName === b.establishment_name);
                  if (!aImported && bImported) return -1;
                  if (aImported && !bImported) return 1;
                  // 2. Tri par date d'upload (plus récent en premier)
                  return new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime();
                })
                .map(r => {
                  const isImported = reports.some(lr => lr.periodStr === r.period_str && lr.establishmentName === r.establishment_name);
                  return (
                <div key={r.id} className="rounded-xl overflow-hidden">
                  <div
                    className={cn(
                      "group p-3 border transition-all cursor-pointer rounded-xl",
                      isImported ? "opacity-50" : "",
                      previewReport?.id === r.id
                        ? "bg-gold/10 border-gold/30 rounded-b-none"
                        : "bg-surf2 border-transparent hover:border-border-hover"
                    )}
                    onClick={() => setPreviewReport(prev => prev?.id === r.id ? null : r)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-text">
                        <Cloud size={11} className="text-gold shrink-0" />
                        <span className="truncate max-w-[240px]">{r.filename}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isImported && <span className="text-[9px] bg-green/15 text-green px-1.5 py-0.5 rounded-full font-bold">Importé</span>}
                        <Eye size={11} className="text-text-dark shrink-0 mt-0.5" />
                      </div>
                    </div>
                    <div className="text-[9px] text-text-dark mt-1">
                      <span className="text-gold/80 font-bold">{r.establishment_name || 'Hôtel inconnu'}</span>
                      {r.period_str && <span> · {r.period_str}</span>}
                      <span> · {new Date(r.upload_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>

                  {/* Preview panel */}
                  {previewReport?.id === r.id && (
                    <div className="bg-gold/5 border border-gold/30 border-t-0 rounded-b-xl p-4 space-y-3">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2"><span className="text-text-dark w-20 shrink-0">Fichier</span><span className="text-text font-medium truncate">{r.filename}</span></div>
                        {r.establishment_name && <div className="flex gap-2"><span className="text-text-dark w-20 shrink-0">Hôtel</span><span className="text-text font-medium">{r.establishment_name}</span></div>}
                        {r.period_str && <div className="flex gap-2"><span className="text-text-dark w-20 shrink-0">Période</span><span className="text-text font-medium">{r.period_str}</span></div>}
                        <div className="flex gap-2"><span className="text-text-dark w-20 shrink-0">Sauvegardé</span><span className="text-text font-medium">{new Date(r.upload_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleCloudImport(r)}
                          disabled={importingId === r.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gold text-bg font-bold rounded-lg text-xs hover:bg-gold-light transition-all disabled:opacity-50"
                        >
                          {importingId === r.id
                            ? <div className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                            : null}
                          Importer ce rapport
                        </button>
                        <button
                          onClick={() => setPreviewReport(null)}
                          className="p-2 text-text-dark hover:text-text rounded-lg hover:bg-surf2 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
