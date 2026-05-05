# Auth at Launch + Cloud Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un écran de connexion plein page au lancement de l'app, et ajouter une section "Rapports cloud" dans l'onglet Importer avec prévisualisation avant import.

**Architecture:** Nouveau composant `LoginScreen.tsx` rendu dans `App.tsx` avant l'app principale selon l'état auth. `ImportTab.tsx` reçoit `auth: AuthState` et affiche une section cloud conditionnelle. `generateReportFilename` dans `supabaseStorage.ts` standardise les noms de fichiers JSON.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, framer-motion, lucide-react, `@supabase/supabase-js` v2

---

## File Map

| Action | Fichier | Responsabilité |
|---|---|---|
| Create | `src/components/LoginScreen.tsx` | Écran plein page connexion/inscription/skip |
| Modify | `src/App.tsx` | Gate auth : LoginScreen ou app |
| Modify | `src/lib/supabaseStorage.ts` | +generateReportFilename |
| Modify | `src/components/ImportTab.tsx` | +auth prop, +section cloud, +renommage export |

---

## Task 1: generateReportFilename dans supabaseStorage

**Files:**
- Modify: `src/lib/supabaseStorage.ts`

- [ ] **Step 1: Ajouter l'import OccupancyData (déjà présent) et la fonction**

Ouvrir `src/lib/supabaseStorage.ts`. Après les imports existants (ligne 3), ajouter la fonction exportée suivante avant `requireClient()` :

```typescript
export function generateReportFilename(report: OccupancyData, hotelName: string): string {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9À-ÿ]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  const hotel = sanitize(hotelName) || 'hotel'

  const firstDate = report.dateLabels[0]?.date
  const lastDate = report.dateLabels[report.daysCount - 1]?.date

  const fmt = (d: Date | null | undefined): string => {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  }

  const start = fmt(firstDate)
  const end = fmt(lastDate)

  if (start && end) return `${hotel}_${start}_${end}.json`
  const fallback = sanitize(report.periodStr || report.fileName?.replace('.pdf', '') || 'rapport')
  return `${hotel}_${fallback}.json`
}
```

- [ ] **Step 2: Mettre à jour saveReport pour utiliser generateReportFilename**

Dans `saveReport`, remplacer la ligne :
```typescript
filename: report.fileName || 'rapport',
```
par :
```typescript
filename: generateReportFilename(report, report.establishmentName || 'hotel'),
```

Note : `report.establishmentName` peut être undefined — le fallback `'hotel'` dans `generateReportFilename` s'en charge.

- [ ] **Step 3: Vérifier le typage**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && npm run lint
```

Résultat attendu : 0 errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && git add src/lib/supabaseStorage.ts && git commit -m "feat: add generateReportFilename with hotel+date format"
```

---

## Task 2: LoginScreen composant

**Files:**
- Create: `src/components/LoginScreen.tsx`

- [ ] **Step 1: Créer `src/components/LoginScreen.tsx`**

```typescript
import { useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Cloud, AlertCircle } from 'lucide-react'
import { AuthState } from '../hooks/useAuth'

interface LoginScreenProps {
  auth: AuthState
  onSkip: () => void
  supabaseAvailable: boolean
}

export function LoginScreen({ auth, onSkip, supabaseAvailable }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password)
      } else {
        await auth.signUp(email, password)
      }
      // auth.user will become non-null via onAuthStateChange → App.tsx re-renders → LoginScreen disappears
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 bg-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-gold font-serif font-bold text-4xl">T</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-text">Topsys Planification Explorer</h1>
          <p className="text-text-dim text-sm mt-1">Analyseur de rapports hôteliers Topsys v8.5</p>
        </div>

        {/* Cloud unavailable banner */}
        {!supabaseAvailable && (
          <div className="p-3 bg-amber/10 border border-amber/20 rounded-xl flex items-center gap-2 text-amber text-xs">
            <AlertCircle size={14} />
            Cloud non disponible — mode local uniquement
          </div>
        )}

        {/* Form (only when Supabase is available) */}
        {supabaseAvailable && (
          <div className="bg-surf1 border border-border rounded-3xl p-8 space-y-5">
            {/* Mode toggle */}
            <div className="flex p-1 bg-surf2 rounded-xl border border-border gap-1">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'signin' ? 'bg-surf1 text-gold shadow-sm' : 'text-text-dim'}`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'signup' ? 'bg-surf1 text-gold shadow-sm' : 'text-text-dim'}`}
              >
                Créer un compte
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-text-dark uppercase mb-1">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dark" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-surf2 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-gold outline-none transition-colors"
                    placeholder="vous@exemple.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-dark uppercase mb-1">Mot de passe</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dark" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-surf2 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-gold outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red/10 border border-red/20 rounded-xl text-red text-xs flex items-center gap-2">
                  <AlertCircle size={12} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gold text-bg font-bold rounded-xl hover:bg-gold-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  : <Cloud size={16} />}
                {loading ? '...' : mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
              </button>
            </form>
          </div>
        )}

        {/* Skip button */}
        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-sm text-text-dim hover:text-text transition-colors"
          >
            Continuer sans compte →
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier le typage**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && npm run lint
```

