import { useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Cloud, AlertCircle, Clock } from 'lucide-react'
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
  const [signedUp, setSignedUp] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password)
      } else {
        await auth.signUp(email, password)
        setSignedUp(true)
      }
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

        {/* Pending approval — shown after signup or when user is logged in but pending */}
        {(signedUp || (auth.user && auth.profile?.role === 'pending')) && (
          <div className="bg-surf1 border border-amber/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber/10 rounded-full flex items-center justify-center mx-auto">
              <Clock size={28} className="text-amber" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-text mb-2">Compte en attente</h3>
              <p className="text-sm text-text-dim leading-relaxed">
                Votre demande d'accès a bien été enregistrée. Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.
              </p>
            </div>
            <p className="text-xs text-text-dark">
              {signedUp ? `Compte créé pour ${email}.` : `Connecté en tant que ${auth.user?.email}.`}
            </p>
            {auth.user && (
              <button onClick={() => auth.signOut()}
                className="text-xs text-text-dim hover:text-text transition-colors underline">
                Se déconnecter
              </button>
            )}
          </div>
        )}

        {/* Form (only when Supabase is available and not pending) */}
        {supabaseAvailable && !signedUp && auth.profile?.role !== 'pending' && (
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
        {!signedUp && auth.profile?.role !== 'pending' && (
          <div className="text-center">
            <button onClick={onSkip} className="text-sm text-text-dim hover:text-text transition-colors">
              Continuer sans compte →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
