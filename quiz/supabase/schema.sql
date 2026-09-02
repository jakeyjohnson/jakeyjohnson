-- Live Quiz app — tables, security policies, and the scoring RPC.
--
-- Run this once in a NEW Supabase project's Dashboard > SQL Editor >
-- New query (this is a separate project from the Party Padel one —
-- see quiz/README.md). Safe to re-run: every statement is
-- idempotent (create-if-not-exists / drop-then-create).
--
-- After running this, create the host login separately in
-- Authentication > Users > Add user (email + password) — there's no
-- sign-up form anywhere in quiz/host.html, so that's the only way
-- in. Then go to Authentication > Providers > Email and turn OFF
-- "Allow new users to sign up" — same reasoning as the Party Padel
-- project: the anon key below is meant to be public, and every write
-- policy here only checks "is logged in", not "is a specific person".

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table if not exists quizzes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists quiz_questions (
  id                 uuid primary key default gen_random_uuid(),
  quiz_id            uuid not null references quizzes(id) on delete cascade,
  order_index        integer not null default 0,
  prompt             text not null,
  -- 2-4 answer strings, e.g. ["Paris","London","Rome","Berlin"]
  options            jsonb not null,
  correct_index      integer not null,
  time_limit_seconds integer not null default 20,
  points             integer not null default 1000,
  -- Optional media shown above the question — an image to identify,
  -- a sound clip to guess, etc. media_url points into the public
  -- quiz-media storage bucket (see "Storage" below); 'none' means no
  -- media_url is expected.
  media_type         text not null default 'none' check (media_type in ('none','image','audio')),
  media_url          text,
  created_at         timestamptz not null default now(),
  constraint quiz_questions_options_len check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 4
  ),
  constraint quiz_questions_correct_index_range check (
    correct_index >= 0 and correct_index < 4
  ),
  constraint quiz_questions_media_url_required check (
    media_type = 'none' or media_url is not null
  )
);

-- Migration for a project that ran an earlier version of this script
-- before media support existed — no-ops on a fresh project (the
-- columns already exist from the create table above) and on a
-- project that's already been migrated.
alter table quiz_questions add column if not exists media_type text not null default 'none';
alter table quiz_questions add column if not exists media_url text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quiz_questions_media_type_check'
  ) then
    alter table quiz_questions add constraint quiz_questions_media_type_check
      check (media_type in ('none','image','audio'));
  end if;
end $$;

create table if not exists quiz_sessions (
  id                       uuid primary key default gen_random_uuid(),
  quiz_id                  uuid not null references quizzes(id) on delete cascade,
  join_code                text not null unique,
  status                   text not null default 'lobby'
                             check (status in ('lobby','question','reveal','leaderboard','ended')),
  current_question_index   integer not null default -1,
  -- Safe projection of the live question, written by the (trusted,
  -- authenticated) host client — never includes correct_index/counts
  -- until the host reveals it. This is what players/display actually
  -- read; quiz_questions itself stays host-only-readable so the
  -- answer key can never leak early. Shape while status='question':
  --   {question_id, prompt, options, time_limit_seconds, points,
  --    started_at, correct_index: null, counts: null}
  -- filled in by the host at reveal:
  --   {..., correct_index: 2, counts: {"0":3,"1":1,"2":9,"3":0}}
  current_question_public jsonb,
  created_at               timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists quiz_players (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references quiz_sessions(id) on delete cascade,
  nickname    text not null,
  score       integer not null default 0,
  joined_at   timestamptz not null default now(),
  unique (session_id, nickname)
);

create table if not exists quiz_answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references quiz_sessions(id) on delete cascade,
  player_id       uuid not null references quiz_players(id) on delete cascade,
  question_id     uuid not null references quiz_questions(id) on delete cascade,
  selected_index  integer not null,
  is_correct      boolean not null,
  points_awarded  integer not null default 0,
  response_ms     integer not null,
  answered_at     timestamptz not null default now(),
  unique (player_id, question_id)
);

