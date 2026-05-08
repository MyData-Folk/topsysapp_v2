-- ============================================================
-- 001_availabilities.sql
-- Disponibilités hôtelières — versionnées par snapshot
-- ============================================================

-- Table hotels : un enregistrement par profil hôtel de l'app
create table if not exists public.hotels (
  id            text primary key,           -- = HotelConfig.id de l'app
  owner_id      uuid references auth.users not null,
  name          text not null,
  address       text default '',
  reference     text default '',
  total_capacity int default 0,
  types         jsonb default '[]',         -- snapshot RoomType[]
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Table availability_snapshots : un par import PDF/JSON
create table if not exists public.availability_snapshots (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      text references public.hotels not null,
  created_by    uuid references auth.users not null,
  import_date   timestamptz default now(),  -- quand l'app a poussé
  edition_date  text default '',            -- date d'édition du rapport PDF
  period_str    text default '',            -- ex: "du 01 Janv. au 31 Janv."
  filename      text default '',
  days_count    int default 0
);

-- Table availabilities : une ligne par jour par snapshot
create table if not exists public.availabilities (
  id            uuid primary key default gen_random_uuid(),
  snapshot_id   uuid references public.availability_snapshots on delete cascade not null,
  hotel_id      text references public.hotels not null,
  date          date not null,
  libres_total  int default 0,
  capacite      int default 0,
  prix          numeric(10,2) default 0,
  rooms         jsonb default '{}',  -- {DCLA:{occupied,libres}, DDLX:{...}}
  created_at    timestamptz default now()
);

-- Index pour les requêtes fréquentes
create index if not exists availabilities_hotel_date   on public.availabilities (hotel_id, date);
create index if not exists availabilities_snapshot      on public.availabilities (snapshot_id);
create index if not exists snapshots_hotel_import       on public.availability_snapshots (hotel_id, import_date desc);

-- Trigger updated_at sur hotels
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hotels_updated_at on public.hotels;
create trigger hotels_updated_at
  before update on public.hotels
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS : accès partagé — tout utilisateur authentifié peut
-- lire/écrire les hôtels et disponibilités
-- ============================================================

alter table public.hotels                  enable row level security;
alter table public.availability_snapshots  enable row level security;
alter table public.availabilities          enable row level security;

-- hotels : lecture publique (auth), écriture par owner ou tout auth
create policy "hotels_select" on public.hotels
  for select using (auth.role() = 'authenticated');

create policy "hotels_insert" on public.hotels
  for insert with check (auth.uid() = owner_id);

create policy "hotels_update" on public.hotels
  for update using (auth.role() = 'authenticated');

-- snapshots : tout utilisateur auth peut lire/écrire
create policy "snapshots_select" on public.availability_snapshots
  for select using (auth.role() = 'authenticated');

create policy "snapshots_insert" on public.availability_snapshots
  for insert with check (auth.uid() = created_by);

-- availabilities : tout utilisateur auth peut lire/écrire
create policy "avail_select" on public.availabilities
  for select using (auth.role() = 'authenticated');

create policy "avail_insert" on public.availabilities
  for insert with check (auth.role() = 'authenticated');
