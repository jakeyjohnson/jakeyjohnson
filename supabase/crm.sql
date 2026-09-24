-- Party Padel CRM: leads, pipeline, activity log, email mailers and SMS.
--
-- Run this once in Supabase Dashboard > SQL Editor > New query, AFTER
-- schema.sql (it references the events and invitational_signups tables
-- that script creates). Safe to re-run: every statement is
-- create-if-not-exists / create-or-replace / drop-then-create.
--
-- Access model is the same as the rest of the back office: nothing in
-- here is readable by the public. Only the logged-in admin (crm.html)
-- can read or write leads, campaigns and messages. The two narrow
-- exceptions are security-definer functions that do one fixed job each:
--   * crm_unsubscribe(token, channel) so the unsubscribe link in a
--     mailer works for someone who isn't logged in, and
--   * the invitational_signups trigger, so a new Invitational sign-up
--     lands in the CRM automatically.
-- Actually sending email/SMS happens in the crm-send Edge Function
-- (supabase/functions/crm-send), which holds the Resend and Twilio keys
-- server-side. No provider key ever reaches a browser.

-- ============================================================
-- Phone normalisation (UK first, E.164 out)
--
-- "07700 900123", "+44 7700 900123" and "447700900123" all become
-- "+447700900123", so the same person imported twice with differently
-- typed numbers still matches, and Twilio gets the format it requires.
-- Anything already starting with + is kept as-is (minus spacing), so
-- non-UK numbers entered in full international form still work.
-- ============================================================

create or replace function crm_normalise_phone(p text)
returns text
language plpgsql immutable as $$
declare
  v text;
begin
  if p is null then return null; end if;
  v := regexp_replace(p, '[^0-9+]', '', 'g');
  if v = '' then return null; end if;
  if left(v, 2) = '00' then v := '+' || substr(v, 3); end if;
  if left(v, 4) = '+440' then v := '+44' || substr(v, 5); end if;   -- "+44 (0)7700..."
  if left(v, 1) = '+' then return v; end if;
  if left(v, 2) = '44' then return '+' || v; end if;
  if left(v, 1) = '0' then return '+44' || substr(v, 2); end if;
  return '+' || v;
end;
$$;

-- ============================================================
-- Leads
-- ============================================================

create table if not exists crm_leads (
  id                 uuid primary key default gen_random_uuid(),
  first_name         text not null default '',
  last_name          text not null default '',
  email              text,
  phone              text,
  city               text not null default '',
  company            text not null default '',   -- for partner / sponsor / venue leads
  lead_type          text not null default 'player'
                       check (lead_type in ('player','spectator','partner','venue','other')),
  source             text not null default 'manual'
                       check (source in ('manual','invitational','website','import','event','referral','social','partner')),
  stage              text not null default 'new'
                       check (stage in ('new','contacted','interested','registered','attended','lost')),
  tags               text[] not null default '{}',
  event_id           uuid references events(id) on delete set null,  -- event they're interested in / booked on
  notes              text not null default '',
  email_opt_in       boolean not null default false,
  sms_opt_in         boolean not null default false,
  unsubscribe_token  uuid not null default gen_random_uuid(),
  last_contacted_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint crm_leads_has_contact check (email is not null or phone is not null)
);

-- One lead per email address (case-insensitive) and per phone number,
-- so imports and repeat sign-ups merge rather than duplicate.
create unique index if not exists crm_leads_email_key on crm_leads (lower(email)) where email is not null;
create unique index if not exists crm_leads_phone_key on crm_leads (phone) where phone is not null;
create unique index if not exists crm_leads_unsub_key on crm_leads (unsubscribe_token);
create index if not exists crm_leads_stage_idx on crm_leads (stage);
create index if not exists crm_leads_event_idx on crm_leads (event_id);
create index if not exists crm_leads_tags_idx on crm_leads using gin (tags);

