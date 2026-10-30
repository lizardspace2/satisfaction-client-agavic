-- ============================================================================
-- AGAVIC SATISFACTION — Schéma de base de données Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- Ordre : exécuter ce fichier EN ENTIER, puis seed.sql
--
-- Tous les objets de ce projet portent le préfixe "enquete_satisfaction_"
-- (tables, types, fonctions, index) afin de pouvoir cohabiter avec
-- d'autres applications dans la même base Supabase.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type public.enquete_satisfaction_app_role as enum ('admin', 'manager', 'advisor', 'viewer');
create type public.enquete_satisfaction_questionnaire_status as enum ('draft', 'active', 'archived');
create type public.enquete_satisfaction_question_type as enum (
  'score_10', 'stars', 'nps', 'single_choice', 'multi_choice',
  'text', 'yes_no', 'date', 'email', 'dropdown', 'message'
);
create type public.enquete_satisfaction_campaign_status as enum ('draft', 'active', 'completed', 'paused');
create type public.enquete_satisfaction_invitation_status as enum ('pending', 'sent', 'opened', 'completed', 'expired');
create type public.enquete_satisfaction_response_status as enum ('new', 'read', 'archived');
create type public.enquete_satisfaction_followup_status as enum ('new', 'assigned', 'in_progress', 'resolved');

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- Profils utilisateurs (liés à auth.users)
create table public.enquete_satisfaction_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        public.enquete_satisfaction_app_role not null default 'viewer',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Conseillers du cabinet
create table public.enquete_satisfaction_advisors (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.enquete_satisfaction_profiles (id) on delete set null,
  full_name   text not null,
  email       text not null,
  position    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Questionnaires (modèles)
create table public.enquete_satisfaction_questionnaires (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  slug        text not null unique,
  status      public.enquete_satisfaction_questionnaire_status not null default 'draft',
  -- settings : { anonymous, google_review_url, threshold, welcome_title,
  --              welcome_text, estimated_minutes, service_types[] }
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Questions d'un questionnaire
create table public.enquete_satisfaction_questions (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.enquete_satisfaction_questionnaires (id) on delete cascade,
  title            text not null,
  description      text,
  type             public.enquete_satisfaction_question_type not null,
  -- options : { choices:[], min_label, max_label, placeholder, variant }
  options          jsonb not null default '{}'::jsonb,
  -- conditions : { combinator:'and'|'or', rules:[{question_id, op, value}] }
  -- ops : eq neq lt lte gt gte contains
  conditions       jsonb not null default '{}'::jsonb,
  required         boolean not null default false,
  position         int not null default 0,
  created_at       timestamptz not null default now()
);

-- Campagnes de diffusion
create table public.enquete_satisfaction_campaigns (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.enquete_satisfaction_questionnaires (id) on delete cascade,
  name             text not null,
  status           public.enquete_satisfaction_campaign_status not null default 'draft',
  channel          text not null default 'link',      -- link | email | sms | qrcode
  goal_responses   int,
  start_date       date,
  end_date         date,
  created_at       timestamptz not null default now()
);

-- Invitations (liens uniques à jeton sécurisé)
create table public.enquete_satisfaction_survey_invitations (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid references public.enquete_satisfaction_campaigns (id) on delete set null,
  questionnaire_id uuid not null references public.enquete_satisfaction_questionnaires (id) on delete cascade,
  advisor_id       uuid references public.enquete_satisfaction_advisors (id) on delete set null,
  service_type     text,
  secure_token     text not null unique default encode(gen_random_bytes(24), 'hex'),
  recipient_name   text,
  recipient_email  text,
  status           public.enquete_satisfaction_invitation_status not null default 'pending',
  sent_at          timestamptz,
  opened_at        timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- Réponses aux questionnaires
create table public.enquete_satisfaction_survey_responses (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.enquete_satisfaction_questionnaires (id) on delete cascade,
  invitation_id    uuid references public.enquete_satisfaction_survey_invitations (id) on delete set null,
  advisor_id       uuid references public.enquete_satisfaction_advisors (id) on delete set null,
  service_type     text,
  client_name      text,
  client_email     text,
  overall_score    int check (overall_score between 0 and 10),
  nps_score        int check (nps_score between 0 and 10),
  anonymous        boolean not null default false,
  -- answers : { "<question_id>": valeur }
  answers          jsonb not null default '{}'::jsonb,
  comment          text,
  status           public.enquete_satisfaction_response_status not null default 'new',
  duration_seconds int,
  created_at       timestamptz not null default now()
);

-- Suivi des insatisfactions
create table public.enquete_satisfaction_feedback_followups (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null references public.enquete_satisfaction_survey_responses (id) on delete cascade,
  assigned_to   uuid references public.enquete_satisfaction_advisors (id) on delete set null,
  status        public.enquete_satisfaction_followup_status not null default 'new',
  internal_note text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Historique des actions sur un suivi
create table public.enquete_satisfaction_followup_events (
  id          uuid primary key default gen_random_uuid(),
  followup_id uuid not null references public.enquete_satisfaction_feedback_followups (id) on delete cascade,
  user_id     uuid references public.enquete_satisfaction_profiles (id) on delete set null,
  action      text not null,              -- created | assigned | status_change | note | resolved
  note        text,
  created_at  timestamptz not null default now()
);

-- Notifications internes
create table public.enquete_satisfaction_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.enquete_satisfaction_profiles (id) on delete cascade,
  title      text not null,
  message    text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Journal d'audit des actions administratives
create table public.enquete_satisfaction_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.enquete_satisfaction_profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- Paramètres du cabinet (ligne unique)
create table public.enquete_satisfaction_settings (
  id    uuid primary key default gen_random_uuid(),
  key   text not null unique default 'cabinet',
  value jsonb not null default '{}'::jsonb,
  -- value : { company_name, address, phone, email, google_review_url,
  --           satisfaction_threshold, nps_threshold, retention_months,
  --           notify_low_score, notify_manager_delay_hours, weekly_digest,
  --           monthly_report, legal_notice, privacy_policy }
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- INDEX
-- ----------------------------------------------------------------------------
create index enq_sat_idx_questions_questionnaire on public.enquete_satisfaction_questions (questionnaire_id, position);
create index enq_sat_idx_invitations_token       on public.enquete_satisfaction_survey_invitations (secure_token);
create index enq_sat_idx_invitations_campaign    on public.enquete_satisfaction_survey_invitations (campaign_id);
create index enq_sat_idx_responses_questionnaire on public.enquete_satisfaction_survey_responses (questionnaire_id);
create index enq_sat_idx_responses_advisor       on public.enquete_satisfaction_survey_responses (advisor_id);
create index enq_sat_idx_responses_created       on public.enquete_satisfaction_survey_responses (created_at desc);
create index enq_sat_idx_responses_score         on public.enquete_satisfaction_survey_responses (overall_score);
create index enq_sat_idx_followups_response      on public.enquete_satisfaction_feedback_followups (response_id);
create index enq_sat_idx_followups_status        on public.enquete_satisfaction_feedback_followups (status);
create index enq_sat_idx_notifications_user      on public.enquete_satisfaction_notifications (user_id, read_at);
create index enq_sat_idx_audit_entity            on public.enquete_satisfaction_audit_logs (entity_type, entity_id);
create index enq_sat_idx_campaigns_questionnaire on public.enquete_satisfaction_campaigns (questionnaire_id);

-- ----------------------------------------------------------------------------
-- TRIGGER updated_at
-- ----------------------------------------------------------------------------
create or replace function public.enquete_satisfaction_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_questionnaires_touch before update on public.enquete_satisfaction_questionnaires
  for each row execute function public.enquete_satisfaction_touch_updated_at();
create trigger trg_settings_touch before update on public.enquete_satisfaction_settings
  for each row execute function public.enquete_satisfaction_touch_updated_at();

-- ----------------------------------------------------------------------------
-- HELPERS DE SÉCURITÉ
-- ----------------------------------------------------------------------------

-- Rôle applicatif de l'utilisateur courant (SECURITY DEFINER : pas de récursion RLS)
create or replace function public.enquete_satisfaction_app_role()
returns public.enquete_satisfaction_app_role language sql stable security definer
set search_path = public as $$
  select role from public.enquete_satisfaction_profiles where id = auth.uid() and active
$$;

-- L'utilisateur courant est-il un membre du personnel ?
create or replace function public.enquete_satisfaction_is_staff()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.enquete_satisfaction_profiles
    where id = auth.uid() and active
  )
$$;

-- advisor_id lié à l'utilisateur courant (pour le rôle advisor)
create or replace function public.enquete_satisfaction_my_advisor_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select id from public.enquete_satisfaction_advisors where profile_id = auth.uid() and active limit 1
$$;

-- ----------------------------------------------------------------------------
-- FONCTIONS PUBLIQUES (espace client, accessibles en anonyme)
-- ----------------------------------------------------------------------------

-- Contexte d'un lien d'invitation sécurisé : ne retourne que le nécessaire
create or replace function public.enquete_satisfaction_get_invitation_context(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_inv public.enquete_satisfaction_survey_invitations;
  v_adv public.enquete_satisfaction_advisors;
begin
  select * into v_inv from public.enquete_satisfaction_survey_invitations where secure_token = p_token;
  if not found then return null; end if;

  if v_inv.status = 'pending' or v_inv.status = 'sent' then
    update public.enquete_satisfaction_survey_invitations
      set status = 'opened', opened_at = coalesce(opened_at, now())
      where id = v_inv.id;
  end if;

  select * into v_adv from public.enquete_satisfaction_advisors where id = v_inv.advisor_id;

  return jsonb_build_object(
    'invitation_id',    v_inv.id,
    'questionnaire_id', v_inv.questionnaire_id,
    'advisor_id',       v_inv.advisor_id,
    'advisor_name',     v_adv.full_name,
    'service_type',     v_inv.service_type,
    'recipient_name',   v_inv.recipient_name,
    'recipient_email',  v_inv.recipient_email,
    'completed',        v_inv.status = 'completed'
  );
end $$;

-- Soumission d'une réponse (point d'entrée unique, contrôlé)
create or replace function public.enquete_satisfaction_submit_survey_response(
  p_questionnaire_id uuid,
  p_invitation_token text default null,
  p_advisor_id       uuid default null,
  p_service_type     text default null,
  p_client_name      text default null,
  p_client_email     text default null,
  p_overall_score    int default null,
  p_nps_score        int default null,
  p_anonymous        boolean default false,
  p_answers          jsonb default '{}'::jsonb,
  p_comment          text default null,
  p_duration_seconds int default null
) returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_q        public.enquete_satisfaction_questionnaires;
  v_inv      public.enquete_satisfaction_survey_invitations;
  v_response uuid;
  v_threshold int := 6;
  v_staff    record;
  v_advisor_profile uuid;
begin
  -- 1. Le questionnaire doit être actif
  select * into v_q from public.enquete_satisfaction_questionnaires
    where id = p_questionnaire_id and status = 'active';
  if not found then
    raise exception 'questionnaire_unavailable';
  end if;

  -- 2. Si un jeton est fourni : il doit exister, correspondre au questionnaire
  --    et ne pas avoir déjà été utilisé (protection double soumission)
  if p_invitation_token is not null then
    select * into v_inv from public.enquete_satisfaction_survey_invitations where secure_token = p_invitation_token;
    if not found then
      raise exception 'invalid_token';
    end if;
    if v_inv.questionnaire_id <> p_questionnaire_id then
      raise exception 'token_mismatch';
    end if;
    if v_inv.status = 'completed' then
      raise exception 'already_completed';
    end if;
    -- L'invitation impose le conseiller / la prestation si définis
    p_advisor_id   := coalesce(v_inv.advisor_id, p_advisor_id);
    p_service_type := coalesce(v_inv.service_type, p_service_type);
  end if;

  -- 3. Anonymat : ne jamais stocker d'identité si anonyme
  if p_anonymous then
    p_client_name := null;
    p_client_email := null;
  end if;

  -- 4. Insertion de la réponse
  insert into public.enquete_satisfaction_survey_responses (
    questionnaire_id, invitation_id, advisor_id, service_type,
    client_name, client_email, overall_score, nps_score,
    anonymous, answers, comment, duration_seconds
  ) values (
    p_questionnaire_id, v_inv.id, p_advisor_id, p_service_type,
    p_client_name, p_client_email, p_overall_score, p_nps_score,
    p_anonymous, coalesce(p_answers, '{}'::jsonb), p_comment, p_duration_seconds
  ) returning id into v_response;

  -- 5. Marquer l'invitation comme complétée
  if v_inv.id is not null then
    update public.enquete_satisfaction_survey_invitations
      set status = 'completed', completed_at = now()
      where id = v_inv.id;
  end if;

  -- 6. Seuil d'alerte depuis les paramètres
  select coalesce((value->>'satisfaction_threshold')::int, 6)
    into v_threshold from public.enquete_satisfaction_settings where key = 'cabinet';

  -- 7. Note faible -> création d'un suivi + notifications
  if p_overall_score is not null and p_overall_score <= v_threshold then
    insert into public.enquete_satisfaction_feedback_followups (response_id, assigned_to, status)
    values (v_response, p_advisor_id, 'new');

    for v_staff in
      select id from public.enquete_satisfaction_profiles
      where active and role in ('admin', 'manager')
    loop
      insert into public.enquete_satisfaction_notifications (user_id, title, message, link)
      values (
        v_staff.id,
        'Nouvelle insatisfaction détectée',
        'Un client a attribué la note de ' || p_overall_score || '/10. Un suivi a été créé.',
        '/admin/insatisfactions'
      );
    end loop;

    -- Notification au conseiller concerné s'il a un compte
    if p_advisor_id is not null then
      select profile_id into v_advisor_profile
        from public.enquete_satisfaction_advisors where id = p_advisor_id;
      if v_advisor_profile is not null then
        insert into public.enquete_satisfaction_notifications (user_id, title, message, link)
        values (
          v_advisor_profile,
          'Avis client à traiter',
          'Un de vos clients a attribué la note de ' || p_overall_score || '/10.',
          '/admin/insatisfactions'
        );
      end if;
    end if;
  end if;

  return v_response;
end $$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.enquete_satisfaction_profiles            enable row level security;
alter table public.enquete_satisfaction_advisors            enable row level security;
alter table public.enquete_satisfaction_questionnaires      enable row level security;
alter table public.enquete_satisfaction_questions           enable row level security;
alter table public.enquete_satisfaction_campaigns           enable row level security;
alter table public.enquete_satisfaction_survey_invitations  enable row level security;
alter table public.enquete_satisfaction_survey_responses    enable row level security;
alter table public.enquete_satisfaction_feedback_followups  enable row level security;
alter table public.enquete_satisfaction_followup_events     enable row level security;
alter table public.enquete_satisfaction_notifications       enable row level security;
alter table public.enquete_satisfaction_audit_logs          enable row level security;
alter table public.enquete_satisfaction_settings            enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles: lire son profil" on public.enquete_satisfaction_profiles
  for select to authenticated using (id = auth.uid() or public.enquete_satisfaction_app_role() in ('admin','manager'));
create policy "profiles: admin gère" on public.enquete_satisfaction_profiles
  for all to authenticated using (public.enquete_satisfaction_app_role() = 'admin')
  with check (public.enquete_satisfaction_app_role() = 'admin');
create policy "profiles: maj soi-même" on public.enquete_satisfaction_profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = public.enquete_satisfaction_app_role());

-- advisors ---------------------------------------------------------------
create policy "advisors: lecture personnel" on public.enquete_satisfaction_advisors
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "advisors: admin/manager écrivent" on public.enquete_satisfaction_advisors
  for all to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));
-- Un conseiller peut voir sa propre fiche même avec rôle viewer (is_staff la couvre)

-- questionnaires ---------------------------------------------------------
-- Anonyme : lecture des questionnaires actifs uniquement (rendu du survey)
create policy "questionnaires: lecture publique actifs" on public.enquete_satisfaction_questionnaires
  for select to anon using (status = 'active');
create policy "questionnaires: lecture personnel" on public.enquete_satisfaction_questionnaires
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "questionnaires: admin/manager écrivent" on public.enquete_satisfaction_questionnaires
  for all to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));