create index if not exists quiz_questions_quiz_id_idx on quiz_questions(quiz_id, order_index);
create index if not exists quiz_sessions_join_code_idx on quiz_sessions(join_code);
create index if not exists quiz_players_session_id_idx on quiz_players(session_id);
create index if not exists quiz_answers_session_question_idx on quiz_answers(session_id, question_id);

-- ---------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------

alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_sessions enable row level security;
alter table quiz_players enable row level security;
alter table quiz_answers enable row level security;

-- quizzes / quiz_questions: host-only, full stop. No public policy at
-- all — this is what keeps every question's correct_index (and every
-- not-yet-asked question) unreadable by anon players before it's
-- revealed via current_question_public below.
drop policy if exists "quizzes host read" on quizzes;
create policy "quizzes host read" on quizzes for select to authenticated using (true);
drop policy if exists "quizzes host write" on quizzes;
create policy "quizzes host write" on quizzes for all to authenticated using (true) with check (true);

drop policy if exists "quiz_questions host read" on quiz_questions;
create policy "quiz_questions host read" on quiz_questions for select to authenticated using (true);
drop policy if exists "quiz_questions host write" on quiz_questions;
create policy "quiz_questions host write" on quiz_questions for all to authenticated using (true) with check (true);

-- quiz_sessions: publicly readable (players/display need to look one
-- up by id or join_code and follow its live status) but only the
-- host can create/advance/end one.
drop policy if exists "quiz_sessions public read" on quiz_sessions;
create policy "quiz_sessions public read" on quiz_sessions for select using (true);
drop policy if exists "quiz_sessions host write" on quiz_sessions;
create policy "quiz_sessions host write" on quiz_sessions for all to authenticated using (true) with check (true);

-- quiz_players: publicly readable (leaderboard) and publicly
-- insertable (that's how someone joins) but only while the session
-- is still in its lobby — once play has started, the roster is
-- locked. No public update/delete: a player can't rename themselves
-- or edit their own score; only the host (authenticated) can.
drop policy if exists "quiz_players public read" on quiz_players;
create policy "quiz_players public read" on quiz_players for select using (true);
drop policy if exists "quiz_players public join" on quiz_players;
create policy "quiz_players public join" on quiz_players for insert
  with check (
    exists (
      select 1 from quiz_sessions s
      where s.id = session_id and s.status = 'lobby'
    )
  );
drop policy if exists "quiz_players host write" on quiz_players;
create policy "quiz_players host write" on quiz_players for update to authenticated using (true) with check (true);
drop policy if exists "quiz_players host delete" on quiz_players;
create policy "quiz_players host delete" on quiz_players for delete to authenticated using (true);

-- quiz_answers: no public insert/select policy at all. The only way
-- to write one is the submit_quiz_answer() function below (it runs
-- as the function owner via security definer, bypassing RLS
-- entirely) — this is what stops a player from posting a fake
-- instant "correct" answer directly against the table. The host can
-- read raw answers for review.
drop policy if exists "quiz_answers host read" on quiz_answers;
create policy "quiz_answers host read" on quiz_answers for select to authenticated using (true);

-- ---------------------------------------------------------------
-- Storage: a public bucket for question images/audio clips. The
-- host uploads into it from host.html; players/display just load
-- the public URL saved on quiz_questions.media_url — no signed URLs
-- or auth needed to view, same "anon key is public, RLS is the real
-- gate" model as everything else in this file.
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('quiz-media', 'quiz-media', true)
on conflict (id) do nothing;

drop policy if exists "quiz-media public read" on storage.objects;
create policy "quiz-media public read" on storage.objects for select
  using (bucket_id = 'quiz-media');

drop policy if exists "quiz-media host write" on storage.objects;
create policy "quiz-media host write" on storage.objects for insert to authenticated
  with check (bucket_id = 'quiz-media');

drop policy if exists "quiz-media host update" on storage.objects;
create policy "quiz-media host update" on storage.objects for update to authenticated
  using (bucket_id = 'quiz-media') with check (bucket_id = 'quiz-media');

drop policy if exists "quiz-media host delete" on storage.objects;
create policy "quiz-media host delete" on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-media');

-- ---------------------------------------------------------------
-- Realtime: publish row changes on the tables players/display watch
-- ---------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_sessions'
  ) then
    alter publication supabase_realtime add table quiz_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_players'
  ) then
    alter publication supabase_realtime add table quiz_players;
  end if;