create or replace function crm_leads_before_write()
returns trigger
language plpgsql as $$
begin
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.phone := crm_normalise_phone(new.phone);
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  -- Tags are matched exactly when building an audience, so store them
  -- lowercased, trimmed and de-duplicated.
  new.tags := coalesce(
    (select array_agg(distinct t order by t)
       from (select lower(trim(x)) as t from unnest(new.tags) x) s
      where t <> ''),
    '{}'
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_leads_before_write on crm_leads;
create trigger crm_leads_before_write
  before insert or update on crm_leads
  for each row execute function crm_leads_before_write();

alter table crm_leads enable row level security;

drop policy if exists "Authenticated manage leads" on crm_leads;
create policy "Authenticated manage leads"
  on crm_leads for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Activity timeline (notes, stage changes, messages sent/received)
-- ============================================================

create table if not exists crm_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references crm_leads(id) on delete cascade,
  kind        text not null
                check (kind in ('note','stage','email','sms','sms_in','signup','import','unsubscribe','call')),
  body        text not null default '',
  meta        jsonb not null default '{}'::jsonb,
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists crm_activities_lead_idx on crm_activities (lead_id, created_at desc);

alter table crm_activities enable row level security;

drop policy if exists "Authenticated manage activities" on crm_activities;
create policy "Authenticated manage activities"
  on crm_activities for all
  to authenticated
  using (true)
  with check (true);

-- Log every pipeline move automatically, so the timeline is complete
-- whether the stage was changed from the lead drawer, the pipeline
-- board or a bulk action.
create or replace function crm_log_stage_change()
returns trigger
language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into crm_activities (lead_id, kind, body, meta, created_by)
    values (new.id, 'stage', old.stage || ' → ' || new.stage,
            jsonb_build_object('from', old.stage, 'to', new.stage),
            coalesce(auth.jwt() ->> 'email', ''));
  end if;
  return new;
end;
$$;

drop trigger if exists crm_leads_stage_log on crm_leads;
create trigger crm_leads_stage_log
  after update of stage on crm_leads
  for each row execute function crm_log_stage_change();

-- ============================================================
-- Campaigns (a mailer or an SMS blast) and per-recipient messages
-- ============================================================

create table if not exists crm_campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  channel           text not null check (channel in ('email','sms')),
  subject           text not null default '',     -- email only
  body              text not null default '',     -- plain text with {{merge_tags}}; email turns blank lines into paragraphs
  -- Who it goes to, e.g. {"stages":["new","interested"],"tags":["vip"],
  -- "sources":[],"lead_types":["player"],"event_id":null,"city":""}.
  -- Empty list/blank = no filter on that field. Consent for the channel
  -- is always enforced on top of this, never optional (see crm_audience).
  audience          jsonb not null default '{}'::jsonb,
  status            text not null default 'draft'
                      check (status in ('draft','sending','sent','failed')),
  recipients_count  integer not null default 0,
  sent_count        integer not null default 0,
  failed_count      integer not null default 0,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function set_crm_campaigns_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_campaigns_set_updated_at on crm_campaigns;
create trigger crm_campaigns_set_updated_at
  before update on crm_campaigns
  for each row execute function set_crm_campaigns_updated_at();

alter table crm_campaigns enable row level security;

drop policy if exists "Authenticated manage campaigns" on crm_campaigns;
create policy "Authenticated manage campaigns"
  on crm_campaigns for all
  to authenticated
  using (true)
  with check (true);

create table if not exists crm_messages (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references crm_campaigns(id) on delete cascade,  -- null for one-off messages from a lead's drawer
  lead_id      uuid references crm_leads(id) on delete set null,
  channel      text not null check (channel in ('email','sms')),
  to_address   text not null,
  status       text not null default 'queued' check (status in ('queued','sent','failed')),
  provider_id  text,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists crm_messages_campaign_idx on crm_messages (campaign_id);
create index if not exists crm_messages_lead_idx on crm_messages (lead_id);

alter table crm_messages enable row level security;

drop policy if exists "Authenticated read messages" on crm_messages;
create policy "Authenticated read messages"
  on crm_messages for select
  to authenticated
  using (true);
-- No insert/update policy on purpose: only the crm-send Edge Function
-- (service role, which bypasses RLS) writes message rows, so the send
-- log can't be edited from a browser.

-- ============================================================
-- Audience: the ONE definition of "who does this campaign reach"
--
-- Used by crm.html for the live recipient count and by the crm-send
-- Edge Function for the actual send, so the number you see before
-- pressing Send is the number that gets sent. Security invoker, so from
-- a browser it still only works for the logged-in admin (RLS applies).
-- ============================================================

create or replace function crm_audience(p_audience jsonb, p_channel text)
returns setof crm_leads
language sql stable as $$
  select l.*
    from crm_leads l
   where (
           (p_channel = 'email' and l.email_opt_in and l.email is not null)
        or (p_channel = 'sms'   and l.sms_opt_in   and l.phone is not null)
         )
     and (coalesce(jsonb_array_length(p_audience -> 'stages'), 0) = 0
          or l.stage in (select jsonb_array_elements_text(p_audience -> 'stages')))
     and (coalesce(jsonb_array_length(p_audience -> 'sources'), 0) = 0
          or l.source in (select jsonb_array_elements_text(p_audience -> 'sources')))
     and (coalesce(jsonb_array_length(p_audience -> 'lead_types'), 0) = 0
          or l.lead_type in (select jsonb_array_elements_text(p_audience -> 'lead_types')))
     and (coalesce(jsonb_array_length(p_audience -> 'tags'), 0) = 0
          or l.tags && array(select lower(jsonb_array_elements_text(p_audience -> 'tags'))))
     and (coalesce(p_audience ->> 'event_id', '') = ''
          or l.event_id = (p_audience ->> 'event_id')::uuid)
     and (coalesce(trim(p_audience ->> 'city'), '') = ''
          or lower(l.city) = lower(trim(p_audience ->> 'city')))
   order by l.created_at;
$$;

-- ============================================================
-- Public unsubscribe (unsubscribe.html?t=<token>&c=email|sms|all)
--
-- The only CRM entry point open to anonymous visitors. It takes an
-- unguessable per-lead token (never an email address or id), can only
-- ever turn consent OFF, and returns nothing about the lead beyond
-- whether the token matched.
-- ============================================================

create or replace function crm_unsubscribe(p_token uuid, p_channel text default 'all')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update crm_leads
     set email_opt_in = case when p_channel in ('email','all') then false else email_opt_in end,
         sms_opt_in   = case when p_channel in ('sms','all')   then false else sms_opt_in end
   where unsubscribe_token = p_token
  returning id into v_id;

  if v_id is null then return false; end if;

  insert into crm_activities (lead_id, kind, body, meta)
  values (v_id, 'unsubscribe', 'Unsubscribed via link (' || p_channel || ')',
          jsonb_build_object('channel', p_channel));
  return true;
end;
$$;

revoke all on function crm_unsubscribe(uuid, text) from public;
grant execute on function crm_unsubscribe(uuid, text) to anon, authenticated;

-- ============================================================
-- Invitational sign-ups flow straight into the CRM
--
-- Each new row in invitational_signups is upserted as a lead (matched
-- on email, then phone), tagged "invitational", and gets a timeline
-- entry. The form's consent box reads "contact me about The
-- Invitational and future events", which is channel-neutral, so it
-- sets both email and SMS consent. Security definer because the
-- public form inserts as anon, and anon has no access to crm_leads.
-- ============================================================

create or replace function crm_capture_invitational()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(trim(new.email)), '');
  v_phone text := crm_normalise_phone(new.phone);
  v_id uuid;
begin
  select id into v_id from crm_leads
   where (v_email is not null and lower(email) = v_email)
      or (v_phone is not null and phone = v_phone)
   order by (lower(email) = v_email) desc nulls last
   limit 1;

  if v_id is null then
    insert into crm_leads (first_name, last_name, email, phone, source, stage, tags,
                           email_opt_in, sms_opt_in)
    values (new.first_name, new.last_name, v_email, v_phone, 'invitational', 'interested',
            array['invitational'], new.consent, new.consent)
    returning id into v_id;
  else
    update crm_leads
       set first_name   = coalesce(nullif(first_name, ''), new.first_name),
           last_name    = coalesce(nullif(last_name, ''), new.last_name),
           email        = coalesce(email, v_email),
           phone        = coalesce(phone, v_phone),
           tags         = array_append(tags, 'invitational'),
           stage        = case when stage in ('new','contacted','lost') then 'interested' else stage end,
           email_opt_in = email_opt_in or new.consent,
           sms_opt_in   = sms_opt_in or new.consent
     where id = v_id;
  end if;

  insert into crm_activities (lead_id, kind, body, meta)
  values (v_id, 'signup', 'Signed up for The Invitational',
          jsonb_build_object('invitational_signup_id', new.id, 'consent', new.consent));
  return new;
end;
$$;

drop trigger if exists invitational_to_crm on invitational_signups;
create trigger invitational_to_crm
  after insert on invitational_signups
  for each row execute function crm_capture_invitational();

-- Backfill: anyone who signed up for the Invitational before this
-- script was run. Only adds people not already in the CRM, so re-running
-- the script doesn't double anything up.
insert into crm_leads (first_name, last_name, email, phone, source, stage, tags,
                       email_opt_in, sms_opt_in, created_at)
select distinct on (lower(s.email))
       s.first_name, s.last_name, lower(trim(s.email)), crm_normalise_phone(s.phone),
       'invitational', 'interested', array['invitational'], s.consent, s.consent, s.created_at
  from invitational_signups s
 where not exists (select 1 from crm_leads l where lower(l.email) = lower(trim(s.email)))
   and not exists (select 1 from crm_leads l where l.phone = crm_normalise_phone(s.phone))
 order by lower(s.email), s.created_at
on conflict do nothing;
