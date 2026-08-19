-- Party Padel — events table, security policies, and starting data.
--
-- Run this once in Supabase Dashboard > SQL Editor > New query, on a
-- fresh project. Safe to re-run — every statement is idempotent
-- (create-if-not-exists / drop-then-create for policies).
--
-- After running this, create the admin login separately in
-- Authentication > Users > Add user (email + password) — there's no
-- sign-up form anywhere on the site, so that's the only way in. Then
-- go to Authentication > Providers > Email and turn OFF "Allow new
-- users to sign up" — the anon key below is meant to be public
-- (that's how Supabase works), so this stops anyone who reads the
-- page source from registering their own account and getting write
-- access, since every write policy below only checks "is logged in
-- at all", not "is a specific person".

create table if not exists events (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  city                    text not null,
  event_date              date not null,
  event_time              text not null,           -- "18:00", 24hr, matches the site's display format
  venue                   text not null,
  address                 text not null,
  status                  text not null default 'coming-soon'
                            check (status in ('coming-soon','entries-open','limited','sold-out','completed')),
  players_entered         integer not null default 0,
  players_capacity        integer not null default 100,
  price_player            numeric not null,
  price_spectator         numeric not null,
  ticket_tailor_checkout_url text not null default '',  -- empty = site shows "Get Notified" instead of a broken link

  -- The rest of the site (play.html, format.html, the events filter
  -- chips) hardcodes exactly two divisions everywhere, so these are
  -- flattened columns rather than an open-ended list — there is no
  -- version of this site that knows what to do with a third division.
  beginners_skill_min     numeric not null default 1.0,
  beginners_skill_max     numeric not null default 2.5,
  beginners_spaces_left   integer not null default 50,
  advanced_skill_min      numeric not null default 3.0,
  advanced_skill_max      numeric not null default 5.0,
  advanced_spaces_left    integer not null default 50,

  -- Running order rows, e.g. [{"time":"18:00","label":"Check-in & warm-up"}, ...]
  -- Genuinely variable in count per event, unlike divisions, so this
  -- one stays a flexible jsonb array rather than fixed columns.
  schedule                jsonb not null default '[]'::jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Keep updated_at honest without every write having to set it by hand.
create or replace function set_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row
  execute function set_events_updated_at();

alter table events enable row level security;

-- Public read: the live site (index/events/event pages) has to be able
-- to load events for any visitor, logged in or not.
drop policy if exists "Public can read events" on events;
create policy "Public can read events"
  on events for select
  to anon, authenticated
  using (true);

-- Writes require a logged-in session. Single-admin site with no public
-- sign-up form, so "authenticated at all" is the whole access check —
-- see the note above about disabling public sign-up in Auth settings,
-- which is what actually keeps this narrow to just you.
drop policy if exists "Authenticated can insert events" on events;
create policy "Authenticated can insert events"
  on events for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update events" on events;
create policy "Authenticated can update events"
  on events for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete events" on events;
create policy "Authenticated can delete events"
  on events for delete
  to authenticated
  using (true);

-- Starting data — the 3 events that were previously hardcoded in
-- assets/data/events-data.js, carried over so the migration doesn't
-- lose anything. Safe to edit or delete afterwards from admin.html.
insert into events (
  slug, city, event_date, event_time, venue, address, status,
  players_entered, players_capacity, price_player, price_spectator,
  ticket_tailor_checkout_url,
  beginners_skill_min, beginners_skill_max, beginners_spaces_left,
  advanced_skill_min, advanced_skill_max, advanced_spaces_left,
  schedule
) values
  (
    'london-2026-09-14', 'London', '2026-09-14', '18:00',
    'Shoreditch Padel Club', 'Shoreditch, London', 'sold-out',
    100, 100, 32, 15, '',
    1.0, 2.5, 0,
    3.0, 5.0, 0,
    '[
      {"time":"18:00","label":"Check-in & warm-up"},
      {"time":"19:00","label":"Rotating rounds begin"},
      {"time":"21:30","label":"Finals — feature court"},
      {"time":"22:30","label":"Presentation & afterparty"}
    ]'::jsonb
  ),
  (
    'manchester-2026-09-27', 'Manchester', '2026-09-27', '18:30',
    'Padel House', 'Manchester City Centre', 'sold-out',
    100, 100, 32, 15, '',
    1.0, 2.5, 0,
    3.0, 5.0, 0,
    '[
      {"time":"18:30","label":"Check-in & warm-up"},
      {"time":"19:30","label":"Rotating rounds begin"},
      {"time":"22:00","label":"Finals — feature court"},
      {"time":"23:00","label":"Presentation & afterparty"}
    ]'::jsonb
  ),
  (
    'bristol-2026-10-11', 'Bristol', '2026-10-11', '17:00',
    'Harbourside Courts', 'Harbourside, Bristol', 'sold-out',
    100, 100, 32, 15, '',
    1.0, 2.5, 0,
    3.0, 5.0, 0,
    '[
      {"time":"17:00","label":"Check-in & warm-up"},
      {"time":"18:00","label":"Rotating rounds begin"},
      {"time":"20:30","label":"Finals — feature court"},
      {"time":"21:30","label":"Presentation & afterparty"}
    ]'::jsonb
  )
on conflict (slug) do nothing;