-- questions --------------------------------------------------------------
create policy "questions: lecture publique actives" on public.enquete_satisfaction_questions
  for select to anon using (
    exists (select 1 from public.enquete_satisfaction_questionnaires q
            where q.id = questionnaire_id and q.status = 'active')
  );
create policy "questions: lecture personnel" on public.enquete_satisfaction_questions
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "questions: admin/manager écrivent" on public.enquete_satisfaction_questions
  for all to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));

-- campaigns --------------------------------------------------------------
create policy "campaigns: personnel" on public.enquete_satisfaction_campaigns
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "campaigns: admin/manager écrivent" on public.enquete_satisfaction_campaigns
  for all to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));

-- survey_invitations -----------------------------------------------------
-- PAS de lecture anonyme : seule la fonction get_invitation_context y accède
create policy "invitations: personnel" on public.enquete_satisfaction_survey_invitations
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "invitations: admin/manager écrivent" on public.enquete_satisfaction_survey_invitations
  for all to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));

-- survey_responses -------------------------------------------------------
-- PAS d'insert anonyme direct : tout passe par submit_survey_response()
create policy "responses: admin/manager tout" on public.enquete_satisfaction_survey_responses
  for select to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'));
create policy "responses: viewer lit" on public.enquete_satisfaction_survey_responses
  for select to authenticated using (public.enquete_satisfaction_app_role() = 'viewer');
