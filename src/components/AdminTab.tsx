import React, { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Clock, UserCheck, UserX, Crown, RefreshCw, AlertCircle, Users } from 'lucide-react'
import { AuthState } from '../hooks/useAuth'
import { listPendingUsers, approveUser, rejectUser, promoteToAdmin, revokeUser, UserProfile, AdminLog, listAdminLogs } from '../lib/adminStorage'
import { cn } from '../utils/cn'
import { Terminal, Download } from 'lucide-react'

interface AdminTabProps {
  auth: AuthState
  onShowToast: (msg: string, type?: 'ok' | 'error') => void
}

const ROLE_LABELS: Record<string, string> = { pending: 'En attente', user: 'Utilisateur', admin: 'Admin' }
const ROLE_COLORS: Record<string, string> = {
  pending: 'bg-amber/10 text-amber border-amber/20',
  user: 'bg-blue/10 text-blue border-blue/20',
  admin: 'bg-green/10 text-green border-green/20',
}

export function AdminTab({ auth, onShowToast }: AdminTabProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listPendingUsers()
      setUsers(list)
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    try {
      await fn()
      onShowToast(successMsg)
      await fetchUsers()
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur', 'error')
    } finally {
      setActionId(null)
    }
  }

  const pending = users.filter(u => u.role === 'pending')
  const approved = users.filter(u => u.role === 'user')
  const admins = users.filter(u => u.role === 'admin')

  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const list = await listAdminLogs()
      setAdminLogs(list)
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Erreur logs', 'error')
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  useEffect(() => { 
    fetchUsers()
    fetchLogs()
  }, [fetchUsers, fetchLogs])

  if (!auth.isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center opacity-50">
        <ShieldCheck size={48} className="mx-auto mb-4" />
        <p className="text-sm font-bold">Accès réservé aux administrateurs.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between bg-surf1 p-5 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-serif font-bold flex items-center gap-3">
            <ShieldCheck size={22} className="text-gold" /> Administration
          </h2>
          <p className="text-xs text-text-dark mt-1">
            {pending.length} en attente · {approved.length} utilisateurs · {admins.length} admin{admins.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={fetchUsers} disabled={loading}
          className="p-2 text-text-dark hover:text-gold border border-border rounded-xl transition-all disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* En attente */}
      {pending.length > 0 && (
        <div className="bg-surf1 border border-amber/30 rounded-2xl p-5">
          <h3 className="text-[10px] font-bold text-amber uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock size={12} /> Demandes en attente ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map(u => (
              <UserRow key={u.id} user={u} isCurrentUser={u.id === auth.user?.id}
                actionId={actionId}
                actions={[
                  {
                    label: 'Approuver',
                    icon: UserCheck,
                    color: 'green',
                    onClick: () => { setActionId(u.id + '-approve'); runAction(() => approveUser(u.id), `${u.email} approuvé`) }
                  },
                  {
                    label: 'Refuser',
                    icon: UserX,
                    color: 'red',
                    onClick: () => { setActionId(u.id + '-reject'); runAction(() => rejectUser(u.id), `${u.email} refusé`) }
                  },
                ]}
              />
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && !loading && (
        <div className="flex items-center gap-3 p-4 bg-green/5 border border-green/20 rounded-2xl text-green text-xs">
          <UserCheck size={15} className="shrink-0" />
          Aucune demande en attente d'approbation.
        </div>
      )}

      {/* Utilisateurs approuvés */}
      {approved.length > 0 && (
        <div className="bg-surf1 border border-border rounded-2xl p-5">
          <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-4 flex items-center gap-2">
            <Users size={12} /> Utilisateurs ({approved.length})
          </h3>
          <div className="space-y-3">
            {approved.map(u => (
              <UserRow key={u.id} user={u} isCurrentUser={u.id === auth.user?.id}
                actionId={actionId}
                actions={[
                  {
                    label: 'Promouvoir Admin',
                    icon: Crown,
                    color: 'gold',
                    onClick: () => { setActionId(u.id + '-promote'); runAction(() => promoteToAdmin(u.id), `${u.email} promu admin`) }
                  },
                  {
                    label: 'Révoquer',
                    icon: UserX,
                    color: 'red',
                    onClick: () => { setActionId(u.id + '-revoke'); runAction(() => revokeUser(u.id), `${u.email} révoqué`) }
                  },
                ]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admins */}
      {admins.length > 0 && (
        <div className="bg-surf1 border border-border rounded-2xl p-5">
          <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldCheck size={12} className="text-green" /> Administrateurs ({admins.length})
          </h3>
          <div className="space-y-3">
            {admins.map(u => (
              <UserRow key={u.id} user={u} isCurrentUser={u.id === auth.user?.id}
                actionId={actionId}
                actions={u.id !== auth.user?.id ? [
                  {
                    label: 'Rétrograder',
                    icon: UserX,
                    color: 'red',
                    onClick: () => { setActionId(u.id + '-revoke'); runAction(() => revokeUser(u.id), `${u.email} rétrogradé`) }
                  },
                ] : []}
              />
            ))}
          </div>
        </div>
      )}

      {loading && users.length === 0 && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Logs d'audit */}
      <div className="bg-surf1 border border-border rounded-2xl overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-border">
          <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest flex items-center gap-2">
            <Terminal size={12} /> Logs d'Audit Système (Cloud)
          </h3>
          <button onClick={fetchLogs} disabled={loadingLogs}
            className="p-1.5 text-text-dark hover:text-gold transition-all">
            <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {adminLogs.length > 0 ? (
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="sticky top-0 bg-surf2 text-text-dark font-bold uppercase tracking-tight">
                <tr>
                  <th className="p-3 border-b border-border">Date</th>
                  <th className="p-3 border-b border-border">Utilisateur</th>
                  <th className="p-3 border-b border-border">Contexte</th>
                  <th className="p-3 border-b border-border">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {adminLogs.map(log => (
                  <tr key={log.id} className="hover:bg-surf2/50 transition-colors">
                    <td className="p-3 text-text-dim whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-bold text-gold truncate max-w-[120px]">{log.user_email}</td>
                    <td className="p-3"><span className="px-1.5 py-0.5 bg-surf3 rounded border border-border text-[9px]">{log.context}</span></td>
                    <td className="p-3 text-text-dark">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-text-dark italic text-xs">
              {loadingLogs ? 'Chargement des logs...' : 'Aucun log d\'audit disponible.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface Action {
  label: string
  icon: React.ComponentType<{ size?: number }>
  color: 'green' | 'red' | 'gold'
  onClick: () => void
}

interface UserRowProps {
  user: UserProfile;
  isCurrentUser: boolean;
  actionId: string | null;
  actions: Action[];
  key?: React.Key;
}

function UserRow({ user, isCurrentUser, actionId, actions }: UserRowProps) {
  const colorBtnMap = {
    green: 'text-text-dark hover:text-green hover:bg-green/10',
    red: 'text-text-dark hover:text-red hover:bg-red/10',
    gold: 'text-text-dark hover:text-gold hover:bg-gold/10',
  }
  return (
    <div className="flex items-center justify-between p-3 bg-surf2 border border-transparent hover:border-border-hover rounded-xl gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-text truncate">{user.email}</span>
          {isCurrentUser && <span className="text-[9px] text-text-dark">(vous)</span>}
          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border", ROLE_COLORS[user.role])}>
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <div className="text-[10px] text-text-dark mt-0.5">
          Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          {user.approved_at && ` · Approuvé le ${new Date(user.approved_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {actions.map(action => {
          const isLoading = actionId?.startsWith(user.id)
          return (
            <button key={action.label} onClick={action.onClick} disabled={!!isLoading}
              title={action.label}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-transparent transition-all disabled:opacity-50", colorBtnMap[action.color])}>
              {isLoading && actionId?.includes(action.label.toLowerCase().split(' ')[0])
                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <action.icon size={12} />}
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
