-- Party Padel — events table, security policies, and starting data.
--
-- Run this once in Supabase Dashboard > SQL Editor > New query, on a
-- fresh project. Safe to re-run on an existing project too — every
-- statement is idempotent (create-if-not-exists / drop-then-create /
-- add-or-drop-column-if-(not-)exists), and includes a migration for
-- sites that ran an earlier version of this script with fixed
-- Beginners/Advanced columns instead of the current custom "leagues"
-- list — see the migration block below the table definition.
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

  -- Custom leagues for this event — e.g. [{"name":"Beginners",
  -- "requirements":"Self-rated 1.0–2.5","spacesLeft":50}, ...]. Each
  -- league is a free-text name + free-text requirements (not tied to
  -- any fixed skill scale) + a numeric spacesLeft that drives the
  -- "Full" vs "X spaces left" status on-site. admin.html caps this at
  -- 6 leagues per event — not enforced here, since jsonb can't carry
  -- an array-length check as a simple column constraint.
  leagues                 jsonb not null default '[]'::jsonb,

  -- Running order rows, e.g. [{"time":"18:00","label":"Check-in & warm-up"}, ...]
  schedule                jsonb not null default '[]'::jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- create table if not exists is a no-op on a table that already
-- exists — which is exactly the case for a project migrating from an
-- earlier version of this script, so the leagues column from the
-- table definition above never actually lands on it without this.
alter table events add column if not exists leagues jsonb not null default '[]'::jsonb;

-- Migration for a project that already ran an earlier version of this
-- script (fixed beginners_*/advanced_* columns). Backfills the leagues
-- column just added from the old columns' data if they're still
-- present, then drops them. No-ops cleanly on a brand-new project
-- that never had those columns, and no-ops on a project that's
-- already been migrated (leagues already populated, old columns gone).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'events' and column_name = 'beginners_skill_min'
  ) then
    update events set leagues = jsonb_build_array(
      jsonb_build_object(
        'name', 'Beginners',
        'requirements', 'Self-rated ' || beginners_skill_min || '–' || beginners_skill_max,
        'spacesLeft', beginners_spaces_left
      ),
      jsonb_build_object(
        'name', 'Advanced',
        'requirements', 'Self-rated ' || advanced_skill_min || '–' || advanced_skill_max,
        'spacesLeft', advanced_spaces_left
      )
    )
    where leagues = '[]'::jsonb;

    alter table events
      drop column if exists beginners_skill_min,
      drop column if exists beginners_skill_max,
      drop column if exists beginners_spaces_left,
      drop column if exists advanced_skill_min,
      drop column if exists advanced_skill_max,
      drop column if exists advanced_spaces_left;
  end if;
end $$;

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
  ticket_tailor_checkout_url, leagues, schedule
) values
  (
    'london-2026-09-14', 'London', '2026-09-14', '18:00',
    'Shoreditch Padel Club', 'Shoreditch, London', 'sold-out',
    100, 100, 32, 15, '',
    '[
      {"name":"Beginners","requirements":"Self-rated 1.0–2.5 — new to padel or still finding your feet","spacesLeft":0},
      {"name":"Advanced","requirements":"Self-rated 3.0–5.0 — regular players who want every round to test them","spacesLeft":0}
    ]'::jsonb,
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
    '[
      {"name":"Beginners","requirements":"Self-rated 1.0–2.5 — new to padel or still finding your feet","spacesLeft":0},
      {"name":"Advanced","requirements":"Self-rated 3.0–5.0 — regular players who want every round to test them","spacesLeft":0}
    ]'::jsonb,
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
    '[
      {"name":"Beginners","requirements":"Self-rated 1.0–2.5 — new to padel or still finding your feet","spacesLeft":0},
      {"name":"Advanced","requirements":"Self-rated 3.0–5.0 — regular players who want every round to test them","spacesLeft":0}
    ]'::jsonb,
    '[
      {"time":"17:00","label":"Check-in & warm-up"},
      {"time":"18:00","label":"Rotating rounds begin"},
      {"time":"20:30","label":"Finals — feature court"},
      {"time":"21:30","label":"Presentation & afterparty"}
    ]'::jsonb
  )