create policy "responses: advisor lit les siennes" on public.enquete_satisfaction_survey_responses
  for select to authenticated using (
    public.enquete_satisfaction_app_role() = 'advisor' and advisor_id = public.enquete_satisfaction_my_advisor_id()
  );
create policy "responses: admin/manager modifient" on public.enquete_satisfaction_survey_responses
  for update to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));
create policy "responses: admin supprime" on public.enquete_satisfaction_survey_responses
  for delete to authenticated using (public.enquete_satisfaction_app_role() = 'admin');

-- feedback_followups -----------------------------------------------------
create policy "followups: admin/manager tout" on public.enquete_satisfaction_feedback_followups
  for all to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'))
  with check (public.enquete_satisfaction_app_role() in ('admin','manager'));
create policy "followups: advisor lit les siens" on public.enquete_satisfaction_feedback_followups
  for select to authenticated using (
    public.enquete_satisfaction_app_role() = 'advisor' and assigned_to = public.enquete_satisfaction_my_advisor_id()
  );
create policy "followups: advisor met à jour les siens" on public.enquete_satisfaction_feedback_followups
  for update to authenticated using (
    public.enquete_satisfaction_app_role() = 'advisor' and assigned_to = public.enquete_satisfaction_my_advisor_id()
  ) with check (assigned_to = public.enquete_satisfaction_my_advisor_id());
