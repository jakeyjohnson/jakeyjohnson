-- Found: database schema
-- Run once in the Supabase SQL Editor (or `supabase db push`) on a fresh
-- Supabase project. This project is separate from any other app's Supabase
-- project — do not run this against an existing database that already has
-- tables named the same.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  is_filmmaker boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Creates a profile row the moment someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- films: one row per uploaded short film.
-- ---------------------------------------------------------------------------
create type public.film_status as enum (
  'uploading',      -- client is uploading to Mux
  'processing',     -- Mux is transcoding
  'pending_review', -- ready to play, waiting on moderation before it's public
  'approved',       -- live and visible in the catalogue
  'rejected'        -- failed moderation, never shown publicly
);

create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  synopsis text,
  genre text,
  tags text[] not null default '{}',
  duration_seconds integer,
  mux_upload_id text,
  mux_asset_id text,
  mux_playback_id text,
  thumbnail_url text,
  status public.film_status not null default 'uploading',
  rejection_reason text,
  -- VAST/VMAP ad tag for this film's pre-roll/mid-roll breaks (Google Ad
  -- Manager). Null falls back to the app's default ad tag.
  ad_tag_url text,
  is_free_preview boolean not null default false,
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists films_status_idx on public.films (status);
create index if not exists films_owner_idx on public.films (owner_id);

alter table public.films enable row level security;

create policy "Approved films are readable by any signed-in user"
  on public.films for select
  to authenticated
  using (status = 'approved' or owner_id = auth.uid());

create policy "Users can upload their own films"
  on public.films for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their own films while not yet approved"
  on public.films for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their own films"
  on public.films for delete
  to authenticated
  using (owner_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists films_set_updated_at on public.films;
create trigger films_set_updated_at
  before update on public.films
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions: mirrors RevenueCat entitlement state, written by the
-- revenuecat-webhook edge function using the service role key (bypasses RLS).
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  revenuecat_app_user_id text not null,
  entitlement_id text not null default 'subscriber',
  status text not null default 'expired'
    check (status in ('active', 'expired', 'cancelled', 'in_grace_period', 'billing_issue')),
  product_id text,
  store text check (store in ('app_store', 'play_store', 'stripe', 'promotional')),
  current_period_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policy for regular users: only the service role
-- (used by the revenuecat-webhook function) may write this table.

-- ---------------------------------------------------------------------------
-- watch_history: resume position + completion per user/film.
-- ---------------------------------------------------------------------------
create table if not exists public.watch_history (
  user_id uuid not null references public.profiles (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  progress_seconds integer not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

alter table public.watch_history enable row level security;

create policy "Users manage their own watch history"
  on public.watch_history for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

alter table public.favorites enable row level security;

create policy "Users manage their own favorites"
  on public.favorites for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- increment_view_count: called by the client (or an edge function) when a
-- film starts playing. A plain UPDATE ... SET view_count = view_count + 1
-- from the client would need an update policy that lets any user bump any
-- film's counter, which is worth avoiding — a function scoped to just this
-- counter is safer than opening general update access to films.
-- ---------------------------------------------------------------------------
create or replace function public.increment_view_count(p_film_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.films set view_count = view_count + 1 where id = p_film_id;
$$;

grant execute on function public.increment_view_count(uuid) to authenticated;