on conflict (slug) do nothing;

-- ============================================================
-- Players & fixtures — Americano-format live scoring
--
-- Party Padel plays Americano: at each event, players rotate partners
-- every round (never the same fixed pair all night), and the
-- leaderboard is an individual points tally — each player's score is
-- whatever their pair scored in every round they played, added up —
-- not a team win/loss table. So fixtures reference real player rows,
-- and admin.html generates the whole round/court schedule at once
-- (see assets/js/fixtures.js — same code, whether it's building this
-- seed data or running live from the "Generate Fixtures" button).
--
-- This replaces an earlier, short-lived version of this section that
-- modelled fixtures as two free-text "teams" sharing one score — that
-- didn't fit Americano rules at all, so if your project already ran
-- that version, this drops it and starts over. There was nothing
-- worth migrating (free-text team names can't be mapped onto
-- individual players).
-- ============================================================

drop table if exists fixtures;

create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  league_name text not null,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists players_event_id_idx on players (event_id);

alter table players enable row level security;

drop policy if exists "Public can read players" on players;
create policy "Public can read players"
  on players for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can insert players" on players;
create policy "Authenticated can insert players"
  on players for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update players" on players;
create policy "Authenticated can update players"
  on players for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete players" on players;
create policy "Authenticated can delete players"
  on players for delete
  to authenticated
  using (true);

