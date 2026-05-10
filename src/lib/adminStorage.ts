import { supabase } from './supabaseClient'

export type UserRole = 'pending' | 'user' | 'admin'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

export async function getMyProfile(userId: string): Promise<UserProfile | null> {
  const client = requireClient()
  const { data, error } = await client
    .from('profiles')
    .select('id, email, role, approved_by, approved_at, created_at')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erreur profil : ${error.message}`)
  }
  return data as UserProfile
}

export async function listPendingUsers(): Promise<UserProfile[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('profiles')
    .select('id, email, role, approved_by, approved_at, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Erreur liste utilisateurs : ${error.message}`)
  return (data ?? []) as UserProfile[]
}

export async function approveUser(userId: string): Promise<void> {
  const client = requireClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const { error } = await client
    .from('profiles')
    .update({ role: 'user', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(`Erreur approbation : ${error.message}`)
}

export async function rejectUser(userId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client
    .from('profiles')
    .update({ role: 'pending' })
    .eq('id', userId)

  if (error) throw new Error(`Erreur rejet : ${error.message}`)
}

export async function promoteToAdmin(userId: string): Promise<void> {
  const client = requireClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Non connecté')

  const { error } = await client
    .from('profiles')
    .update({ role: 'admin', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(`Erreur promotion admin : ${error.message}`)
}

export async function revokeUser(userId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client
    .from('profiles')
    .update({ role: 'pending', approved_by: null, approved_at: null })
    .eq('id', userId)

  if (error) throw new Error(`Erreur révocation : ${error.message}`)
}

export interface AdminLog {
  id: string
  created_at: string
  user_email: string
  level: string
  context: string
  message: string
  metadata: any
}

export async function listAdminLogs(): Promise<AdminLog[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(`Erreur logs admin : ${error.message}`)
  return (data ?? []) as AdminLog[]
}
