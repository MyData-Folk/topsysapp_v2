import React, { useCallback, useState, useEffect } from 'react';
import { FileUp, AlertCircle, Calendar, Trash2, Download, Cloud, RefreshCw, Eye, X } from 'lucide-react';
import { OccupancyData, AppConfig, HotelConfig } from '../types';
import { parseTopsysPdf, detectEstablishmentName } from '../lib/pdfParser';
import { cn } from '../utils/cn';
import { hydrateReport } from '../utils/helpers';
import { DEFAULT_HOTEL } from '../utils/constants';
import { AuthState } from '../hooks/useAuth';
import { listReports, downloadReport, generateReportFilename, CloudReportMeta } from '../lib/supabaseStorage';
import { logger } from '../utils/logger';

interface ImportTabProps {
  config: AppConfig;
  activeHotel: HotelConfig;
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

      if (result.establishmentName && activeHotel.name === DEFAULT_HOTEL.name) {
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
    const filename = generateReportFilename(r, activeHotel.name)
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
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={showAllCloud} 
                    onChange={e => setShowAllCloud(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={cn(
                    "w-7 h-4 bg-surf2 rounded-full border border-border transition-colors",
                    showAllCloud ? "bg-gold/20 border-gold/40" : ""
                  )} />
                  <div className={cn(
                    "absolute left-0.5 top-0.5 w-3 h-3 rounded-full transition-all",
                    showAllCloud ? "translate-x-3 bg-gold" : "bg-text-dark"
                  )} />
                </div>
                <span className="text-[10px] font-bold text-text-dark group-hover:text-text-dim transition-colors">Afficher tout</span>
              </label>
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
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {cloudReports
                .filter(r => {
                  if (showAllCloud) return true;
                  // Filtrage par hôtel sélectionné
                  const hotelMatches = !activeHotel || activeHotel.id === 'default' || r.establishment_name === activeHotel.name;
                  // Filtrage par rapports déjà importés
                  const isImported = reports.some(lr => lr.periodStr === r.period_str && lr.establishmentName === r.establishment_name);
                  return hotelMatches && !isImported;
                })
                .map(r => (
                <div key={r.id} className="rounded-xl overflow-hidden">
                  <div
                    className={cn(
                      "group p-3 border transition-all cursor-pointer rounded-xl",
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
                      <Eye size={11} className="text-text-dark shrink-0 mt-0.5" />
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
