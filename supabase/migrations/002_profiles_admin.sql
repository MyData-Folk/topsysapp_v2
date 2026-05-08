-- ============================================================
-- 002_profiles_admin.sql
-- Profils utilisateurs, approbation d'inscription, rôles admin
-- ============================================================

-- Table profiles : un enregistrement par utilisateur Supabase
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  role          text not null default 'pending',   -- 'pending' | 'user' | 'admin'
  approved_by   uuid references auth.users,
  approved_at   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Trigger : crée automatiquement un profil 'pending' à chaque inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger updated_at sur profiles
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Tout utilisateur peut lire son propre profil
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

-- Les admins peuvent lire tous les profils
create policy "profiles_admin_select" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Les admins peuvent mettre à jour n'importe quel profil (approbation, rôle)
create policy "profiles_admin_update" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── RLS hotels/snapshots/availabilities : restreindre aux users approuvés ──

-- Remplacer les policies existantes pour exiger role IN ('user','admin')
drop policy if exists "hotels_select" on public.hotels;
drop policy if exists "hotels_insert" on public.hotels;
drop policy if exists "hotels_update" on public.hotels;
drop policy if exists "snapshots_select" on public.availability_snapshots;
drop policy if exists "snapshots_insert" on public.availability_snapshots;
drop policy if exists "avail_select" on public.availabilities;
drop policy if exists "avail_insert" on public.availabilities;

-- Fonction helper : vérifie que l'utilisateur courant est approuvé
create or replace function public.is_approved()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('user', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "hotels_select" on public.hotels
  for select using (public.is_approved());

create policy "hotels_insert" on public.hotels
  for insert with check (public.is_approved() and auth.uid() = owner_id);

create policy "hotels_update" on public.hotels
  for update using (public.is_approved());

create policy "snapshots_select" on public.availability_snapshots
  for select using (public.is_approved());

create policy "snapshots_insert" on public.availability_snapshots
  for insert with check (public.is_approved() and auth.uid() = created_by);

create policy "avail_select" on public.availabilities
  for select using (public.is_approved());

create policy "avail_insert" on public.availabilities
  for insert with check (public.is_approved());

-- RLS user_reports et user_config (cloud storage existant)
-- Déjà gérés par auth.role() = 'authenticated', on ne touche pas

-- ── Note : promouvoir le premier admin manuellement ─────────────────────────
-- Après avoir exécuté cette migration, promouvez votre compte admin via :
--
--   update public.profiles
--   set role = 'admin', approved_at = now()
--   where email = 'votre@email.com';
--
-- ─────────────────────────────────────────────────────────────────────────────