create policy "followups: viewer lit" on public.enquete_satisfaction_feedback_followups
  for select to authenticated using (public.enquete_satisfaction_app_role() = 'viewer');

-- followup_events --------------------------------------------------------
create policy "events: lecture personnel" on public.enquete_satisfaction_followup_events
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "events: insertion personnel" on public.enquete_satisfaction_followup_events
  for insert to authenticated with check (public.enquete_satisfaction_is_staff());

-- notifications ----------------------------------------------------------
create policy "notifications: lire les siennes" on public.enquete_satisfaction_notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: marquer lues" on public.enquete_satisfaction_notifications
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_logs -------------------------------------------------------------
create policy "audit: lecture admin/manager" on public.enquete_satisfaction_audit_logs
  for select to authenticated using (public.enquete_satisfaction_app_role() in ('admin','manager'));
create policy "audit: insertion personnel" on public.enquete_satisfaction_audit_logs
  for insert to authenticated with check (public.enquete_satisfaction_is_staff());

-- settings ---------------------------------------------------------------
create policy "settings: lecture personnel" on public.enquete_satisfaction_settings
  for select to authenticated using (public.enquete_satisfaction_is_staff());
create policy "settings: admin modifie" on public.enquete_satisfaction_settings
  for all to authenticated using (public.enquete_satisfaction_app_role() = 'admin')
  with check (public.enquete_satisfaction_app_role() = 'admin');