end $$;

-- ---------------------------------------------------------------
-- Scoring RPC — the only place points get computed or awarded.
-- security definer + a fixed search_path so it can read the real
-- quiz_questions row (which the calling anon/authenticated role
-- cannot, per the RLS above) without being hijacked by a
-- search-path attack.
-- ---------------------------------------------------------------

create or replace function submit_quiz_answer(
  p_session_id uuid,
  p_player_id uuid,
  p_selected_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       quiz_sessions%rowtype;
  v_question      quiz_questions%rowtype;
  v_question_id   uuid;
  v_started_at    timestamptz;
  v_limit_ms      integer;
  v_response_ms   integer;
  v_is_correct    boolean;
  v_points        integer;
  v_existing      quiz_answers%rowtype;
  v_new_score     integer;
begin
  select * into v_session from quiz_sessions where id = p_session_id;
  if not found or v_session.status <> 'question' or v_session.current_question_public is null then
    raise exception 'No question is currently live for this session';
  end if;

  v_question_id := (v_session.current_question_public->>'question_id')::uuid;
  select * into v_question from quiz_questions where id = v_question_id;
  if not found then
    raise exception 'Live question no longer exists';
  end if;

  if not exists (
    select 1 from quiz_players p where p.id = p_player_id and p.session_id = p_session_id
  ) then
    raise exception 'Player is not part of this session';
  end if;

  if p_selected_index < 0 or p_selected_index >= jsonb_array_length(v_question.options) then
    raise exception 'selected_index out of range';
  end if;

  -- A duplicate submit (double tap) is a no-op, not an error — return
  -- whatever was already recorded the first time instead of erroring.
  select * into v_existing from quiz_answers where player_id = p_player_id and question_id = v_question_id;
  if found then
    select score into v_new_score from quiz_players where id = p_player_id;
    return jsonb_build_object(
      'is_correct', v_existing.is_correct,
      'points_awarded', v_existing.points_awarded,
      'correct_index', v_question.correct_index,
      'new_score', v_new_score
    );
  end if;

  v_started_at := (v_session.current_question_public->>'started_at')::timestamptz;
  v_limit_ms := v_question.time_limit_seconds * 1000;
  v_response_ms := greatest(0, least(v_limit_ms, extract(epoch from (now() - v_started_at)) * 1000)::integer);

  v_is_correct := (p_selected_index = v_question.correct_index);

  -- Kahoot-style: full points for an instant correct answer, decaying
  -- to half the points at the very last moment; zero for a wrong one.
  if v_is_correct then
    v_points := round(v_question.points * (1 - (v_response_ms::numeric / v_limit_ms) / 2));
  else
    v_points := 0;
  end if;

  insert into quiz_answers (session_id, player_id, question_id, selected_index, is_correct, points_awarded, response_ms)
  values (p_session_id, p_player_id, v_question_id, p_selected_index, v_is_correct, v_points, v_response_ms);

  update quiz_players set score = score + v_points where id = p_player_id
    returning score into v_new_score;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'points_awarded', v_points,
    'correct_index', v_question.correct_index,
    'new_score', v_new_score
  );
end;
$$;

-- Only the roles that reach this via PostgREST's RPC endpoint need to
-- execute it; the function's own security definer body is what grants
-- it access to the otherwise-locked-down tables above.
revoke all on function submit_quiz_answer(uuid, uuid, integer) from public;
grant execute on function submit_quiz_answer(uuid, uuid, integer) to anon, authenticated;
