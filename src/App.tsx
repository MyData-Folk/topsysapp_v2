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
import { loadCloudConfig } from './lib/supabaseStorage';
import { DEFAULT_CONFIG } from './utils/constants';

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

  /* 
  // Temporairement désactivé pour corriger le blocage de session
  useEffect(() => {
    if (auth.user && store.config.cloudSync) {
      logger.info('App', 'Utilisateur connecté, chargement de la config Cloud...');
      loadCloudConfig().then(cloudConfig => {
        if (cloudConfig) {
          logger.info('App', 'Configuration Cloud appliquée avec succès');
          store.setConfig(prev => ({ ...DEFAULT_CONFIG, ...prev, ...cloudConfig, cloudSync: true }));
        }
      }).catch(err => logger.error('App', 'Erreur chargement Cloud config post-login', err));
    }
  }, [auth.user]); 
  */

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

  return (
    <>
      {/* Auth gate — not logged in */}
      {!auth.loading && !auth.user && !skipAuth && (
        <LoginScreen auth={auth} onSkip={() => setSkipAuth(true)} supabaseAvailable={supabase !== null} />
      )}

      {/* Pending gate — logged in but not yet approved */}
      {!auth.loading && auth.user && !auth.isApproved && !skipAuth && (
        <LoginScreen auth={auth} onSkip={() => setSkipAuth(true)} supabaseAvailable={supabase !== null} />
      )}

      {/* Loading spinner while auth resolves */}
      {auth.loading && (
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Main app — shown when approved or skipped */}
      {!auth.loading && (auth.isApproved || skipAuth) && (
        <div className="flex flex-col min-h-screen bg-bg font-sans selection:bg-gold/30">
          <Header
            hotel={store.activeHotel}
            report={store.activeReport}
            theme={store.config.theme}
            onThemeChange={t => store.updateConfig({ theme: t })}
            auth={auth}
          />
          <TabNav activeTab={store.activeTab} onTabChange={store.setActiveTab} isCloudConnected={!!auth.user} isAdmin={auth.isAdmin} />

          <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
            <AnimatePresence mode="wait">
              {store.activeTab === 'import' && (
                <motion.div key="import" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <ImportTab
                    config={store.config}
                    activeHotel={store.activeHotel}
                    reports={store.reports}
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
        </div>
      )}
    </>
  );
}
