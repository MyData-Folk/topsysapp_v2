import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { HotelConfig } from './types';
import { useAppStore } from './store/useAppStore';
import { autoDetectCategories, parseTopsysPdf } from './lib/pdfParser';
import { DEFAULT_IGNORE_PREFIXES } from './utils/constants';
import { useAuth } from './hooks/useAuth';
import { CloudTab } from './components/CloudTab';
import { Header } from './components/Header';
import { TabNav, TabNavMobile } from './components/TabNav';
import { ImportTab } from './components/ImportTab';
import { AnalyseTab } from './components/AnalyseTab';
import { EvolutionTab } from './components/EvolutionTab';
import { SettingsTab } from './components/SettingsTab';
import { HelpTab } from './components/HelpTab';
import { AdminTab } from './components/AdminTab';
import { HotelWizard } from './components/HotelWizard';
import { Toast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { supabase } from './lib/supabaseClient';
import { logger } from './utils/logger';
import { loadCloudConfig, listReports, downloadReport } from './lib/supabaseStorage';
import { DEFAULT_CONFIG } from './utils/constants';
import { LogPanel } from './components/LogPanel';

export default function App() {
  const store = useAppStore();
  const auth = useAuth();
  const [skipAuth, setSkipAuth] = useState(false);
  const [newHotelPrompt, setNewHotelPrompt] = useState<{ name: string; buffer: ArrayBuffer } | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  logger.debug('App', 'Render principal', {
    authLoading: auth.loading,
    hasUser: !!auth.user,
    isApproved: auth.isApproved,
    activeTab: store.activeTab
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', store.config.theme);
  }, [store.config.theme]);

  // Log de diagnostic précis quand le profil change
  useEffect(() => {
    if (auth.user && auth.profile) {
      logger.info('App', `Profil chargé - Rôle: ${auth.profile.role} - Admin: ${auth.isAdmin ? 'OUI' : 'NON'}`);
    }
  }, [auth.profile]);

  // Activation du CloudSync et chargement au login
  useEffect(() => {
    if (auth.user) {
      // On active la synchro cloud d'office si on est connecté
      if (!store.config.cloudSync) {
        store.updateConfig({ cloudSync: true });
      }
      
      // Chargement de la config Cloud avec timeout de 5s
      const cloudPromise = loadCloudConfig();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_CLOUD')), 5000));

      Promise.race([cloudPromise, timeoutPromise]).then(cloudConfig => {
        if (cloudConfig) {
          logger.info('App', 'Config Cloud appliquée');
          store.setConfig(prev => ({ ...DEFAULT_CONFIG, ...prev, ...cloudConfig as any, cloudSync: true }));
          
          if ((cloudConfig as any).lastFilters) {
            const f = (cloudConfig as any).lastFilters;
            store.setFilters({
              ...f,
              types: new Set(f.types || []),
              dows: new Set(f.dows || [0,1,2,3,4,5,6])
            });
          }
        }
      }).catch(err => {
        if (err.message === 'TIMEOUT_CLOUD') {
          logger.warn('App', 'Chargement Cloud trop long, continuation avec local');
        } else {
          logger.error('App', 'Erreur Cloud Config', err);
        }
      });
    }
  }, [auth.user]);

  // La synchronisation automatique est désactivée pour laisser le choix à l'utilisateur (Mode manuel via ImportTab)
  useEffect(() => {
    if (auth.user && store.isHydrated) {
      logger.info('App', 'Session active - Les rapports Cloud sont disponibles dans l\'onglet Import');
    }
  }, [auth.user, store.isHydrated]);

  const handleNewHotelConfirm = async () => {
    if (!newHotelPrompt) return;
    const hotelId = `hotel-${Date.now()}`;
    const newHotel: HotelConfig = {
      id: hotelId,
      name: newHotelPrompt.name,
      address: 'À compléter',
      reference: '',
      totalCapacity: 0,
      types: [],
      defaultRoomPrice: 150,
      ignorePrefixes: [...DEFAULT_IGNORE_PREFIXES],
    };

    try {
      const detected = await autoDetectCategories(newHotelPrompt.buffer.slice(0));
      newHotel.types = detected;
      newHotel.totalCapacity = detected.reduce((s, t) => s + (t.capacity || 0), 0);
    } catch { /* ignore */ }

    store.addHotel(newHotel);

    try {
      const result = await parseTopsysPdf(newHotelPrompt.buffer.slice(0), newHotel, store.config);
      result.fileName = 'Import automatique';
      store.addReport(result);
      store.setActiveTab('analyse');
      store.showToast('Hôtel créé et rapport importé');
    } catch (e: any) {
      store.showToast(e.message || 'Erreur de parsing', 'error');
    }

    setNewHotelPrompt(null);
  };

  const handleWizardComplete = (hotel: HotelConfig) => {
    store.addHotel(hotel);
    setShowWizard(false);
    store.showToast(`Hôtel "${hotel.name}" ajouté avec succès`);
    store.setActiveTab('settings');
  };

  const handleImportHotelJson = (hotelData: any) => {
    if (hotelData.name && hotelData.types && Array.isArray(hotelData.types)) {
      const hotel: HotelConfig = {
        id: hotelData.id || `hotel-${Date.now()}`,
        name: hotelData.name,
        address: hotelData.address || '',
        reference: hotelData.reference || '',
        totalCapacity: hotelData.totalCapacity || hotelData.types.reduce((s: number, t: any) => s + (t.capacity || 0), 0),
        types: hotelData.types,
        defaultRoomPrice: hotelData.defaultRoomPrice || 150,
        ignorePrefixes: hotelData.ignorePrefixes || [...DEFAULT_IGNORE_PREFIXES],
      };
      store.addHotel(hotel);
      store.showToast(`Hôtel "${hotel.name}" importé`);
    }
  };

    const handleRefresh = async () => {
      logger.info('App', 'Rafraîchissement global demandé...');
      // 1. Rafraîchir les données locales (IDB)
      await store.refreshData();
      
      // 2. Vérifier/Rafraîchir la session Supabase
      if (auth.user) {
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            logger.warn('App', 'Session expirée détectée lors du rafraîchissement');
            auth.signOut();
          } else {
            await auth.refreshProfile();
            logger.info('App', 'Session Cloud confirmée et profil rafraîchi');
          }
        } catch (e) {
          logger.error('App', 'Erreur vérification session', e);
          // Si erreur réseau grave, on ne déconnecte pas forcément, mais on prévient
          store.showToast('Erreur de connexion cloud', 'error');
        }
      }
    };

    return (
      <div className={cn("min-h-screen", store.config.theme === 'dark' ? "dark" : "")}>
        <AnimatePresence mode="wait">
          {/* Auth gate — not logged in */}
          {!auth.loading && !auth.user && !skipAuth && !auth.isVisitor && (
            <LoginScreen auth={auth} onSkip={() => setSkipAuth(true)} supabaseAvailable={supabase !== null} />
          )}

          {/* Initial loading spinner while auth resolves */}
          {auth.loading && (
            <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6">
              <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-text-dim animate-pulse">Initialisation de la session...</p>
              </div>
            </div>
          )}

          {/* Main app — shown when approved, skipped, or visitor (pending) */}
          {!auth.loading && (auth.isApproved || skipAuth || auth.isVisitor || (auth.user && auth.profile === null)) && (
            <motion.div 
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col min-h-screen bg-bg font-sans selection:bg-gold/30"
            >
              <Header
                hotels={store.config.hotels}
                selectedHotelId={store.selectedHotelId}
                onHotelChange={store.setSelectedHotelId}
                report={store.activeReport}
                theme={store.config.theme}
                onThemeChange={t => store.updateConfig({ theme: t })}
                onRefresh={handleRefresh}
                auth={auth}
                isLoading={store.isLoading}
              />
          <TabNav activeTab={store.activeTab} onTabChange={store.setActiveTab} isCloudConnected={!!auth.user} isAdmin={auth.isAdmin} />

          <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
            <AnimatePresence mode="wait">
              {store.activeTab === 'import' && (
                <motion.div key="import" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <ImportTab
                    config={store.config}
                    activeHotel={store.activeHotel}
                    reports={store.filteredReports}
                    selectedReportId={store.selectedReportId}
                    isLoading={store.isLoading}
                    error={store.error}
                    onAddReport={store.addReport}
                    onDeleteReport={store.deleteReport}
                    onSelectReport={id => { store.setSelectedReportId(id); store.setActiveTab('analyse'); }}
                    onStorePdf={store.storePdfFile}
                    onSwitchToAnalyse={() => store.setActiveTab('analyse')}
                    onSetLoading={store.setIsLoading}
                    onSetError={store.setError}
                    onShowToast={store.showToast}
                    onUpdateHotel={store.updateActiveHotel}
                    onDetectNewHotel={(name, buffer) => setNewHotelPrompt({ name, buffer })}
                    auth={auth}
                  />
                </motion.div>
              )}

              {store.activeTab === 'analyse' && (
                <motion.div key="analyse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AnalyseTab
                    report={store.activeReport}
                    config={store.config}
                    hotel={store.activeHotel}
                    filters={store.filters}
                    pdfFile={store.activeReport ? store.pdfFiles[store.activeReport.id] || null : null}
                    auth={auth}
                    onFiltersChange={store.setFilters}
                    onResetFilters={store.resetFilters}
                    onShowToast={store.showToast}
                  />
                </motion.div>
              )}

              {store.activeTab === 'evolution' && (
                <motion.div key="evolution" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EvolutionTab
                    config={store.config}
                    hotel={store.activeHotel}
                    auth={auth}
                    onShowToast={store.showToast}
                  />
                </motion.div>
              )}

              {store.activeTab === 'help' && (
                <motion.div key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <HelpTab />
                </motion.div>
              )}

              {store.activeTab === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <SettingsTab
                    config={store.config}
                    activeHotel={store.activeHotel}
                    onConfigChange={store.setConfig}
                    onUpdateHotel={store.updateActiveHotel}
                    onAddHotel={store.addHotel}
                    onDeleteHotel={store.deleteHotel}
                    onShowToast={store.showToast}
                    onOpenWizard={() => setShowWizard(true)}
                    onImportHotelJson={handleImportHotelJson}
                    auth={auth}
                  />
                </motion.div>
              )}

              {store.activeTab === 'cloud' && (
                <motion.div key="cloud" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <CloudTab
                    auth={auth}
                    activeReport={store.activeReport}
                    onAddReport={store.addReport}
                    onShowToast={store.showToast}
                  />
                </motion.div>
              )}

              {store.activeTab === 'admin' && auth.isAdmin && (
                <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <AdminTab auth={auth} onShowToast={store.showToast} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <TabNavMobile activeTab={store.activeTab} onTabChange={store.setActiveTab} isCloudConnected={!!auth.user} isAdmin={auth.isAdmin} />

          {/* Hotel wizard */}
          {showWizard && (
            <HotelWizard
              onComplete={handleWizardComplete}
              onClose={() => setShowWizard(false)}
              onShowToast={store.showToast}
            />
          )}

          {/* New hotel prompt modal */}
          {newHotelPrompt && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-surf1 border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl">
                <div className="w-16 h-16 bg-blue/10 rounded-full flex items-center justify-center text-blue mx-auto mb-6">
                  <Plus size={32} />
                </div>
                <h3 className="text-xl font-bold text-center mb-2">Nouvel Établissement Détecté</h3>
                <p className="text-text-dim text-center text-sm mb-8">
                  Le rapport correspond à "<span className="text-text font-bold">{newHotelPrompt.name}</span>".
                  Créer un profil ?
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setNewHotelPrompt(null)} className="flex-1 py-3 px-6 rounded-xl border border-border text-text-dim font-bold hover:bg-surf2 transition-all">
                    ANNULER
                  </button>
                  <button onClick={handleNewHotelConfirm} className="flex-1 py-3 px-6 rounded-xl bg-gold text-bg font-bold hover:bg-gold-light shadow-lg shadow-gold/20 transition-all">
                    CONFIGURER
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          <footer className="px-4 pb-24 pt-4 md:px-8 md:py-4 border-t border-border bg-surf1 text-[10px] text-text-dark flex flex-col gap-1 md:flex-row md:justify-between md:items-center shrink-0">
            <p>&copy; 2026 Topsys Planification Explorer</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Traitement 100% local</span>
              <span className="text-gold">Topsys v8.5 Compatible</span>
            </div>
          </footer>

          <Toast toast={store.toast} />
        </motion.div>
      )}

        </AnimatePresence>

        {/* LogPanel déplacé ici pour être accessible même pendant le chargement si on est admin ou si on force */}
        {(auth.isAdmin || (auth.user && window.location.hash === '#debug')) && <LogPanel />}
        
        {/* Bouton invisible pour le déclenchement forcé */}
        <button id="force-log-panel" className="hidden" onClick={() => window.location.hash = '#debug'} />
      </div>
    );
}
