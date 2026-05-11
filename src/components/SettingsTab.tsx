import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Wand2, Download, FileUp, CheckCircle2, Bed, LayoutDashboard, Filter, FolderOpen, Moon, Sun, Sparkles, Cloud, DatabaseZap } from 'lucide-react';
import { AuthState } from '../hooks/useAuth';
import { saveConfig, loadCloudConfig } from '../lib/supabaseStorage';
import { registerHotel } from '../lib/availabilitiesStorage';
import { motion, AnimatePresence } from 'framer-motion';
import { AppConfig, HotelConfig, RoomType, ThemeMode } from '../types';
import { DEFAULT_CONFIG, DEFAULT_TYPES, DEFAULT_IGNORE_PREFIXES } from '../utils/constants';
import { autoDetectCategories } from '../lib/pdfParser';
import { cn } from '../utils/cn';
import { downloadBlob } from '../utils/helpers';

interface SettingsTabProps {
  config: AppConfig;
  activeHotel: HotelConfig | null;
  onConfigChange: (c: AppConfig) => void;
  onUpdateHotel: (updates: Partial<HotelConfig>) => void;
  onAddHotel: (h: HotelConfig) => void;
  onDeleteHotel: (id: string) => void;
  onShowToast: (msg: string, type?: 'ok' | 'error') => void;
  onOpenWizard: () => void;
  onImportHotelJson: (data: any) => void;
  auth: AuthState;
}

