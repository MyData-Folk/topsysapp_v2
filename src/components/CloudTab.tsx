import { useState, useEffect, useCallback } from 'react'
import { Cloud, Upload, Download, Trash2, LogOut, User, AlertCircle, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { OccupancyData } from '../types'
import { AuthState } from '../hooks/useAuth'
import { AuthModal } from './AuthModal'
import {
  saveReport,
  listReports,
  downloadReport,
  deleteSupabaseReport,
  CloudReportMeta,
} from '../lib/supabaseStorage'

interface CloudTabProps {
  auth: AuthState
  activeReport: OccupancyData | null
  onAddReport: (r: OccupancyData) => boolean
  onShowToast: (msg: string, type?: 'ok' | 'error') => void
}

export function CloudTab({ auth, activeReport, onAddReport, onShowToast }: CloudTabProps) {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [cloudReports, setCloudReports] = useState<CloudReportMeta[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const list = await listReports()
      setCloudReports(list)
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (auth.user) fetchList()
    else setCloudReports([])
  }, [auth.user, fetchList])

  const handleSave = async () => {
    if (!activeReport) { onShowToast('Aucun rapport actif à sauvegarder', 'error'); return }
    setActionLoading('save')
    try {
      await saveReport(activeReport)
      onShowToast('Rapport sauvegardé dans le cloud')
      fetchList()
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDownload = async (id: string) => {
    setActionLoading(id)
    try {
      const data = await downloadReport(id)
      const added = onAddReport(data)
      if (!added) { onShowToast('Ce rapport est déjà chargé', 'error'); return; }
      onShowToast('Rapport importé depuis le cloud')
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce rapport du cloud ?')) return
    setActionLoading(id + '-del')
    try {
      await deleteSupabaseReport(id)
      setCloudReports(prev => prev.filter(r => r.id !== id))
      onShowToast('Rapport supprimé')
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (auth.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8">
      {/* Header */}
      {/* Header (Simplified since it's now in global Header) */}
      <div className="flex items-center justify-between bg-surf1 p-5 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
            <Cloud size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-serif">Cloud Storage</h2>
            <p className="text-[10px] text-text-dark uppercase tracking-widest">Gestion des rapports distants</p>
          </div>
        </div>
        {!auth.user && (
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-4 py-2 bg-gold text-bg font-bold rounded-xl text-sm hover:bg-gold-light transition-all"
          >
            Se connecter
          </button>
        )}
      </div>

      {!auth.user ? (
        <div className="bg-surf1 border border-border rounded-2xl p-12 text-center">
          <Cloud size={40} className="text-text-dark mx-auto mb-4" />
          <p className="text-text-dim text-sm mb-6">
            Connectez-vous pour sauvegarder et retrouver vos rapports depuis n'importe quel appareil.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 bg-gold text-bg font-bold rounded-xl hover:bg-gold-light transition-all"
          >
            Se connecter / Créer un compte
          </button>
        </div>
      ) : (
        <>
          {/* Save active report */}
          <div className="bg-surf1 border border-border rounded-2xl p-5">
            <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-3">
              Rapport actif
            </h3>
            {activeReport ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{activeReport.fileName || 'Rapport sans nom'}</p>
                  <p className="text-xs text-text-dim">{activeReport.periodStr} · {activeReport.establishmentName || '—'}</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={actionLoading === 'save'}
                  className="flex items-center gap-2 px-4 py-2 bg-gold text-bg font-bold rounded-xl text-sm hover:bg-gold-light transition-all disabled:opacity-50"
                >
                  {actionLoading === 'save'
                    ? <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                    : <Upload size={14} />}
                  Sauvegarder
                </button>
              </div>
            ) : (
              <p className="text-sm text-text-dim">Aucun rapport sélectionné.</p>
            )}
          </div>

          {/* Cloud reports list */}
          <div className="bg-surf1 border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest">
                Rapports sauvegardés ({cloudReports.length})
              </h3>
              <button
                onClick={fetchList}
                disabled={loadingList}
                className="p-1.5 text-text-dark hover:text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
                title="Rafraîchir"
              >
                <RefreshCw size={14} className={loadingList ? 'animate-spin' : ''} />
              </button>
            </div>

            {listError && (
              <div className="p-3 bg-red/10 border border-red/20 rounded-xl flex items-center gap-2 text-red text-xs mb-4">
                <AlertCircle size={14} /> {listError}
              </div>
            )}

            {loadingList ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cloudReports.length === 0 ? (
              <p className="text-sm text-text-dim text-center py-8">Aucun rapport sauvegardé.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                {cloudReports.map(r => (
                  <div key={r.id} className="group flex items-center justify-between p-3 bg-surf2 border border-transparent hover:border-border-hover rounded-xl transition-all">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-bold text-text truncate">{r.filename}</p>
                      <p className="text-[10px] text-text-dim">
                        {r.period_str && <span>{r.period_str} · </span>}
                        {r.establishment_name && <span>{r.establishment_name} · </span>}
                        <span>{new Date(r.upload_date).toLocaleDateString('fr-FR')}</span>
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(r.id)}
                        disabled={actionLoading === r.id}
                        className="p-1.5 text-text-dark hover:text-blue rounded-lg hover:bg-blue/10 transition-colors disabled:opacity-50"
                        title="Importer dans l'app"
                      >
                        {actionLoading === r.id
                          ? <div className="w-3 h-3 border border-blue border-t-transparent rounded-full animate-spin" />
                          : <Download size={13} />}
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={actionLoading === r.id + '-del'}
                        className="p-1.5 text-text-dark hover:text-red rounded-lg hover:bg-red/10 transition-colors disabled:opacity-50"
                        title="Supprimer du cloud"
                      >
                        {actionLoading === r.id + '-del'
                          ? <div className="w-3 h-3 border border-red border-t-transparent rounded-full animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            auth={auth}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => onShowToast('Connexion réussie')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
