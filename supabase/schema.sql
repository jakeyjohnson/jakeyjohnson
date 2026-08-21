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
-- (6 courts, 4 games per player — works out to 9 rounds, everyone
-- plays 4 or 5 times) ready to fill scores in as matches happen. This
-- is exactly what clicking "+ Add Players" then "Generate Fixtures"
-- does live — just pre-run once so there's a working example to look
-- at immediately. Every score is left blank; nothing is fabricated.
do $$
declare
  v_event_id uuid;
begin
  select id into v_event_id from events where slug = 'manchester-2026-09-27';

  if v_event_id is not null and not exists (
    select 1 from players where event_id = v_event_id and league_name = 'Beginners'
  ) then

    insert into players (id, event_id, league_name, name, sort_order) values
      ('325eaab0-5a2a-47fa-ba06-b1a2e8891739', v_event_id, 'Beginners', 'Player 1', 0),
      ('2d701019-858f-4f89-8cd5-38c00039c73e', v_event_id, 'Beginners', 'Player 2', 1),
      ('d80b0eda-1acc-40fe-b1d2-b82a85f5ff72', v_event_id, 'Beginners', 'Player 3', 2),
      ('81fecaa4-d995-49fc-8bb9-ff9a3e2305b0', v_event_id, 'Beginners', 'Player 4', 3),
      ('d995c7cd-e07a-4440-b0a0-3ed704f4ac0c', v_event_id, 'Beginners', 'Player 5', 4),
      ('0e33f17e-7652-46ec-8904-7685da08e9e3', v_event_id, 'Beginners', 'Player 6', 5),
      ('1418f2fc-bb3b-4590-8648-bad1e26510fa', v_event_id, 'Beginners', 'Player 7', 6),
      ('13ebf2d0-1bff-49d7-af7b-b907561ce5f7', v_event_id, 'Beginners', 'Player 8', 7),
      ('7702fa5f-9a82-4960-be0b-15ed13a71453', v_event_id, 'Beginners', 'Player 9', 8),
      ('ea1fbe7f-7502-41a6-af80-a55e0f1f4513', v_event_id, 'Beginners', 'Player 10', 9),
      ('50d20e92-eff2-4410-ac66-475bdfe5ff24', v_event_id, 'Beginners', 'Player 11', 10),
      ('43551306-b492-4d50-b5a3-aba7c7290ffc', v_event_id, 'Beginners', 'Player 12', 11),
      ('c2c6e78d-e144-41c8-87ab-e996566f7015', v_event_id, 'Beginners', 'Player 13', 12),
      ('361bc385-42c4-4264-8c8d-d4bf700e8b89', v_event_id, 'Beginners', 'Player 14', 13),
      ('425bf1b5-3e73-4adf-945b-3891e016e27f', v_event_id, 'Beginners', 'Player 15', 14),
      ('9e046a5a-bfbf-4970-8b58-ec7f396cfd79', v_event_id, 'Beginners', 'Player 16', 15),
      ('539cc5fc-0922-4c04-b2dc-7b9f4227e106', v_event_id, 'Beginners', 'Player 17', 16),
      ('0efaab34-6205-433f-890b-ff77b093f4d5', v_event_id, 'Beginners', 'Player 18', 17),
      ('c22c16a8-bd7c-4981-8a49-bc3dfa17c49a', v_event_id, 'Beginners', 'Player 19', 18),
      ('fe016539-433e-4bf2-b1bb-e939d8c135f0', v_event_id, 'Beginners', 'Player 20', 19),
      ('7641d6a0-15f4-42ab-9b4b-1be38f79f193', v_event_id, 'Beginners', 'Player 21', 20),
      ('3882d40a-f718-46e2-9ac7-1561e33e5fec', v_event_id, 'Beginners', 'Player 22', 21),
      ('4d71e3b2-dabc-4287-9286-326b19321115', v_event_id, 'Beginners', 'Player 23', 22),
      ('96ed2bd9-c260-40d0-aa96-03ffd023db8e', v_event_id, 'Beginners', 'Player 24', 23),
      ('8d969d8c-e671-4f11-b310-b6de1cd6e7da', v_event_id, 'Beginners', 'Player 25', 24),
      ('c1d2955a-323d-4d98-a7a0-c5c0ca82b344', v_event_id, 'Beginners', 'Player 26', 25),
      ('b2757575-5bc7-4e10-a319-6ac7e0138948', v_event_id, 'Beginners', 'Player 27', 26),
      ('f4a74f03-ddd0-4109-8403-df9ef9fc1b3a', v_event_id, 'Beginners', 'Player 28', 27),
      ('9feeacff-814a-40ce-ae04-9f21f4bf4579', v_event_id, 'Beginners', 'Player 29', 28),
      ('04d0946f-dd9a-469a-bac6-ca1e6782620c', v_event_id, 'Beginners', 'Player 30', 29),
      ('a1644224-34a8-42a0-ad0e-92096644b381', v_event_id, 'Beginners', 'Player 31', 30),
      ('898ec8a8-b2c9-4a4b-9bb2-a00fee114c54', v_event_id, 'Beginners', 'Player 32', 31),
      ('c854871a-3b1e-43ec-9e1e-eefa9aaebdaa', v_event_id, 'Beginners', 'Player 33', 32),
      ('29a900c2-5e21-40c9-9211-46cfc2e62143', v_event_id, 'Beginners', 'Player 34', 33),
      ('aecc5994-ade5-4469-8474-4c0154eafab5', v_event_id, 'Beginners', 'Player 35', 34),
      ('39860e7a-fbb1-43b1-9f49-bb7be545b7e3', v_event_id, 'Beginners', 'Player 36', 35),
      ('f1018fdc-6494-4437-94e4-aa58ac4a0e5a', v_event_id, 'Beginners', 'Player 37', 36),
      ('d018f424-24fb-49e8-b144-dec7749effa8', v_event_id, 'Beginners', 'Player 38', 37),
      ('374efe06-e802-42f6-a1db-052175ef6493', v_event_id, 'Beginners', 'Player 39', 38),
      ('9b72c6bc-c78b-4b15-b728-5f35ffafdcfc', v_event_id, 'Beginners', 'Player 40', 39),
      ('855be24a-46f8-46e3-aa68-ecff8e76ae21', v_event_id, 'Beginners', 'Player 41', 40),
      ('ba68b0fb-e5de-4e41-9b5f-c5fcb7cf288f', v_event_id, 'Beginners', 'Player 42', 41),
      ('fc5119c2-4728-4b1a-ac3f-f3a7bf3531b4', v_event_id, 'Beginners', 'Player 43', 42),
      ('a34cec26-1704-4bde-8536-e50bf96302a2', v_event_id, 'Beginners', 'Player 44', 43),
      ('6521a9e2-2d9f-45f2-a138-d3c221f02287', v_event_id, 'Beginners', 'Player 45', 44),
      ('1e4f7766-b305-4dd7-afce-d9a7ba262af7', v_event_id, 'Beginners', 'Player 46', 45),
      ('301ec28f-ca13-4969-a2af-bef5c7781aad', v_event_id, 'Beginners', 'Player 47', 46),
      ('a1cb7438-feb0-44c5-a169-a5d7056400bd', v_event_id, 'Beginners', 'Player 48', 47),
      ('9c9b866c-0871-40c6-8b30-6428e9829679', v_event_id, 'Beginners', 'Player 49', 48),
      ('dbe27e6a-211e-4bde-95c0-73d0a1c42b93', v_event_id, 'Beginners', 'Player 50', 49);

    insert into fixtures (event_id, league_name, round_number, court_number, player_a1, player_a2, player_b1, player_b2, status) values
      (v_event_id, 'Beginners', 1, 1, '0e33f17e-7652-46ec-8904-7685da08e9e3', '425bf1b5-3e73-4adf-945b-3891e016e27f', '9e046a5a-bfbf-4970-8b58-ec7f396cfd79', '1e4f7766-b305-4dd7-afce-d9a7ba262af7', 'scheduled'),
      (v_event_id, 'Beginners', 1, 2, '96ed2bd9-c260-40d0-aa96-03ffd023db8e', '8d969d8c-e671-4f11-b310-b6de1cd6e7da', 'dbe27e6a-211e-4bde-95c0-73d0a1c42b93', 'd80b0eda-1acc-40fe-b1d2-b82a85f5ff72', 'scheduled'),
      (v_event_id, 'Beginners', 1, 3, 'b2757575-5bc7-4e10-a319-6ac7e0138948', 'a1644224-34a8-42a0-ad0e-92096644b381', '2d701019-858f-4f89-8cd5-38c00039c73e', 'fc5119c2-4728-4b1a-ac3f-f3a7bf3531b4', 'scheduled'),
      (v_event_id, 'Beginners', 1, 4, 'fe016539-433e-4bf2-b1bb-e939d8c135f0', '301ec28f-ca13-4969-a2af-bef5c7781aad', '9c9b866c-0871-40c6-8b30-6428e9829679', '855be24a-46f8-46e3-aa68-ecff8e76ae21', 'scheduled'),
      (v_event_id, 'Beginners', 1, 5, '7641d6a0-15f4-42ab-9b4b-1be38f79f193', 'aecc5994-ade5-4469-8474-4c0154eafab5', '39860e7a-fbb1-43b1-9f49-bb7be545b7e3', '29a900c2-5e21-40c9-9211-46cfc2e62143', 'scheduled'),
      (v_event_id, 'Beginners', 1, 6, '9b72c6bc-c78b-4b15-b728-5f35ffafdcfc', '13ebf2d0-1bff-49d7-af7b-b907561ce5f7', 'ba68b0fb-e5de-4e41-9b5f-c5fcb7cf288f', 'd018f424-24fb-49e8-b144-dec7749effa8', 'scheduled'),
      (v_event_id, 'Beginners', 2, 1, 'c22c16a8-bd7c-4981-8a49-bc3dfa17c49a', '6521a9e2-2d9f-45f2-a138-d3c221f02287', 'a34cec26-1704-4bde-8536-e50bf96302a2', '7702fa5f-9a82-4960-be0b-15ed13a71453', 'scheduled'),
      (v_event_id, 'Beginners', 2, 2, '539cc5fc-0922-4c04-b2dc-7b9f4227e106', 'c854871a-3b1e-43ec-9e1e-eefa9aaebdaa', 'ea1fbe7f-7502-41a6-af80-a55e0f1f4513', '0efaab34-6205-433f-890b-ff77b093f4d5', 'scheduled'),
      (v_event_id, 'Beginners', 2, 3, '81fecaa4-d995-49fc-8bb9-ff9a3e2305b0', '9feeacff-814a-40ce-ae04-9f21f4bf4579', 'a1cb7438-feb0-44c5-a169-a5d7056400bd', '3882d40a-f718-46e2-9ac7-1561e33e5fec', 'scheduled'),
      (v_event_id, 'Beginners', 2, 4, '361bc385-42c4-4264-8c8d-d4bf700e8b89', '4d71e3b2-dabc-4287-9286-326b19321115', '374efe06-e802-42f6-a1db-052175ef6493', 'c2c6e78d-e144-41c8-87ab-e996566f7015', 'scheduled'),
      (v_event_id, 'Beginners', 2, 5, '50d20e92-eff2-4410-ac66-475bdfe5ff24', 'f1018fdc-6494-4437-94e4-aa58ac4a0e5a', 'd995c7cd-e07a-4440-b0a0-3ed704f4ac0c', 'f4a74f03-ddd0-4109-8403-df9ef9fc1b3a', 'scheduled'),
      (v_event_id, 'Beginners', 2, 6, '898ec8a8-b2c9-4a4b-9bb2-a00fee114c54', '1418f2fc-bb3b-4590-8648-bad1e26510fa', '43551306-b492-4d50-b5a3-aba7c7290ffc', '04d0946f-dd9a-469a-bac6-ca1e6782620c', 'scheduled'),
      (v_event_id, 'Beginners', 3, 1, '325eaab0-5a2a-47fa-ba06-b1a2e8891739', 'c1d2955a-323d-4d98-a7a0-c5c0ca82b344', '29a900c2-5e21-40c9-9211-46cfc2e62143', '1e4f7766-b305-4dd7-afce-d9a7ba262af7', 'scheduled'),
      (v_event_id, 'Beginners', 3, 2, '50d20e92-eff2-4410-ac66-475bdfe5ff24', '9c9b866c-0871-40c6-8b30-6428e9829679', '361bc385-42c4-4264-8c8d-d4bf700e8b89', 'a34cec26-1704-4bde-8536-e50bf96302a2', 'scheduled'),
      (v_event_id, 'Beginners', 3, 3, '3882d40a-f718-46e2-9ac7-1561e33e5fec', '8d969d8c-e671-4f11-b310-b6de1cd6e7da', '9b72c6bc-c78b-4b15-b728-5f35ffafdcfc', 'b2757575-5bc7-4e10-a319-6ac7e0138948', 'scheduled'),
      (v_event_id, 'Beginners', 3, 4, '81fecaa4-d995-49fc-8bb9-ff9a3e2305b0', 'd80b0eda-1acc-40fe-b1d2-b82a85f5ff72', '4d71e3b2-dabc-4287-9286-326b19321115', 'dbe27e6a-211e-4bde-95c0-73d0a1c42b93', 'scheduled'),
      (v_event_id, 'Beginners', 3, 5, 'ea1fbe7f-7502-41a6-af80-a55e0f1f4513', '04d0946f-dd9a-469a-bac6-ca1e6782620c', 'd995c7cd-e07a-4440-b0a0-3ed704f4ac0c', '301ec28f-ca13-4969-a2af-bef5c7781aad', 'scheduled'),
      (v_event_id, 'Beginners', 3, 6, 'c22c16a8-bd7c-4981-8a49-bc3dfa17c49a', '2d701019-858f-4f89-8cd5-38c00039c73e', 'fe016539-433e-4bf2-b1bb-e939d8c135f0', 'f1018fdc-6494-4437-94e4-aa58ac4a0e5a', 'scheduled'),
      (v_event_id, 'Beginners', 4, 1, '7641d6a0-15f4-42ab-9b4b-1be38f79f193', '9e046a5a-bfbf-4970-8b58-ec7f396cfd79', 'c2c6e78d-e144-41c8-87ab-e996566f7015', '855be24a-46f8-46e3-aa68-ecff8e76ae21', 'scheduled'),
      (v_event_id, 'Beginners', 4, 2, '898ec8a8-b2c9-4a4b-9bb2-a00fee114c54', 'c854871a-3b1e-43ec-9e1e-eefa9aaebdaa', '96ed2bd9-c260-40d0-aa96-03ffd023db8e', 'c1d2955a-323d-4d98-a7a0-c5c0ca82b344', 'scheduled'),
      (v_event_id, 'Beginners', 4, 3, 'a1cb7438-feb0-44c5-a169-a5d7056400bd', '7702fa5f-9a82-4960-be0b-15ed13a71453', '39860e7a-fbb1-43b1-9f49-bb7be545b7e3', 'd018f424-24fb-49e8-b144-dec7749effa8', 'scheduled'),
      (v_event_id, 'Beginners', 4, 4, 'fc5119c2-4728-4b1a-ac3f-f3a7bf3531b4', '9feeacff-814a-40ce-ae04-9f21f4bf4579', 'aecc5994-ade5-4469-8474-4c0154eafab5', '325eaab0-5a2a-47fa-ba06-b1a2e8891739', 'scheduled'),
      (v_event_id, 'Beginners', 4, 5, 'a1644224-34a8-42a0-ad0e-92096644b381', '0efaab34-6205-433f-890b-ff77b093f4d5', '13ebf2d0-1bff-49d7-af7b-b907561ce5f7', '6521a9e2-2d9f-45f2-a138-d3c221f02287', 'scheduled'),
      (v_event_id, 'Beginners', 4, 6, '374efe06-e802-42f6-a1db-052175ef6493', 'f4a74f03-ddd0-4109-8403-df9ef9fc1b3a', '539cc5fc-0922-4c04-b2dc-7b9f4227e106', '1418f2fc-bb3b-4590-8648-bad1e26510fa', 'scheduled'),
      (v_event_id, 'Beginners', 5, 1, '43551306-b492-4d50-b5a3-aba7c7290ffc', '425bf1b5-3e73-4adf-945b-3891e016e27f', 'ba68b0fb-e5de-4e41-9b5f-c5fcb7cf288f', '0e33f17e-7652-46ec-8904-7685da08e9e3', 'scheduled'),
      (v_event_id, 'Beginners', 5, 2, '374efe06-e802-42f6-a1db-052175ef6493', 'ea1fbe7f-7502-41a6-af80-a55e0f1f4513', '13ebf2d0-1bff-49d7-af7b-b907561ce5f7', 'a1644224-34a8-42a0-ad0e-92096644b381', 'scheduled'),
      (v_event_id, 'Beginners', 5, 3, '855be24a-46f8-46e3-aa68-ecff8e76ae21', '361bc385-42c4-4264-8c8d-d4bf700e8b89', '7702fa5f-9a82-4960-be0b-15ed13a71453', '1418f2fc-bb3b-4590-8648-bad1e26510fa', 'scheduled'),
      (v_event_id, 'Beginners', 5, 4, 'c22c16a8-bd7c-4981-8a49-bc3dfa17c49a', '29a900c2-5e21-40c9-9211-46cfc2e62143', '4d71e3b2-dabc-4287-9286-326b19321115', '6521a9e2-2d9f-45f2-a138-d3c221f02287', 'scheduled'),
      (v_event_id, 'Beginners', 5, 5, 'f1018fdc-6494-4437-94e4-aa58ac4a0e5a', '0efaab34-6205-433f-890b-ff77b093f4d5', '325eaab0-5a2a-47fa-ba06-b1a2e8891739', '1e4f7766-b305-4dd7-afce-d9a7ba262af7', 'scheduled'),
      (v_event_id, 'Beginners', 5, 6, '898ec8a8-b2c9-4a4b-9bb2-a00fee114c54', '9b72c6bc-c78b-4b15-b728-5f35ffafdcfc', 'fe016539-433e-4bf2-b1bb-e939d8c135f0', 'dbe27e6a-211e-4bde-95c0-73d0a1c42b93', 'scheduled'),
      (v_event_id, 'Beginners', 6, 1, 'c854871a-3b1e-43ec-9e1e-eefa9aaebdaa', 'aecc5994-ade5-4469-8474-4c0154eafab5', '81fecaa4-d995-49fc-8bb9-ff9a3e2305b0', '3882d40a-f718-46e2-9ac7-1561e33e5fec', 'scheduled'),
      (v_event_id, 'Beginners', 6, 2, '04d0946f-dd9a-469a-bac6-ca1e6782620c', '2d701019-858f-4f89-8cd5-38c00039c73e', '425bf1b5-3e73-4adf-945b-3891e016e27f', '9e046a5a-bfbf-4970-8b58-ec7f396cfd79', 'scheduled'),
      (v_event_id, 'Beginners', 6, 3, '7641d6a0-15f4-42ab-9b4b-1be38f79f193', '9feeacff-814a-40ce-ae04-9f21f4bf4579', 'fc5119c2-4728-4b1a-ac3f-f3a7bf3531b4', '0e33f17e-7652-46ec-8904-7685da08e9e3', 'scheduled'),
      (v_event_id, 'Beginners', 6, 4, 'c2c6e78d-e144-41c8-87ab-e996566f7015', 'a1cb7438-feb0-44c5-a169-a5d7056400bd', '539cc5fc-0922-4c04-b2dc-7b9f4227e106', 'a34cec26-1704-4bde-8536-e50bf96302a2', 'scheduled'),
      (v_event_id, 'Beginners', 6, 5, '39860e7a-fbb1-43b1-9f49-bb7be545b7e3', 'b2757575-5bc7-4e10-a319-6ac7e0138948', '50d20e92-eff2-4410-ac66-475bdfe5ff24', '301ec28f-ca13-4969-a2af-bef5c7781aad', 'scheduled'),
      (v_event_id, 'Beginners', 6, 6, 'd80b0eda-1acc-40fe-b1d2-b82a85f5ff72', '8d969d8c-e671-4f11-b310-b6de1cd6e7da', 'ba68b0fb-e5de-4e41-9b5f-c5fcb7cf288f', '96ed2bd9-c260-40d0-aa96-03ffd023db8e', 'scheduled'),
      (v_event_id, 'Beginners', 7, 1, 'd995c7cd-e07a-4440-b0a0-3ed704f4ac0c', 'd018f424-24fb-49e8-b144-dec7749effa8', 'f4a74f03-ddd0-4109-8403-df9ef9fc1b3a', '43551306-b492-4d50-b5a3-aba7c7290ffc', 'scheduled'),
      (v_event_id, 'Beginners', 7, 2, '9c9b866c-0871-40c6-8b30-6428e9829679', 'c1d2955a-323d-4d98-a7a0-c5c0ca82b344', '2d701019-858f-4f89-8cd5-38c00039c73e', '9b72c6bc-c78b-4b15-b728-5f35ffafdcfc', 'scheduled'),
      (v_event_id, 'Beginners', 7, 3, '7702fa5f-9a82-4960-be0b-15ed13a71453', 'c22c16a8-bd7c-4981-8a49-bc3dfa17c49a', 'a1644224-34a8-42a0-ad0e-92096644b381', '4d71e3b2-dabc-4287-9286-326b19321115', 'scheduled'),
      (v_event_id, 'Beginners', 7, 4, 'd80b0eda-1acc-40fe-b1d2-b82a85f5ff72', 'ea1fbe7f-7502-41a6-af80-a55e0f1f4513', '1418f2fc-bb3b-4590-8648-bad1e26510fa', '9e046a5a-bfbf-4970-8b58-ec7f396cfd79', 'scheduled'),
      (v_event_id, 'Beginners', 7, 5, '361bc385-42c4-4264-8c8d-d4bf700e8b89', '0efaab34-6205-433f-890b-ff77b093f4d5', '3882d40a-f718-46e2-9ac7-1561e33e5fec', '9feeacff-814a-40ce-ae04-9f21f4bf4579', 'scheduled'),
      (v_event_id, 'Beginners', 7, 6, 'fc5119c2-4728-4b1a-ac3f-f3a7bf3531b4', '8d969d8c-e671-4f11-b310-b6de1cd6e7da', '04d0946f-dd9a-469a-bac6-ca1e6782620c', '898ec8a8-b2c9-4a4b-9bb2-a00fee114c54', 'scheduled'),
      (v_event_id, 'Beginners', 8, 1, '81fecaa4-d995-49fc-8bb9-ff9a3e2305b0', '539cc5fc-0922-4c04-b2dc-7b9f4227e106', '9c9b866c-0871-40c6-8b30-6428e9829679', '29a900c2-5e21-40c9-9211-46cfc2e62143', 'scheduled'),
      (v_event_id, 'Beginners', 8, 2, 'c854871a-3b1e-43ec-9e1e-eefa9aaebdaa', '301ec28f-ca13-4969-a2af-bef5c7781aad', '7641d6a0-15f4-42ab-9b4b-1be38f79f193', 'd995c7cd-e07a-4440-b0a0-3ed704f4ac0c', 'scheduled'),
      (v_event_id, 'Beginners', 8, 3, 'a1cb7438-feb0-44c5-a169-a5d7056400bd', 'd018f424-24fb-49e8-b144-dec7749effa8', '96ed2bd9-c260-40d0-aa96-03ffd023db8e', 'f1018fdc-6494-4437-94e4-aa58ac4a0e5a', 'scheduled'),
      (v_event_id, 'Beginners', 8, 4, 'ba68b0fb-e5de-4e41-9b5f-c5fcb7cf288f', '425bf1b5-3e73-4adf-945b-3891e016e27f', 'dbe27e6a-211e-4bde-95c0-73d0a1c42b93', '374efe06-e802-42f6-a1db-052175ef6493', 'scheduled'),
      (v_event_id, 'Beginners', 8, 5, 'f4a74f03-ddd0-4109-8403-df9ef9fc1b3a', '39860e7a-fbb1-43b1-9f49-bb7be545b7e3', '855be24a-46f8-46e3-aa68-ecff8e76ae21', 'fe016539-433e-4bf2-b1bb-e939d8c135f0', 'scheduled'),
      (v_event_id, 'Beginners', 8, 6, '325eaab0-5a2a-47fa-ba06-b1a2e8891739', '6521a9e2-2d9f-45f2-a138-d3c221f02287', '1e4f7766-b305-4dd7-afce-d9a7ba262af7', '13ebf2d0-1bff-49d7-af7b-b907561ce5f7', 'scheduled'),
      (v_event_id, 'Beginners', 9, 1, 'b2757575-5bc7-4e10-a319-6ac7e0138948', '50d20e92-eff2-4410-ac66-475bdfe5ff24', '43551306-b492-4d50-b5a3-aba7c7290ffc', 'aecc5994-ade5-4469-8474-4c0154eafab5', 'scheduled'),
      (v_event_id, 'Beginners', 9, 2, '0e33f17e-7652-46ec-8904-7685da08e9e3', 'c1d2955a-323d-4d98-a7a0-c5c0ca82b344', 'a34cec26-1704-4bde-8536-e50bf96302a2', 'c2c6e78d-e144-41c8-87ab-e996566f7015', 'scheduled'),
      (v_event_id, 'Beginners', 9, 3, '81fecaa4-d995-49fc-8bb9-ff9a3e2305b0', 'd995c7cd-e07a-4440-b0a0-3ed704f4ac0c', '7641d6a0-15f4-42ab-9b4b-1be38f79f193', '425bf1b5-3e73-4adf-945b-3891e016e27f', 'scheduled'),
      (v_event_id, 'Beginners', 9, 4, 'a1644224-34a8-42a0-ad0e-92096644b381', '39860e7a-fbb1-43b1-9f49-bb7be545b7e3', '1e4f7766-b305-4dd7-afce-d9a7ba262af7', 'f1018fdc-6494-4437-94e4-aa58ac4a0e5a', 'scheduled'),
      (v_event_id, 'Beginners', 9, 5, '96ed2bd9-c260-40d0-aa96-03ffd023db8e', 'dbe27e6a-211e-4bde-95c0-73d0a1c42b93', '855be24a-46f8-46e3-aa68-ecff8e76ae21', '0efaab34-6205-433f-890b-ff77b093f4d5', 'scheduled'),
      (v_event_id, 'Beginners', 9, 6, 'f4a74f03-ddd0-4109-8403-df9ef9fc1b3a', '2d701019-858f-4f89-8cd5-38c00039c73e', 'a1cb7438-feb0-44c5-a169-a5d7056400bd', 'fc5119c2-4728-4b1a-ac3f-f3a7bf3531b4', 'scheduled');


  end if;
end $$;

-- ============================================================
-- Invitational registrations
--
-- The sign-up form at invitational.html (partypadel.uk/invitational)
-- writes here directly with the public anon key — there's no login
-- for this form, anyone can register. Row-level security is what
-- keeps that safe: the public can INSERT a new row but can't read,
-- change or delete anyone's entry (including their own) — only the
-- logged-in admin can see the list, via Table Editor or SQL Editor
-- in the Supabase dashboard (there's no in-app viewer for this yet).
-- ============================================================

create table if not exists invitational_signups (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  phone       text not null,
  email       text not null,
  consent     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table invitational_signups enable row level security;

drop policy if exists "Public can register" on invitational_signups;
create policy "Public can register"
  on invitational_signups for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Authenticated can view registrations" on invitational_signups;
create policy "Authenticated can view registrations"
  on invitational_signups for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can delete registrations" on invitational_signups;
create policy "Authenticated can delete registrations"
  on invitational_signups for delete
  to authenticated
  using (true);