Résultat attendu : 0 errors.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && git add src/components/LoginScreen.tsx && git commit -m "feat: add LoginScreen full-page auth component"
```

---

## Task 3: Gate auth dans App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Ajouter l'import LoginScreen et supabase**

En haut de `src/App.tsx`, ajouter :
```typescript
import { LoginScreen } from './components/LoginScreen'
import { supabase } from './lib/supabaseClient'
```

- [ ] **Step 2: Ajouter l'état skipAuth**

Dans la fonction `App()`, après `const auth = useAuth()`, ajouter :
```typescript
const [skipAuth, setSkipAuth] = useState(false)
```

- [ ] **Step 3: Ajouter le rendu conditionnel au début du return**

Dans le `return (`, remplacer le début du JSX. Ajouter juste après `<div className="flex flex-col min-h-screen bg-bg font-sans selection:bg-gold/30">` et avant `<Header` :

Ah non — le gate doit s'afficher **à la place** de toute l'app. Modifier le return ainsi :

Trouver le return de la fonction App qui commence par :
```typescript
  return (
    <div className="flex flex-col min-h-screen bg-bg font-sans selection:bg-gold/30">
```

Remplacer **tout le return** pour ajouter le gate **avant** le div principal :

```typescript
  return (
    <>
      {/* Auth gate — shown instead of app when user is not logged in and has not skipped */}
      {!auth.loading && !auth.user && !skipAuth && (
        <LoginScreen
          auth={auth}
          onSkip={() => setSkipAuth(true)}
          supabaseAvailable={supabase !== null}
        />
      )}

      {/* Loading spinner while auth resolves */}
      {auth.loading && (
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Main app — shown when logged in or skip selected */}
      {!auth.loading && (auth.user || skipAuth) && (
        <div className="flex flex-col min-h-screen bg-bg font-sans selection:bg-gold/30">
          <Header
            hotel={store.activeHotel}
            report={store.activeReport}
            theme={store.config.theme}
            onThemeChange={t => store.setConfig({ ...store.config, theme: t })}
          />
          <TabNav activeTab={store.activeTab} onTabChange={store.setActiveTab} isCloudConnected={!!auth.user} />

          <main className="flex-1 p-8">
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
            </AnimatePresence>
          </main>

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

          <footer className="px-8 py-4 border-t border-border bg-surf1 text-[10px] text-text-dark flex justify-between items-center shrink-0">
            <p>&copy; 2026 Topsys Planification Explorer</p>
            <div className="flex gap-4">
              <span>Traitement 100% local</span>
              <span className="text-gold">Topsys v8.5 Compatible</span>
            </div>
          </footer>

          <Toast toast={store.toast} />
        </div>
      )}
    </>
  )
```

- [ ] **Step 4: Vérifier le typage**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && npm run lint
```

Résultat attendu : 0 errors.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && git add src/App.tsx && git commit -m "feat: add auth gate at app launch with LoginScreen"
```

---

## Task 4: Section cloud dans ImportTab

**Files:**
- Modify: `src/components/ImportTab.tsx`

- [ ] **Step 1: Ajouter les imports nécessaires**

En haut de `src/components/ImportTab.tsx`, ajouter :
```typescript
import { useState, useEffect } from 'react';
import { Cloud, RefreshCw, Eye, X } from 'lucide-react';
import { AuthState } from '../hooks/useAuth';
import { listReports, downloadReport, generateReportFilename, CloudReportMeta } from '../lib/supabaseStorage';
```

Note : `useCallback` est déjà importé depuis React. Remplacer l'import React existant :
```typescript
import React, { useCallback, useState, useEffect } from 'react';
```

- [ ] **Step 2: Ajouter `auth` à l'interface ImportTabProps**

Ajouter `auth: AuthState;` à la fin de l'interface `ImportTabProps` :
```typescript
interface ImportTabProps {
  config: AppConfig;
  activeHotel: HotelConfig;
  reports: OccupancyData[];
  selectedReportId: string | null;
  isLoading: boolean;
  error: string | null;
  onAddReport: (r: OccupancyData) => void;
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
```

Ajouter `auth` dans la destructuration de la fonction :
```typescript
export function ImportTab({
  config, activeHotel, reports, selectedReportId,
  isLoading, error,
  onAddReport, onDeleteReport, onSelectReport, onStorePdf,
  onSwitchToAnalyse, onSetLoading, onSetError, onShowToast,
  onUpdateHotel, onDetectNewHotel,
  auth,
}: ImportTabProps) {
```

- [ ] **Step 3: Ajouter les états locaux cloud**

Après la ligne `}: ImportTabProps) {`, ajouter les états :
```typescript
  const [cloudReports, setCloudReports] = useState<CloudReportMeta[]>([])
  const [loadingCloud, setLoadingCloud] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [previewReport, setPreviewReport] = useState<CloudReportMeta | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
```

- [ ] **Step 4: Ajouter le chargement de la liste cloud**

Après les états locaux, ajouter :
```typescript
  const fetchCloudReports = useCallback(async () => {
    if (!auth.user) return
    setLoadingCloud(true)
    setCloudError(null)
    try {
      const list = await listReports()
      setCloudReports(list)
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoadingCloud(false)
    }
  }, [auth.user])

  useEffect(() => {
    if (auth.user) fetchCloudReports()
    else setCloudReports([])
  }, [auth.user, fetchCloudReports])
```

- [ ] **Step 5: Ajouter le handler d'import cloud**

Après `fetchCloudReports`, ajouter :
```typescript
  const handleCloudImport = async (meta: CloudReportMeta) => {
    setImportingId(meta.id)
    try {
      const data = await downloadReport(meta.id)
      onAddReport(data)
      setPreviewReport(null)
      onSwitchToAnalyse()
      onShowToast('Rapport importé depuis le cloud')
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur import cloud', 'error')
    } finally {
      setImportingId(null)
    }
  }
```

- [ ] **Step 6: Mettre à jour exportReportJson pour utiliser generateReportFilename**

Remplacer la fonction `exportReportJson` existante :
```typescript
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
```

- [ ] **Step 7: Ajouter la section cloud dans le JSX**

Dans le JSX, après la section `{/* Report list */}` (après la fermeture de `</div>` du bloc rapport local), ajouter la section cloud juste avant la fermeture `</div>` du conteneur principal :

```typescript
      {/* Cloud reports section */}
      {auth.user && (
        <div className="bg-surf1 p-5 rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest flex items-center gap-2">
              <Cloud size={12} className="text-gold" /> Rapports cloud
            </h3>
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
              {cloudReports.map(r => (
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
                      {r.establishment_name && <span>{r.establishment_name} · </span>}
                      {r.period_str && <span>{r.period_str} · </span>}
                      <span>{new Date(r.upload_date).toLocaleDateString('fr-FR')}</span>
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
```

- [ ] **Step 8: Vérifier le typage**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && npm run lint
```

Résultat attendu : 0 errors.

- [ ] **Step 9: Commit**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && git add src/components/ImportTab.tsx && git commit -m "feat: add cloud reports section in ImportTab with preview"
```

---

## Task 5: Build + test local

- [ ] **Step 1: Build de production**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && npm run build
```

Résultat attendu : build réussi sans erreur.

- [ ] **Step 2: Lancer le dev server**

```bash
cd "/c/Users/Farouk/TopsysExplorer-main" && npm run dev
```

Ouvrir http://localhost:3001 (ou 3000 si disponible).

- [ ] **Step 3: Tester le flux LoginScreen**

1. Rafraîchir la page → écran de connexion plein page doit apparaître
2. Cliquer "Continuer sans compte →" → l'app s'ouvre normalement
3. Rafraîchir → écran réapparaît (skipAuth non persisté)
4. Se connecter avec un compte test → écran disparaît, app s'ouvre

- [ ] **Step 4: Tester la section cloud dans ImportTab**

1. Connecté → onglet Importer → section "Rapports cloud" visible en bas
2. Cliquer sur un rapport → panneau de prévisualisation slide-down avec métadonnées
3. Cliquer "Importer ce rapport" → rapport importé + bascule sur Analyse
4. Cliquer Annuler → panneau se ferme

- [ ] **Step 5: Tester le renommage JSON**

1. Importer un PDF → onglet Importer → bouton Download sur un rapport
2. Le fichier téléchargé doit avoir le format `{hotel}_{YYYY-MM-DD}_{YYYY-MM-DD}.json`