-- Le seuil et l'URL Google servent aussi côté public via fonction dédiée
create or replace function public.enquete_satisfaction_get_public_settings()
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'google_review_url', value->>'google_review_url',
    'company_name',      value->>'company_name'
  ) from public.enquete_satisfaction_settings where key = 'cabinet'
$$;

-- Liste publique minimale des conseillers (étape d'identification facultative)
create or replace function public.enquete_satisfaction_get_advisors_public()
returns jsonb language sql stable security definer
set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name) order by full_name), '[]'::jsonb)
  from public.enquete_satisfaction_advisors where active
$$;

-- ----------------------------------------------------------------------------
-- PRIVILÈGES DE BASE — la RLS fait le filtrage fin ; ces grants donnent
-- seulement accès aux objets (reproduit les defaults de Supabase hébergé).
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
-- Grants scopés UNIQUEMENT aux tables de ce projet (base potentiellement
-- partagée avec d'autres applications — ne pas utiliser "all tables").
grant select, insert, update, delete on
  public.enquete_satisfaction_profiles,
  public.enquete_satisfaction_advisors,
  public.enquete_satisfaction_questionnaires,
  public.enquete_satisfaction_questions,
  public.enquete_satisfaction_campaigns,
  public.enquete_satisfaction_survey_invitations,
  public.enquete_satisfaction_survey_responses,
  public.enquete_satisfaction_feedback_followups,
  public.enquete_satisfaction_followup_events,
  public.enquete_satisfaction_notifications,
  public.enquete_satisfaction_audit_logs,
  public.enquete_satisfaction_settings
to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- GRANTS pour les fonctions publiques (rôle anon de l'API Supabase)
-- ----------------------------------------------------------------------------
grant execute on function public.enquete_satisfaction_get_advisors_public() to anon, authenticated;
grant execute on function public.enquete_satisfaction_get_invitation_context(text) to anon, authenticated;
grant execute on function public.enquete_satisfaction_submit_survey_response(uuid, text, uuid, text, text, text, int, int, boolean, jsonb, text, int) to anon, authenticated;
grant execute on function public.enquete_satisfaction_get_public_settings() to anon, authenticated;