create table if not exists fixtures (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  league_name   text not null,
  round_number  integer not null,
  court_number  integer not null,
  -- The 4 players on court for this match — 2 rotating partnerships,
  -- not fixed teams. Cascades on player delete: removing someone from
  -- the roster also removes any match they're part of, since a
  -- 3-player match isn't a valid fixture.
  player_a1     uuid not null references players(id) on delete cascade,
  player_a2     uuid not null references players(id) on delete cascade,
  player_b1     uuid not null references players(id) on delete cascade,
  player_b2     uuid not null references players(id) on delete cascade,
  score_a       integer,
  score_b       integer,
  status        text not null default 'scheduled'
                  check (status in ('scheduled','live','completed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists fixtures_event_id_idx on fixtures (event_id);

create or replace function set_fixtures_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fixtures_set_updated_at on fixtures;
create trigger fixtures_set_updated_at
  before update on fixtures
  for each row
  execute function set_fixtures_updated_at();

alter table fixtures enable row level security;

drop policy if exists "Public can read fixtures" on fixtures;
create policy "Public can read fixtures"
  on fixtures for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can insert fixtures" on fixtures;
create policy "Authenticated can insert fixtures"
  on fixtures for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update fixtures" on fixtures;
create policy "Authenticated can update fixtures"
  on fixtures for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete fixtures" on fixtures;
create policy "Authenticated can delete fixtures"
  on fixtures for delete
  to authenticated
  using (true);

-- Turns on Supabase's realtime feed for this table, so results.html can
-- update the second a score is saved in admin.html instead of waiting
-- on a page refresh. No-ops if it's already on (re-running this script
-- on a project that's already been migrated).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'fixtures'
  ) then
    alter publication supabase_realtime add table fixtures;
  end if;
end $$;

-- Demo schedule: 50 players in Manchester's Beginners league ("Player
-- 1".."Player 50" — swap in real names any time from admin.html, no
-- need to touch the schedule), with a fixture list already generated
-- (6 courts, 8 rounds — everyone plays 3 or 4 times) ready to fill
-- scores in as matches happen. This is exactly what clicking
-- "+ Add Players" then "Generate Fixtures" does live — just pre-run
-- once so there's a working example to look at immediately. Every
-- score is left blank; nothing is fabricated.
do $$
declare
  v_event_id uuid;
begin
  select id into v_event_id from events where slug = 'manchester-2026-09-27';

  if v_event_id is not null and not exists (
    select 1 from players where event_id = v_event_id and league_name = 'Beginners'
  ) then

    insert into players (id, event_id, league_name, name, sort_order) values
      ('dcfe04d7-1df1-47c7-a705-cf9cf6f7fdc6', v_event_id, 'Beginners', 'Player 1', 0),
      ('83c2d463-7674-4971-9eda-d3a6f5dcc7c4', v_event_id, 'Beginners', 'Player 2', 1),
      ('edfa1f50-46c5-4cc5-a7c3-e4b8a3ed47e9', v_event_id, 'Beginners', 'Player 3', 2),
      ('be99096c-f5c8-423c-a486-d868de646b15', v_event_id, 'Beginners', 'Player 4', 3),
      ('d77df1a3-b59e-4339-8550-41cf5a172bf5', v_event_id, 'Beginners', 'Player 5', 4),
      ('d9d3530d-c447-4d4c-80cc-8ba853f4fe5f', v_event_id, 'Beginners', 'Player 6', 5),
      ('fdf704f9-61ac-4a00-bc6f-c94680c53e10', v_event_id, 'Beginners', 'Player 7', 6),
      ('3347f573-aac8-43a5-bfe3-306271d06ee5', v_event_id, 'Beginners', 'Player 8', 7),
      ('d91e5aa3-3869-4ad2-8826-e25970041f83', v_event_id, 'Beginners', 'Player 9', 8),
      ('821a9f90-bac5-4434-8db1-0ae555801383', v_event_id, 'Beginners', 'Player 10', 9),
      ('2dfecdfd-3087-40b2-89ef-f75a05b1e0fb', v_event_id, 'Beginners', 'Player 11', 10),
      ('e72c7fc3-0b94-4349-ae4f-400e036690d4', v_event_id, 'Beginners', 'Player 12', 11),
      ('97a3533e-72c5-4d67-8f15-433fca3b9c9b', v_event_id, 'Beginners', 'Player 13', 12),
      ('af8e0f4f-9429-4758-8c1e-12a3ee1b8d5a', v_event_id, 'Beginners', 'Player 14', 13),
      ('ee96aa7e-0ad3-4cc8-b9fd-ae57b21965a7', v_event_id, 'Beginners', 'Player 15', 14),
      ('99395fe5-d093-4506-987b-b579d555ff01', v_event_id, 'Beginners', 'Player 16', 15),
      ('93b26d2d-087e-4abb-bdc9-26b53e202acb', v_event_id, 'Beginners', 'Player 17', 16),
      ('3a5fedb4-f50d-45c5-8b09-d0164240f228', v_event_id, 'Beginners', 'Player 18', 17),
      ('8e69f2b8-ccaa-447b-b4e6-b058fc118969', v_event_id, 'Beginners', 'Player 19', 18),
      ('782e79a6-a7b4-4f0d-a38b-99c81b7a10a2', v_event_id, 'Beginners', 'Player 20', 19),
      ('20b379e1-2224-4220-aeef-b017691582fa', v_event_id, 'Beginners', 'Player 21', 20),
      ('a710be1d-60a7-4ed1-ac31-fa771a04ddf2', v_event_id, 'Beginners', 'Player 22', 21),
      ('79278b1f-ca99-45fc-ac50-86874fc661d1', v_event_id, 'Beginners', 'Player 23', 22),
      ('064aa3ce-21a5-47b1-acc6-42b7f3a2b19e', v_event_id, 'Beginners', 'Player 24', 23),
      ('68c9f25e-d85e-423b-bef4-fe02a1b4381b', v_event_id, 'Beginners', 'Player 25', 24),
      ('2b555c93-f435-4fc8-8840-a3cd7d4e966d', v_event_id, 'Beginners', 'Player 26', 25),
      ('3b37fc84-299a-40fb-ac46-f05986049919', v_event_id, 'Beginners', 'Player 27', 26),
      ('a27d6e4b-d84c-4071-aaa7-880505df055e', v_event_id, 'Beginners', 'Player 28', 27),
      ('9da218f5-939f-4cf4-b8e4-955aa8b44d14', v_event_id, 'Beginners', 'Player 29', 28),
      ('149ebb75-b835-4426-a289-2af55cd238a5', v_event_id, 'Beginners', 'Player 30', 29),
      ('c4e842ca-03d8-446c-8bc3-a607de53b233', v_event_id, 'Beginners', 'Player 31', 30),
      ('8d628b74-0993-40d0-b5d7-ce12c75854aa', v_event_id, 'Beginners', 'Player 32', 31),
      ('4d75de98-f85b-4489-a5b2-edaa1a338851', v_event_id, 'Beginners', 'Player 33', 32),
      ('6cf3527d-0114-4b7e-a303-4a8b6cec6acc', v_event_id, 'Beginners', 'Player 34', 33),
      ('9c76e46c-5e50-4e5a-be41-bf42d0831f3f', v_event_id, 'Beginners', 'Player 35', 34),
      ('9b6d2db0-c149-4436-849e-6140281f5cec', v_event_id, 'Beginners', 'Player 36', 35),
      ('71001b09-7b8f-4f1c-a555-fe9823c40355', v_event_id, 'Beginners', 'Player 37', 36),
      ('6174beda-f250-4c1b-8289-f0e107a23b6b', v_event_id, 'Beginners', 'Player 38', 37),
      ('c601d61e-4511-419a-bae4-e96332b22676', v_event_id, 'Beginners', 'Player 39', 38),
      ('6656e318-535c-4f09-8776-9a7ec4b06f2f', v_event_id, 'Beginners', 'Player 40', 39),
      ('06fb6fcd-08b2-4e73-8796-eb54cc78510b', v_event_id, 'Beginners', 'Player 41', 40),
      ('1693f632-ce36-48b7-8f4c-31a130757823', v_event_id, 'Beginners', 'Player 42', 41),
      ('f3877f99-2118-41b0-9357-7f2886e34a9e', v_event_id, 'Beginners', 'Player 43', 42),
      ('cc8d7051-d062-4c71-890f-70a8b6805676', v_event_id, 'Beginners', 'Player 44', 43),
      ('fa834ded-b00b-49fc-933d-88f78be35546', v_event_id, 'Beginners', 'Player 45', 44),
      ('e59c11de-8b07-473b-b138-b6eee6e04313', v_event_id, 'Beginners', 'Player 46', 45),
      ('48926f49-95d7-41ef-97e6-4a97267e312a', v_event_id, 'Beginners', 'Player 47', 46),
      ('84690649-27fe-444e-afec-8c65fda9371a', v_event_id, 'Beginners', 'Player 48', 47),
      ('8d6e9b22-1455-4edb-9506-5a379ee3a06a', v_event_id, 'Beginners', 'Player 49', 48),
      ('f434b897-1d32-47df-ab7e-0db3aa320ea4', v_event_id, 'Beginners', 'Player 50', 49);

    insert into fixtures (event_id, league_name, round_number, court_number, player_a1, player_a2, player_b1, player_b2, status) values
      (v_event_id, 'Beginners', 1, 1, '8e69f2b8-ccaa-447b-b4e6-b058fc118969', '20b379e1-2224-4220-aeef-b017691582fa', '6656e318-535c-4f09-8776-9a7ec4b06f2f', 'fdf704f9-61ac-4a00-bc6f-c94680c53e10', 'scheduled'),
      (v_event_id, 'Beginners', 1, 2, 'd9d3530d-c447-4d4c-80cc-8ba853f4fe5f', '99395fe5-d093-4506-987b-b579d555ff01', 'f3877f99-2118-41b0-9357-7f2886e34a9e', '9da218f5-939f-4cf4-b8e4-955aa8b44d14', 'scheduled'),
      (v_event_id, 'Beginners', 1, 3, '2b555c93-f435-4fc8-8840-a3cd7d4e966d', 'd77df1a3-b59e-4339-8550-41cf5a172bf5', '06fb6fcd-08b2-4e73-8796-eb54cc78510b', 'a27d6e4b-d84c-4071-aaa7-880505df055e', 'scheduled'),
      (v_event_id, 'Beginners', 1, 4, '1693f632-ce36-48b7-8f4c-31a130757823', '48926f49-95d7-41ef-97e6-4a97267e312a', '821a9f90-bac5-4434-8db1-0ae555801383', 'edfa1f50-46c5-4cc5-a7c3-e4b8a3ed47e9', 'scheduled'),
      (v_event_id, 'Beginners', 1, 5, '6174beda-f250-4c1b-8289-f0e107a23b6b', 'f434b897-1d32-47df-ab7e-0db3aa320ea4', '4d75de98-f85b-4489-a5b2-edaa1a338851', '149ebb75-b835-4426-a289-2af55cd238a5', 'scheduled'),
      (v_event_id, 'Beginners', 1, 6, 'af8e0f4f-9429-4758-8c1e-12a3ee1b8d5a', 'c601d61e-4511-419a-bae4-e96332b22676', 'e72c7fc3-0b94-4349-ae4f-400e036690d4', 'ee96aa7e-0ad3-4cc8-b9fd-ae57b21965a7', 'scheduled'),
      (v_event_id, 'Beginners', 2, 1, 'dcfe04d7-1df1-47c7-a705-cf9cf6f7fdc6', '3b37fc84-299a-40fb-ac46-f05986049919', '782e79a6-a7b4-4f0d-a38b-99c81b7a10a2', '2dfecdfd-3087-40b2-89ef-f75a05b1e0fb', 'scheduled'),
      (v_event_id, 'Beginners', 2, 2, '68c9f25e-d85e-423b-bef4-fe02a1b4381b', '6cf3527d-0114-4b7e-a303-4a8b6cec6acc', '71001b09-7b8f-4f1c-a555-fe9823c40355', '9c76e46c-5e50-4e5a-be41-bf42d0831f3f', 'scheduled'),
      (v_event_id, 'Beginners', 2, 3, '97a3533e-72c5-4d67-8f15-433fca3b9c9b', '84690649-27fe-444e-afec-8c65fda9371a', 'be99096c-f5c8-423c-a486-d868de646b15', '83c2d463-7674-4971-9eda-d3a6f5dcc7c4', 'scheduled'),
      (v_event_id, 'Beginners', 2, 4, '9b6d2db0-c149-4436-849e-6140281f5cec', '8d6e9b22-1455-4edb-9506-5a379ee3a06a', '79278b1f-ca99-45fc-ac50-86874fc661d1', '3347f573-aac8-43a5-bfe3-306271d06ee5', 'scheduled'),
      (v_event_id, 'Beginners', 2, 5, 'e59c11de-8b07-473b-b138-b6eee6e04313', 'cc8d7051-d062-4c71-890f-70a8b6805676', '93b26d2d-087e-4abb-bdc9-26b53e202acb', 'c4e842ca-03d8-446c-8bc3-a607de53b233', 'scheduled'),
      (v_event_id, 'Beginners', 2, 6, '3a5fedb4-f50d-45c5-8b09-d0164240f228', '8d628b74-0993-40d0-b5d7-ce12c75854aa', 'a710be1d-60a7-4ed1-ac31-fa771a04ddf2', '064aa3ce-21a5-47b1-acc6-42b7f3a2b19e', 'scheduled'),
      (v_event_id, 'Beginners', 3, 1, 'd91e5aa3-3869-4ad2-8826-e25970041f83', 'fa834ded-b00b-49fc-933d-88f78be35546', 'cc8d7051-d062-4c71-890f-70a8b6805676', '3347f573-aac8-43a5-bfe3-306271d06ee5', 'scheduled'),
      (v_event_id, 'Beginners', 3, 2, '821a9f90-bac5-4434-8db1-0ae555801383', 'a710be1d-60a7-4ed1-ac31-fa771a04ddf2', '8d6e9b22-1455-4edb-9506-5a379ee3a06a', '68c9f25e-d85e-423b-bef4-fe02a1b4381b', 'scheduled'),
      (v_event_id, 'Beginners', 3, 3, 'be99096c-f5c8-423c-a486-d868de646b15', '782e79a6-a7b4-4f0d-a38b-99c81b7a10a2', 'fdf704f9-61ac-4a00-bc6f-c94680c53e10', 'a27d6e4b-d84c-4071-aaa7-880505df055e', 'scheduled'),
      (v_event_id, 'Beginners', 3, 4, '9c76e46c-5e50-4e5a-be41-bf42d0831f3f', '99395fe5-d093-4506-987b-b579d555ff01', '6656e318-535c-4f09-8776-9a7ec4b06f2f', '8e69f2b8-ccaa-447b-b4e6-b058fc118969', 'scheduled'),
      (v_event_id, 'Beginners', 3, 5, 'f3877f99-2118-41b0-9357-7f2886e34a9e', '2b555c93-f435-4fc8-8840-a3cd7d4e966d', 'af8e0f4f-9429-4758-8c1e-12a3ee1b8d5a', 'dcfe04d7-1df1-47c7-a705-cf9cf6f7fdc6', 'scheduled'),
      (v_event_id, 'Beginners', 3, 6, 'ee96aa7e-0ad3-4cc8-b9fd-ae57b21965a7', 'f434b897-1d32-47df-ab7e-0db3aa320ea4', '064aa3ce-21a5-47b1-acc6-42b7f3a2b19e', '71001b09-7b8f-4f1c-a555-fe9823c40355', 'scheduled'),
      (v_event_id, 'Beginners', 4, 1, '48926f49-95d7-41ef-97e6-4a97267e312a', '6cf3527d-0114-4b7e-a303-4a8b6cec6acc', 'c601d61e-4511-419a-bae4-e96332b22676', 'd9d3530d-c447-4d4c-80cc-8ba853f4fe5f', 'scheduled'),
      (v_event_id, 'Beginners', 4, 2, 'd91e5aa3-3869-4ad2-8826-e25970041f83', 'e59c11de-8b07-473b-b138-b6eee6e04313', '97a3533e-72c5-4d67-8f15-433fca3b9c9b', '83c2d463-7674-4971-9eda-d3a6f5dcc7c4', 'scheduled'),
      (v_event_id, 'Beginners', 4, 3, '8d628b74-0993-40d0-b5d7-ce12c75854aa', 'e72c7fc3-0b94-4349-ae4f-400e036690d4', '79278b1f-ca99-45fc-ac50-86874fc661d1', '06fb6fcd-08b2-4e73-8796-eb54cc78510b', 'scheduled'),
      (v_event_id, 'Beginners', 4, 4, '93b26d2d-087e-4abb-bdc9-26b53e202acb', '1693f632-ce36-48b7-8f4c-31a130757823', '6174beda-f250-4c1b-8289-f0e107a23b6b', '3a5fedb4-f50d-45c5-8b09-d0164240f228', 'scheduled'),
      (v_event_id, 'Beginners', 4, 5, '9da218f5-939f-4cf4-b8e4-955aa8b44d14', '4d75de98-f85b-4489-a5b2-edaa1a338851', 'edfa1f50-46c5-4cc5-a7c3-e4b8a3ed47e9', '84690649-27fe-444e-afec-8c65fda9371a', 'scheduled'),
      (v_event_id, 'Beginners', 4, 6, '149ebb75-b835-4426-a289-2af55cd238a5', '20b379e1-2224-4220-aeef-b017691582fa', '9b6d2db0-c149-4436-849e-6140281f5cec', 'fa834ded-b00b-49fc-933d-88f78be35546', 'scheduled'),
      (v_event_id, 'Beginners', 5, 1, 'c4e842ca-03d8-446c-8bc3-a607de53b233', 'd77df1a3-b59e-4339-8550-41cf5a172bf5', '2dfecdfd-3087-40b2-89ef-f75a05b1e0fb', '3b37fc84-299a-40fb-ac46-f05986049919', 'scheduled'),
      (v_event_id, 'Beginners', 5, 2, '9c76e46c-5e50-4e5a-be41-bf42d0831f3f', '8d628b74-0993-40d0-b5d7-ce12c75854aa', '2b555c93-f435-4fc8-8840-a3cd7d4e966d', '20b379e1-2224-4220-aeef-b017691582fa', 'scheduled'),
      (v_event_id, 'Beginners', 5, 3, '83c2d463-7674-4971-9eda-d3a6f5dcc7c4', 'fa834ded-b00b-49fc-933d-88f78be35546', 'fdf704f9-61ac-4a00-bc6f-c94680c53e10', 'ee96aa7e-0ad3-4cc8-b9fd-ae57b21965a7', 'scheduled'),
      (v_event_id, 'Beginners', 5, 4, 'a27d6e4b-d84c-4071-aaa7-880505df055e', '064aa3ce-21a5-47b1-acc6-42b7f3a2b19e', 'a710be1d-60a7-4ed1-ac31-fa771a04ddf2', 'af8e0f4f-9429-4758-8c1e-12a3ee1b8d5a', 'scheduled'),
      (v_event_id, 'Beginners', 5, 5, 'e59c11de-8b07-473b-b138-b6eee6e04313', 'c601d61e-4511-419a-bae4-e96332b22676', 'cc8d7051-d062-4c71-890f-70a8b6805676', '99395fe5-d093-4506-987b-b579d555ff01', 'scheduled'),
      (v_event_id, 'Beginners', 5, 6, '6174beda-f250-4c1b-8289-f0e107a23b6b', 'e72c7fc3-0b94-4349-ae4f-400e036690d4', 'f434b897-1d32-47df-ab7e-0db3aa320ea4', 'dcfe04d7-1df1-47c7-a705-cf9cf6f7fdc6', 'scheduled'),
      (v_event_id, 'Beginners', 6, 1, '6cf3527d-0114-4b7e-a303-4a8b6cec6acc', 'edfa1f50-46c5-4cc5-a7c3-e4b8a3ed47e9', 'c4e842ca-03d8-446c-8bc3-a607de53b233', '06fb6fcd-08b2-4e73-8796-eb54cc78510b', 'scheduled'),
      (v_event_id, 'Beginners', 6, 2, '84690649-27fe-444e-afec-8c65fda9371a', '1693f632-ce36-48b7-8f4c-31a130757823', '8e69f2b8-ccaa-447b-b4e6-b058fc118969', 'f3877f99-2118-41b0-9357-7f2886e34a9e', 'scheduled'),
      (v_event_id, 'Beginners', 6, 3, '97a3533e-72c5-4d67-8f15-433fca3b9c9b', '71001b09-7b8f-4f1c-a555-fe9823c40355', '3a5fedb4-f50d-45c5-8b09-d0164240f228', '782e79a6-a7b4-4f0d-a38b-99c81b7a10a2', 'scheduled'),
      (v_event_id, 'Beginners', 6, 4, '4d75de98-f85b-4489-a5b2-edaa1a338851', '3b37fc84-299a-40fb-ac46-f05986049919', '9da218f5-939f-4cf4-b8e4-955aa8b44d14', '93b26d2d-087e-4abb-bdc9-26b53e202acb', 'scheduled'),
      (v_event_id, 'Beginners', 6, 5, 'd77df1a3-b59e-4339-8550-41cf5a172bf5', '8d6e9b22-1455-4edb-9506-5a379ee3a06a', '3347f573-aac8-43a5-bfe3-306271d06ee5', '9b6d2db0-c149-4436-849e-6140281f5cec', 'scheduled'),
      (v_event_id, 'Beginners', 6, 6, '2dfecdfd-3087-40b2-89ef-f75a05b1e0fb', '79278b1f-ca99-45fc-ac50-86874fc661d1', '6656e318-535c-4f09-8776-9a7ec4b06f2f', 'be99096c-f5c8-423c-a486-d868de646b15', 'scheduled'),
      (v_event_id, 'Beginners', 7, 1, '821a9f90-bac5-4434-8db1-0ae555801383', '48926f49-95d7-41ef-97e6-4a97267e312a', 'd91e5aa3-3869-4ad2-8826-e25970041f83', '149ebb75-b835-4426-a289-2af55cd238a5', 'scheduled'),
      (v_event_id, 'Beginners', 7, 2, '68c9f25e-d85e-423b-bef4-fe02a1b4381b', 'd9d3530d-c447-4d4c-80cc-8ba853f4fe5f', '2dfecdfd-3087-40b2-89ef-f75a05b1e0fb', '2b555c93-f435-4fc8-8840-a3cd7d4e966d', 'scheduled'),
      (v_event_id, 'Beginners', 7, 3, '71001b09-7b8f-4f1c-a555-fe9823c40355', '782e79a6-a7b4-4f0d-a38b-99c81b7a10a2', '8d628b74-0993-40d0-b5d7-ce12c75854aa', '6656e318-535c-4f09-8776-9a7ec4b06f2f', 'scheduled'),
      (v_event_id, 'Beginners', 7, 4, '4d75de98-f85b-4489-a5b2-edaa1a338851', '20b379e1-2224-4220-aeef-b017691582fa', '99395fe5-d093-4506-987b-b579d555ff01', 'a27d6e4b-d84c-4071-aaa7-880505df055e', 'scheduled'),
      (v_event_id, 'Beginners', 7, 5, 'edfa1f50-46c5-4cc5-a7c3-e4b8a3ed47e9', '9c76e46c-5e50-4e5a-be41-bf42d0831f3f', '97a3533e-72c5-4d67-8f15-433fca3b9c9b', 'ee96aa7e-0ad3-4cc8-b9fd-ae57b21965a7', 'scheduled'),
      (v_event_id, 'Beginners', 7, 6, 'af8e0f4f-9429-4758-8c1e-12a3ee1b8d5a', '83c2d463-7674-4971-9eda-d3a6f5dcc7c4', 'be99096c-f5c8-423c-a486-d868de646b15', 'cc8d7051-d062-4c71-890f-70a8b6805676', 'scheduled'),
      (v_event_id, 'Beginners', 8, 1, '68c9f25e-d85e-423b-bef4-fe02a1b4381b', '93b26d2d-087e-4abb-bdc9-26b53e202acb', '9b6d2db0-c149-4436-849e-6140281f5cec', 'd77df1a3-b59e-4339-8550-41cf5a172bf5', 'scheduled'),
      (v_event_id, 'Beginners', 8, 2, '6cf3527d-0114-4b7e-a303-4a8b6cec6acc', 'd9d3530d-c447-4d4c-80cc-8ba853f4fe5f', 'a710be1d-60a7-4ed1-ac31-fa771a04ddf2', '48926f49-95d7-41ef-97e6-4a97267e312a', 'scheduled'),
      (v_event_id, 'Beginners', 8, 3, 'd91e5aa3-3869-4ad2-8826-e25970041f83', '84690649-27fe-444e-afec-8c65fda9371a', '1693f632-ce36-48b7-8f4c-31a130757823', '3a5fedb4-f50d-45c5-8b09-d0164240f228', 'scheduled'),
      (v_event_id, 'Beginners', 8, 4, 'c601d61e-4511-419a-bae4-e96332b22676', '3347f573-aac8-43a5-bfe3-306271d06ee5', 'e72c7fc3-0b94-4349-ae4f-400e036690d4', '79278b1f-ca99-45fc-ac50-86874fc661d1', 'scheduled'),
      (v_event_id, 'Beginners', 8, 5, '6174beda-f250-4c1b-8289-f0e107a23b6b', '064aa3ce-21a5-47b1-acc6-42b7f3a2b19e', '821a9f90-bac5-4434-8db1-0ae555801383', '149ebb75-b835-4426-a289-2af55cd238a5', 'scheduled'),
      (v_event_id, 'Beginners', 8, 6, 'f3877f99-2118-41b0-9357-7f2886e34a9e', 'f434b897-1d32-47df-ab7e-0db3aa320ea4', 'c4e842ca-03d8-446c-8bc3-a607de53b233', '8e69f2b8-ccaa-447b-b4e6-b058fc118969', 'scheduled');

  end if;
end $$;