export function SettingsTab({ config, activeHotel, onConfigChange, onUpdateHotel, onAddHotel, onDeleteHotel, onShowToast, onOpenWizard, onImportHotelJson, auth }: SettingsTabProps) {
  const [saveFlash, setSaveFlash] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false)
  const [loadingCloud, setLoadingCloud] = useState(false)
  const [registeringHotel, setRegisteringHotel] = useState(false)

  const save = (updates: Partial<AppConfig>) => {
    onConfigChange({ ...config, ...updates });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const updateType = (idx: number, field: keyof RoomType, val: any) => {
    if (!activeHotel) return;
    const types = [...activeHotel.types];
    types[idx] = { ...types[idx], [field]: val };
    const totalCapacity = types.reduce((s, t) => s + (Number(t.capacity) || 0), 0);
    onUpdateHotel({ types, totalCapacity });
  };

  const removeType = (idx: number) => {
    if (!activeHotel) return;
    const types = activeHotel.types.filter((_, i) => i !== idx);
    onUpdateHotel({ types, totalCapacity: types.reduce((s, t) => s + t.capacity, 0) });
  };

  const addType = () => {
    if (!activeHotel) return;
    onUpdateHotel({ types: [...activeHotel.types, { code: '', label: '', description: '', capacity: 0 }] });
  };

  const addNewHotel = () => {
    onAddHotel({
      id: `hotel-${Date.now()}`,
      name: 'Nouvel Établissement',
      address: '',
      reference: '',
      totalCapacity: 0,
      types: [...DEFAULT_TYPES.map(t => ({ ...t }))],
      defaultRoomPrice: 150,
      ignorePrefixes: [...DEFAULT_IGNORE_PREFIXES],
    });
  };

  const scanCategories = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeHotel) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const detected = await autoDetectCategories(buffer.slice(0));
      if (detected.length > 0) {
        const existing = new Set(activeHotel.types.map(t => t.code));
        const merged = [...activeHotel.types, ...detected.filter(d => !existing.has(d.code))];
        onUpdateHotel({ types: merged, totalCapacity: merged.reduce((s, t) => s + t.capacity, 0) });
        onShowToast(`${detected.length} types détectés`);
      }
    } catch { onShowToast('Erreur de scan', 'error'); }
  };

  const exportConfig = () => {
    const data = { hotels: config.hotels, exportDate: new Date().toISOString() };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `config_hotels_${new Date().toISOString().split('T')[0]}.json`);
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const content = JSON.parse(ev.target?.result as string);
        if (content.hotels && Array.isArray(content.hotels)) {
          onConfigChange({
            ...config,
            hotels: [...config.hotels.filter(h => !content.hotels.find((ih: any) => ih.id === h.id)), ...content.hotels],
          });
          onShowToast(`${content.hotels.length} hôtels importés`);
        }
      } catch { onShowToast('Fichier invalide', 'error'); }
    };
    reader.readAsText(file);
  };

  const pickArchiveFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      save({ archiveFolderName: handle.name });
      onShowToast(`Dossier: ${handle.name}`);
      localStorage.setItem('archive_folder_handle', JSON.stringify({ name: handle.name }));
    } catch {
      // user cancelled
    }
  };

  const resetAll = () => {
    if (confirm('Réinitialiser toute la configuration ?')) {
      localStorage.removeItem('hotel_analyzer_config');
      window.location.reload();
    }
  };

  const [cloudSaveSuccess, setCloudSaveSuccess] = useState(false);

  const handleSaveConfig = async () => {
    setSavingCloud(true);
    setCloudSaveSuccess(false);
    
    // Timeout de 10s pour éviter le spin infini
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
    
    try {
      await Promise.race([saveConfig(config), timeout]);
      onShowToast('Configuration sauvegardée dans le cloud');
      setCloudSaveSuccess(true);
      setTimeout(() => setCloudSaveSuccess(false), 3000);
    } catch (e) {
      const msg = e instanceof Error && e.message === 'TIMEOUT' ? 'Délai de sauvegarde dépassé' : (e instanceof Error ? e.message : 'Erreur inconnue');
      onShowToast(msg, 'error');
    } finally {
      setSavingCloud(false);
    }
  };

  const handleRegisterHotel = async () => {
    if (!activeHotel) return;
    setRegisteringHotel(true)
    try {
      await registerHotel(activeHotel)
      onUpdateHotel({ supabaseRegistered: true })
      onShowToast(`Hôtel "${activeHotel.name}" enregistré dans Supabase`)
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setRegisteringHotel(false)
    }
  }

  const handleLoadConfig = async () => {
    setLoadingCloud(true)
    try {
      const cloudConfig = await loadCloudConfig()
      if (!cloudConfig) { onShowToast('Aucune configuration cloud trouvée', 'error'); return }
      onConfigChange({ ...DEFAULT_CONFIG, ...config, ...cloudConfig, cloudSync: config.cloudSync })
      onShowToast('Configuration cloud chargée')
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setLoadingCloud(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center bg-surf1 p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-serif font-bold">Paramètres & Multi-Hôtels</h2>
          <p className="text-[10px] text-text-dark uppercase tracking-widest mt-1">Gérez vos établissements</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:gap-4">
          <AnimatePresence>
            {saveFlash && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-green/10 text-green rounded-lg text-[10px] font-bold">
                <CheckCircle2 size={12} /> SAUVEGARDÉ
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={resetAll} className="flex items-center gap-2 px-4 py-2 bg-red/10 text-red border border-red/20 rounded-xl text-xs font-bold hover:bg-red/20 transition-all">
            <RotateCcw size={14} /> RESET
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hotel selector */}
        <div className="lg:col-span-1">
          <div className="bg-surf1 p-6 rounded-2xl border border-border">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Établissements</h3>
              <button onClick={addNewHotel} className="p-1 px-2 bg-gold/10 text-gold rounded border border-gold/20 text-[10px] font-bold hover:bg-gold/20 flex items-center gap-1">
                <Plus size={12} /> RAPIDE
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={onOpenWizard} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-blue/10 text-blue border border-blue/20 rounded-xl text-[10px] font-bold hover:bg-blue/20 transition-all">
                <Sparkles size={12} /> Assistant
              </button>
              <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-green/10 text-green border border-green/20 rounded-xl text-[10px] font-bold hover:bg-green/20 transition-all cursor-pointer">
                <FileUp size={12} /> Import JSON
                <input type="file" accept=".json" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    try {
                      const data = JSON.parse(ev.target?.result as string);
                      onImportHotelJson(data);
                    } catch { onShowToast('Fichier invalide', 'error'); }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} />
              </label>
            </div>
            <div className="space-y-2">
              {config.hotels.map(h => (
                <div key={h.id} onClick={() => onConfigChange({ ...config, selectedHotelId: h.id })}
                  className={cn("p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group",
                    config.selectedHotelId === h.id ? "bg-gold/10 border-gold/40" : "bg-surf2 border-transparent hover:border-gold/20")}>
                  <div className="truncate pr-2">
                    <div className={cn("text-xs font-bold truncate", config.selectedHotelId === h.id ? "text-gold" : "text-text")}>{h.name}</div>
                    <div className="text-[9px] text-text-dark truncate">{h.address || '-'}</div>
                  </div>
                  {config.hotels.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); onDeleteHotel(h.id); }} 
                      className="p-2 text-text-dark hover:text-red md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Config panels */}
        <div className="lg:col-span-2 space-y-6">
          {!activeHotel ? (
            <div className="bg-surf1 p-12 rounded-2xl border border-border text-center flex flex-col items-center justify-center h-full min-h-[300px]">
              <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mb-4">
                <LayoutDashboard size={32} />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">Mode Global Actif</h3>
              <p className="text-sm text-text-dim max-w-sm">
                Sélectionnez un établissement spécifique dans la liste à gauche ou désactivez le mode global en haut pour modifier son identité, ses préfixes ou sa configuration Cloud.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Identity */}
              <div className="bg-surf1 p-6 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-gold font-serif text-lg mb-6"><LayoutDashboard size={20} /> Identité</div>
              <div className="space-y-4">
                <Field label="Nom" value={activeHotel.name} onChange={v => onUpdateHotel({ name: v })} />
                <Field label="Adresse" value={activeHotel.address} onChange={v => onUpdateHotel({ address: v })} />
                <Field label="Référence" value={activeHotel.reference} onChange={v => onUpdateHotel({ reference: v })} />
                <Field label="Nom export XLSX" value={config.xlsxName} onChange={v => save({ xlsxName: v })} />
              </div>
            </div>

            {/* Thresholds + Theme + Archive */}
            <div className="bg-surf1 p-6 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-gold font-serif text-lg mb-6"><Filter size={20} /> Seuils & Préférences</div>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <NumField label="Seuil élevé (%)" value={config.highOccupancyThreshold} onChange={v => save({ highOccupancyThreshold: v })} />
                  <NumField label="Seuil bas (%)" value={config.lowOccupancyThreshold} onChange={v => save({ lowOccupancyThreshold: v })} />
                </div>
                <NumField label={`Prix moyen (${config.currency})`} value={activeHotel.defaultRoomPrice} onChange={v => onUpdateHotel({ defaultRoomPrice: v })} />

                {/* Theme selector */}
                <div className="flex items-center justify-between p-3 bg-surf2 rounded-lg border border-border">
                  <span className="text-sm">Thème</span>
                  <div className="flex p-0.5 bg-surf3 rounded-lg border border-border">
                    <button onClick={() => save({ theme: 'dark' })} className={cn("flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all", config.theme === 'dark' ? "bg-surf1 text-gold shadow-sm" : "text-text-dark")}>
                      <Moon size={12} /> Sombre
                    </button>
                    <button onClick={() => save({ theme: 'light' })} className={cn("flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all", config.theme === 'light' ? "bg-surf1 text-gold shadow-sm" : "text-text-dark")}>
                      <Sun size={12} /> Clair
                    </button>
                  </div>
                </div>

                {/* Archive folder */}
                <div className="p-3 bg-surf2 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dossier d'archivage</span>
                    <button onClick={pickArchiveFolder} className="flex items-center gap-1.5 px-3 py-1 bg-gold/10 text-gold border border-gold/20 rounded-lg text-[10px] font-bold hover:bg-gold/20 transition-all">
                      <FolderOpen size={12} /> Choisir
                    </button>
                  </div>
                  {config.archiveFolderName && (
                    <div className="text-[10px] text-text-dim truncate">
                      Dossier actif: <span className="text-gold font-bold">{config.archiveFolderName}</span>
                    </div>
                  )}
                  <p className="text-[9px] text-text-dark">Les exports JSON seront sauvegardés automatiquement dans ce dossier.</p>
                </div>

                <Toggle label="Utiliser prix fixe (ignorer rapport)" value={config.useAveragePriceForRevenue} onChange={v => save({ useAveragePriceForRevenue: v })} />
                <Toggle label="Afficher lignes Libres par type" value={config.showCategoryLibres} onChange={v => save({ showCategoryLibres: v })} />
                <Toggle label="Sauvegarde automatique" value={config.autoSave} onChange={v => save({ autoSave: v })} />
              </div>
              <div className="border-t border-border pt-4 mt-4 grid grid-cols-2 gap-3">
                <button onClick={exportConfig} className="flex items-center justify-center gap-2 p-3 bg-surf3 border border-border hover:border-gold/30 rounded-xl text-xs font-bold">
                  <Download size={14} /> EXPORTER
                </button>
                <label className="flex items-center justify-center gap-2 p-3 bg-surf3 border border-border hover:border-blue/30 rounded-xl text-xs font-bold cursor-pointer">
                  <FileUp size={14} /> IMPORTER
                  <input type="file" accept=".json" onChange={importConfig} className="hidden" />
                </label>
              </div>
              {/* Cloud sync */}
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center gap-2 text-gold font-serif text-sm mb-3">
                  <Cloud size={16} /> Cloud & Synchronisation
                </div>
                {!auth.user ? (
                  <p className="text-[11px] text-text-dark">
                    Connectez-vous dans l'onglet <strong className="text-text">Cloud</strong> pour synchroniser votre configuration.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Toggle
                      label="Chargement auto au démarrage"
                      value={config.cloudSync}
                      onChange={v => save({ cloudSync: v })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSaveConfig}
                        disabled={savingCloud}
                        className={cn(
                          "flex items-center justify-center gap-1.5 p-2.5 border rounded-xl text-[11px] font-bold transition-all disabled:opacity-50",
                          cloudSaveSuccess 
                            ? "bg-green/20 text-green border-green/40 shadow-[0_0_10px_rgba(34,197,94,0.2)]" 
                            : "bg-gold/10 text-gold border-gold/20 hover:bg-gold/20"
                        )}
                      >
                        {savingCloud ? (
                          <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                        ) : cloudSaveSuccess ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <Cloud size={12} />
                        )}
                        {cloudSaveSuccess ? 'Sauvegardé !' : 'Sauvegarder'}
                      </button>
                      <button
                        onClick={handleLoadConfig}
                        disabled={loadingCloud}
                        className="flex items-center justify-center gap-1.5 p-2.5 bg-surf3 border border-border rounded-xl text-[11px] font-bold hover:border-gold/30 transition-all disabled:opacity-50"
                      >
                        {loadingCloud
                          ? <div className="w-3 h-3 border border-text-dark border-t-transparent rounded-full animate-spin" />
                          : <Cloud size={12} />}
                        Charger
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ignore prefixes */}
          <div className="bg-surf1 p-6 rounded-2xl border border-border">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-gold font-serif text-lg">
                <Filter size={20} /> Préfixes ignorés au parsing
              </div>
              <button onClick={() => onUpdateHotel({ ignorePrefixes: [...DEFAULT_IGNORE_PREFIXES] })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surf3 border border-border rounded-lg text-[10px] font-bold text-text-dark hover:border-gold/30 transition-all">
                <RotateCcw size={12} /> Défaut
              </button>
            </div>
            <p className="text-[10px] text-text-dark mb-4">Lignes du PDF commençant par ces préfixes seront ignorées lors du parsing. Propre à chaque hôtel.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(activeHotel.ignorePrefixes || []).map((p, i) => (
                <div key={i} className="flex items-center gap-1 px-2.5 py-1 bg-surf2 border border-border rounded-lg text-xs group">
                  <span>{p}</span>
                  <button onClick={() => {
                    const updated = activeHotel.ignorePrefixes.filter((_, j) => j !== i);
                    onUpdateHotel({ ignorePrefixes: updated });
                  }} className="p-0.5 text-text-dark hover:text-red opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input id="new-prefix" placeholder="Nouveau préfixe..." className="flex-1 bg-surf2 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    const val = input.value.trim();
                    if (val && !(activeHotel.ignorePrefixes || []).includes(val)) {
                      onUpdateHotel({ ignorePrefixes: [...(activeHotel.ignorePrefixes || []), val] });
                      input.value = '';
                    }
                  }
                }} />
              <button onClick={() => {
                const input = document.getElementById('new-prefix') as HTMLInputElement;
                const val = input?.value.trim();
                if (val && !(activeHotel.ignorePrefixes || []).includes(val)) {
                  onUpdateHotel({ ignorePrefixes: [...(activeHotel.ignorePrefixes || []), val] });
                  input.value = '';
                }
              }} className="px-3 py-2 bg-gold text-bg rounded-lg text-xs font-bold hover:bg-gold-light">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Supabase disponibilités */}
          {auth.user && (
            <div className="bg-surf1 p-6 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-gold font-serif text-lg mb-4">
                <DatabaseZap size={20} /> Disponibilités Supabase
              </div>
              <p className="text-[11px] text-text-dark mb-4">
                Enregistrez cet hôtel et sa typologie dans Supabase pour pouvoir y pousser des disponibilités depuis l'onglet Analyse.
              </p>
              <div className="flex items-center justify-between p-3 bg-surf2 rounded-xl border border-border">
                <div>
                  <div className="text-xs font-bold text-text">{activeHotel.name}</div>
                  <div className="text-[10px] text-text-dark">{activeHotel.types.length} type{activeHotel.types.length > 1 ? 's' : ''} · {activeHotel.totalCapacity} chambres</div>
                </div>
                {activeHotel.supabaseRegistered ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/20 rounded-lg text-[11px] font-bold text-green">
                    <CheckCircle2 size={12} /> Enregistré
                  </div>
                ) : (
                  <button
                    onClick={handleRegisterHotel}
                    disabled={registeringHotel || activeHotel.types.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg rounded-lg text-[11px] font-bold hover:bg-gold-light transition-all disabled:opacity-50"
                  >
                    {registeringHotel
                      ? <div className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                      : <DatabaseZap size={12} />}
                    Enregistrer dans Supabase
                  </button>
                )}
              </div>
              {activeHotel.supabaseRegistered && (
                <button
                  onClick={handleRegisterHotel}
                  disabled={registeringHotel}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 p-2 bg-surf2 border border-border rounded-xl text-[10px] font-bold text-text-dark hover:border-gold/30 hover:text-gold transition-all disabled:opacity-50"
                >
                  {registeringHotel
                    ? <div className="w-3 h-3 border border-text-dark border-t-transparent rounded-full animate-spin" />
                    : <RotateCcw size={11} />}
                  Resynchroniser la typologie
                </button>
              )}
              {activeHotel.types.length === 0 && (
                <p className="text-[10px] text-amber mt-2">Ajoutez au moins un type de chambre avant d'enregistrer.</p>
              )}
            </div>
          )}

          {/* Room types */}
          <div className="bg-surf1 p-6 rounded-2xl border border-border">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-gold font-serif text-lg">
                <Bed size={20} /> Chambres ({activeHotel.totalCapacity} au total)
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 text-gold border border-gold/20 rounded-lg text-xs font-bold hover:bg-gold/20 cursor-pointer">
                  <Wand2 size={14} /> Scanner
                  <input type="file" accept=".pdf" className="hidden" onChange={scanCategories} />
                </label>
                <button onClick={addType} className="flex items-center gap-2 px-3 py-1.5 bg-gold text-bg rounded-lg text-xs font-bold hover:bg-gold-light">
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {activeHotel.types.map((t, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 p-3 bg-surf2 border border-border rounded-xl md:flex md:flex-nowrap">
                  <input placeholder="13 DCLA" value={t.code} onChange={e => updateType(i, 'code', e.target.value)} className="flex-1 min-w-[100px] bg-surf3 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none" />
                  <input placeholder="Label" value={t.label} onChange={e => updateType(i, 'label', e.target.value)} className="w-full md:w-24 bg-surf3 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none" />
                  <input placeholder="Description" value={t.description} onChange={e => updateType(i, 'description', e.target.value)} className="col-span-2 flex-[2] min-w-[150px] bg-surf3 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none md:col-span-1" />
                  <input type="number" placeholder="Cap." value={t.capacity} onChange={e => updateType(i, 'capacity', parseInt(e.target.value) || 0)} className="w-16 bg-surf3 border border-border rounded-lg p-2 text-xs focus:border-gold outline-none" />
                  <button onClick={() => removeType(i)} className="p-2 text-text-dark hover:text-red"><Trash2 size={16} /></button>
                </div>
              ))}
              {activeHotel.types.length === 0 && (
                <div className="text-center py-8 text-text-dark text-xs italic">Aucun type défini.</div>
              )}
            </div>
          </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-text-dark uppercase mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-surf2 border border-border rounded-lg p-2 text-sm focus:border-gold outline-none transition-colors" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex-1">
      <label className="block text-[10px] font-bold text-text-dark uppercase mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} className="w-full bg-surf2 border border-border rounded-lg p-2 text-sm focus:border-gold outline-none" />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-surf2 rounded-lg border border-border">
      <span className="text-sm">{label}</span>
      <button onClick={() => onChange(!value)} className={cn("w-10 h-5 rounded-full relative transition-colors", value ? "bg-gold" : "bg-border")}>
        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", value ? "right-1" : "left-1")} />
      </button>
    </div>
  );
}
