-- ============================================================================
-- AGAVIC SATISFACTION — Données de démonstration
-- À exécuter APRÈS schema.sql dans le SQL Editor Supabase.
-- Toutes les données sont fictives — aucune donnée client réelle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PARAMÈTRES DU CABINET
-- ----------------------------------------------------------------------------
-- google_review_url : remplacer par le vrai lien d'avis Google Business
-- (« Demander des avis » dans la fiche → https://g.page/r/XXXXXXXXXXX/review
--  ou https://search.google.com/local/writereview?placeid=ChIJ...)
insert into public.enquete_satisfaction_settings (key, value) values ('cabinet', '{
  "company_name": "AGAVIC Patrimoine",
  "address": "45 rue de la Bourse, 69002 Lyon",
  "phone": "04 78 34 73 09",
  "email": "contact@agavic.fr",
  "google_review_url": "https://search.google.com/local/writereview?placeid=A_REMPLACER",
  "satisfaction_threshold": 6,
  "anonymous_allowed": true,
  "retention_months": 36,
  "notify_low_score": true,
  "notify_manager_delay_hours": 48,
  "weekly_digest": true,
  "monthly_report": true,
  "legal_notice": "AGAVIC Patrimoine — SAS au capital de 250 000 € — RCS Lyon. Directeur de la publication : la direction du cabinet.",
  "privacy_policy": "Les réponses à ce questionnaire sont utilisées exclusivement pour améliorer la qualité de notre accompagnement. Elles sont conservées 36 mois puis supprimées. Conformément au RGPD, vous disposez d''un droit d''accès, de rectification et de suppression de vos données en écrivant à contact@agavic.fr."
}'::jsonb);

-- ----------------------------------------------------------------------------
-- 2. COMPTES DE DÉMONSTRATION (auth + profils)
--    Mots de passe : Admin2026! / Manager2026! / Conseiller2026!
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, email_change_confirm_status, phone, phone_change, phone_change_token,
  reauthentication_token, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000001','authenticated','authenticated','admin@agavic-demo.fr',    crypt('Admin2026!', gen_salt('bf')), now(), '', '', '', '', '', 0, null, '', '', '', now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Direction AGAVIC"}', false),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000002','authenticated','authenticated','responsable@agavic-demo.fr',crypt('Manager2026!', gen_salt('bf')), now(), '', '', '', '', '', 0, null, '', '', '', now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Claire Fontaine"}', false),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000003','authenticated','authenticated','conseiller@agavic-demo.fr', crypt('Conseiller2026!', gen_salt('bf')), now(), '', '', '', '', '', 0, null, '', '', '', now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Marc Delaunay"}', false)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in ('e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000003')
on conflict do nothing;

insert into public.enquete_satisfaction_profiles (id, full_name, email, role, active) values
  ('e0000000-0000-4000-8000-000000000001','Direction AGAVIC','admin@agavic-demo.fr','admin', true),
  ('e0000000-0000-4000-8000-000000000002','Claire Fontaine','responsable@agavic-demo.fr','manager', true),
  ('e0000000-0000-4000-8000-000000000003','Marc Delaunay','conseiller@agavic-demo.fr','advisor', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. CONSEILLERS (fictifs)
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_advisors (id, profile_id, full_name, email, position, active) values
  ('a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000003','Marc Delaunay','m.delaunay@agavic-demo.fr','Conseiller en gestion de patrimoine', true),
  ('a0000000-0000-4000-8000-000000000002',null,'Sophie Bertrand','s.bertrand@agavic-demo.fr','Conseillère en gestion de patrimoine', true),
  ('a0000000-0000-4000-8000-000000000003',null,'Julien Roche','j.roche@agavic-demo.fr','Expert retraite', true),
  ('a0000000-0000-4000-8000-000000000004',null,'Élise Marchand','e.marchand@agavic-demo.fr','Conseillère épargne salariale', true),
  ('a0000000-0000-4000-8000-000000000005',null,'Thomas Vial','t.vial@agavic-demo.fr','Conseiller prévoyance', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. QUESTIONNAIRES (5 modèles)
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_questionnaires (id, title, description, slug, status, settings) values
  ('b0000000-0000-4000-8000-000000000001','Satisfaction post-rendez-vous','Questionnaire principal envoyé après chaque rendez-vous client.','satisfaction-rendez-vous','active',
   '{"anonymous":true,"estimated_minutes":"1 à 2","welcome_title":"Votre avis nous intéresse !","welcome_text":"Votre retour est précieux pour nous aider à améliorer la qualité de nos conseils et de notre accompagnement patrimonial.","service_types":["Bilan patrimonial","Conseil en investissement","Assurance-vie","PER et préparation retraite","SCPI","Transmission de patrimoine","Souscription d''un contrat","Rendez-vous annuel"]}'::jsonb),
  ('b0000000-0000-4000-8000-000000000002','Bilan patrimonial','Satisfaction après la remise d''un bilan patrimonial complet.','bilan-patrimonial','active',
   '{"anonymous":true,"estimated_minutes":"2","service_types":["Bilan patrimonial"]}'::jsonb),
  ('b0000000-0000-4000-8000-000000000003','Épargne retraite (PER)','Suivi des clients accompagnés sur la préparation retraite.','epargne-retraite','active',
   '{"anonymous":true,"estimated_minutes":"2","service_types":["PER et préparation retraite","Rendez-vous annuel"]}'::jsonb),
  ('b0000000-0000-4000-8000-000000000004','Épargne salariale','Satisfaction des chefs d''entreprise sur les dispositifs PEE/PERECO.','epargne-salariale','draft',
   '{"anonymous":false,"estimated_minutes":"2","service_types":["Épargne salariale","PEE / PERECO"]}'::jsonb),
  ('b0000000-0000-4000-8000-000000000005','Point annuel client','Questionnaire court pour le rendez-vous annuel de suivi.','point-annuel','archived',
   '{"anonymous":true,"estimated_minutes":"1","service_types":["Rendez-vous annuel"]}'::jsonb)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. QUESTIONS
--    La question "overall" porte options.role='overall' : elle alimente
--    overall_score et déclenche la logique conditionnelle.
-- ----------------------------------------------------------------------------
-- Questionnaire 1 : Satisfaction post-rendez-vous (complet, avec conditions)
insert into public.enquete_satisfaction_questions (id, questionnaire_id, title, description, type, options, conditions, required, position) values
  ('d0000000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','Comment évaluez-vous votre expérience avec AGAVIC Patrimoine ?','Attribuez une note de 0 à 10.','score_10','{"role":"overall","min_label":"Pas du tout satisfait","max_label":"Très satisfait"}','{}', true, 1),
  ('d0000000-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','La qualité des conseils patrimoniaux','','stars','{}','{}', false, 2),
  ('d0000000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000001','La disponibilité de votre conseiller','','stars','{}','{}', false, 3),
  ('d0000000-0000-4000-8000-000000000104','b0000000-0000-4000-8000-000000000001','La clarté des explications fournies','','stars','{}','{}', false, 4),
  ('d0000000-0000-4000-8000-000000000105','b0000000-0000-4000-8000-000000000001','Le suivi et l''accompagnement','','stars','{}','{}', false, 5),
  ('d0000000-0000-4000-8000-000000000106','b0000000-0000-4000-8000-000000000001','La confiance que vous accordez au cabinet','','stars','{}','{}', false, 6),
  -- Bloc insatisfaction (note <= 6)
  ('d0000000-0000-4000-8000-000000000107','b0000000-0000-4000-8000-000000000001','Nous sommes désolés que votre expérience n''ait pas été à la hauteur de vos attentes.','Cela nous aidera à nous améliorer rapidement.','message','{"variant":"empathy"}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"lte","value":6}]}', false, 7),
  ('d0000000-0000-4000-8000-000000000108','b0000000-0000-4000-8000-000000000001','Pouvez-vous nous en dire davantage sur ce qui n''a pas fonctionné ?','','multi_choice','{"choices":["Qualité du conseil","Disponibilité du conseiller","Suivi de votre dossier","Clarté des informations","Délai de réponse","Frais et conditions","Autre problème"]}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"lte","value":6}]}', false, 8),
  ('d0000000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-000000000001','Décrivez votre expérience en quelques mots','','text','{"placeholder":"Décrivez votre expérience en quelques mots...","max_length":500,"role":"comment"}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"lte","value":6}]}', false, 9),
  -- Bloc amélioration (note 7-8)
  ('d0000000-0000-4000-8000-000000000110','b0000000-0000-4000-8000-000000000001','Merci pour votre retour !','Quels points pourrions-nous encore améliorer ?','message','{"variant":"neutral"}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"gte","value":7},{"question_id":"d0000000-0000-4000-8000-000000000101","op":"lte","value":8}]}', false, 10),
  ('d0000000-0000-4000-8000-000000000111','b0000000-0000-4000-8000-000000000001','Avez-vous des suggestions d''amélioration ?','','text','{"placeholder":"Vos suggestions...","max_length":500,"role":"comment"}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"gte","value":7},{"question_id":"d0000000-0000-4000-8000-000000000101","op":"lte","value":8}]}', false, 11),
  -- Bloc satisfaction (note 9-10)
  ('d0000000-0000-4000-8000-000000000112','b0000000-0000-4000-8000-000000000001','Merci beaucoup pour votre retour !','Votre satisfaction nous fait vraiment plaisir.','message','{"variant":"positive"}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"gte","value":9}]}', false, 12),
  ('d0000000-0000-4000-8000-000000000113','b0000000-0000-4000-8000-000000000001','Un commentaire à partager ? (facultatif)','','text','{"placeholder":"Quelques mots sur votre expérience...","max_length":500,"role":"comment"}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000101","op":"gte","value":9}]}', false, 13),
  -- Commun
  ('d0000000-0000-4000-8000-000000000114','b0000000-0000-4000-8000-000000000001','Recommanderiez-vous AGAVIC Patrimoine à votre entourage ?','','nps','{"role":"nps","min_label":"Pas du tout probable","max_label":"Très probable"}','{}', false, 14);

-- Questionnaire 2 : Bilan patrimonial
insert into public.enquete_satisfaction_questions (id, questionnaire_id, title, description, type, options, conditions, required, position) values
  ('d0000000-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000002','Comment évaluez-vous votre bilan patrimonial ?','','score_10','{"role":"overall","min_label":"Pas du tout satisfait","max_label":"Très satisfait"}','{}', true, 1),
  ('d0000000-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000002','Les recommandations correspondent-elles à vos objectifs ?','','single_choice','{"choices":["Tout à fait","Plutôt oui","Partiellement","Non"]}','{}', false, 2),
  ('d0000000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000002','Les explications vous ont-elles permis de comprendre les stratégies proposées ?','','yes_no','{}','{}', false, 3),
  ('d0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000002','Qu''est-ce qui pourrait être amélioré ?','','text','{"role":"comment","max_length":500}','{"combinator":"and","rules":[{"question_id":"d0000000-0000-4000-8000-000000000201","op":"lte","value":8}]}', false, 4),
  ('d0000000-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000002','Recommanderiez-vous ce bilan à votre entourage ?','','nps','{"role":"nps"}','{}', false, 5);

-- Questionnaire 3 : Épargne retraite
insert into public.enquete_satisfaction_questions (id, questionnaire_id, title, description, type, options, conditions, required, position) values
  ('d0000000-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000003','Comment évaluez-vous notre accompagnement retraite ?','','score_10','{"role":"overall","min_label":"Pas du tout satisfait","max_label":"Très satisfait"}','{}', true, 1),
  ('d0000000-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000003','La projection de vos revenus à la retraite était-elle claire ?','','stars','{}','{}', false, 2),
  ('d0000000-0000-4000-8000-000000000303','b0000000-0000-4000-8000-000000000003','La stratégie proposée vous semble-t-elle adaptée ?','','single_choice','{"choices":["Tout à fait adaptée","Plutôt adaptée","À revoir","Non adaptée"]}','{}', false, 3),
  ('d0000000-0000-4000-8000-000000000304','b0000000-0000-4000-8000-000000000003','Souhaitez-vous être rappelé pour approfondir un point ?','','yes_no','{}','{}', false, 4),
  ('d0000000-0000-4000-8000-000000000305','b0000000-0000-4000-8000-000000000003','Commentaire libre','','text','{"role":"comment","max_length":500}','{}', false, 5);

-- Questionnaire 4 : Épargne salariale
insert into public.enquete_satisfaction_questions (id, questionnaire_id, title, description, type, options, conditions, required, position) values
  ('d0000000-0000-4000-8000-000000000401','b0000000-0000-4000-8000-000000000004','Comment évaluez-vous notre accompagnement épargne salariale ?','','score_10','{"role":"overall"}','{}', true, 1),
  ('d0000000-0000-4000-8000-000000000402','b0000000-0000-4000-8000-000000000004','Qualité de la mise en place du dispositif','','stars','{}','{}', false, 2),
  ('d0000000-0000-4000-8000-000000000403','b0000000-0000-4000-8000-000000000004','Communication avec vos salariés','','stars','{}','{}', false, 3),
  ('d0000000-0000-4000-8000-000000000404','b0000000-0000-4000-8000-000000000004','Commentaire libre','','text','{"role":"comment","max_length":500}','{}', false, 4);

-- Questionnaire 5 : Point annuel
insert into public.enquete_satisfaction_questions (id, questionnaire_id, title, description, type, options, conditions, required, position) values
  ('d0000000-0000-4000-8000-000000000501','b0000000-0000-4000-8000-000000000005','Comment évaluez-vous votre point annuel ?','','score_10','{"role":"overall"}','{}', true, 1),
  ('d0000000-0000-4000-8000-000000000502','b0000000-0000-4000-8000-000000000005','Votre situation a-t-elle été bien actualisée ?','','yes_no','{}','{}', false, 2),
  ('d0000000-0000-4000-8000-000000000503','b0000000-0000-4000-8000-000000000005','Commentaire libre','','text','{"role":"comment","max_length":500}','{}', false, 3);

-- ----------------------------------------------------------------------------
-- 6. CAMPAGNES
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_campaigns (id, questionnaire_id, name, status, channel, goal_responses, start_date, end_date) values
  ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Envois post-rendez-vous — T3 2026','active','email',80,'2026-07-01','2026-09-30'),
  ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','QR Code salle d''attente','active','qrcode',null,'2026-01-01',null),
  ('c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','Bilans patrimoniaux — octobre','active','link',30,'2026-10-01','2026-10-31'),
  ('c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000003','Campagne retraite printemps','completed','email',40,'2026-03-01','2026-05-31')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. RÉPONSES FICTIVES (~130, réparties sur 6 mois)
-- ----------------------------------------------------------------------------
do $$
declare
  v_advisors  uuid[] := array[
    'a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000005']::uuid[];
  v_qs        uuid[] := array[
    'b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000005']::uuid[];
  v_services  text[] := array['Bilan patrimonial','Conseil en investissement','Assurance-vie',
    'PER et préparation retraite','SCPI','Transmission de patrimoine','Rendez-vous annuel','Souscription d''un contrat'];
  v_names     text[] := array['Jean Morel','Brigitte Salomon','Pierre Aubert','Nathalie Fabre','Olivier Perrin',
    'Martine Lemoine','François Gillet','Isabelle Roy','André Bouvier','Hélène Charvet',
    'Paul Reynaud','Sylvie Coste','Michel Blanc','Anne Dumas','Georges Faure'];
  v_pos       text[] := array[
    'Très bon conseil et suivi personnalisé.','Explications claires, je recommande.',
    'Un accompagnement de grande qualité.','Conseiller très disponible et à l''écoute.',
    'Excellente étude patrimoniale, merci.','Rendez-vous très professionnel.',
    'Stratégie retraite bien expliquée.','Très satisfait de la prise en charge.'];
  v_mid       text[] := array[
    'Globalement satisfait, quelques délais de réponse un peu longs.',
    'Bon conseil mais j''aurais aimé plus de réactivité.',
    'Correct dans l''ensemble, le suivi pourrait être plus régulier.'];
  v_neg       text[] := array[
    'Délai de réponse trop long pour mon dossier.','Accueil un peu froid lors de mon rendez-vous.',
    'Manque d''explications sur les frais.','Manque de disponibilité parfois.',
    'Le suivi de mon dossier laisse à désirer.'];
  i int; r double precision;
  v_score int; v_q uuid; v_adv uuid; v_created timestamptz;
  v_anon boolean; v_name text; v_comment text; v_nps int;
  v_resp uuid; v_motifs jsonb;
begin
  for i in 1..130 loop
    r := random();
    v_score := case
      when r < 0.16 then 2 + floor(random() * 5)::int        -- 2..6
      when r < 0.45 then 7 + floor(random() * 2)::int        -- 7..8
      else 9 + floor(random() * 2)::int end;                 -- 9..10
    v_q       := v_qs[1 + floor(random() * array_length(v_qs, 1))::int];
    v_adv     := v_advisors[1 + floor(random() * 5)::int];
    v_created := now() - (random() * 180 || ' days')::interval - (random() * 24 || ' hours')::interval;
    v_anon    := random() < 0.22;
    v_name    := v_names[1 + floor(random() * array_length(v_names, 1))::int];
    v_nps     := greatest(0, least(10, v_score + floor(random() * 3)::int - 1));
    v_comment := case
      when v_score <= 6 then v_neg[1 + floor(random() * array_length(v_neg, 1))::int]
      when v_score <= 8 then v_mid[1 + floor(random() * array_length(v_mid, 1))::int]
      else v_pos[1 + floor(random() * array_length(v_pos, 1))::int] end;
    v_motifs  := case when v_score <= 6 then
        jsonb_build_object('d0000000-0000-4000-8000-000000000108',
          jsonb_build_array(
            (array['Qualité du conseil','Disponibilité du conseiller','Suivi du dossier','Clarté des informations','Délai de réponse','Frais et conditions'])[1 + floor(random()*6)::int],
            (array['Suivi du dossier','Délai de réponse','Autre problème'])[1 + floor(random()*3)::int]))
      else '{}'::jsonb end;

    insert into public.enquete_satisfaction_survey_responses (
      questionnaire_id, advisor_id, service_type, client_name, client_email,
      overall_score, nps_score, anonymous, answers, comment, status,
      duration_seconds, created_at
    ) values (
      v_q, v_adv, v_services[1 + floor(random() * array_length(v_services, 1))::int],
      case when v_anon then null else v_name end,
      case when v_anon then null else lower(replace(v_name, ' ', '.')) || '@exemple.fr' end,
      v_score, v_nps, v_anon,
      jsonb_build_object(
        'd0000000-0000-4000-8000-000000000101', v_score,
        'd0000000-0000-4000-8000-000000000102', least(5, 1 + floor(v_score / 2.2)::int),
        'd0000000-0000-4000-8000-000000000103', least(5, 1 + floor(random() * 5)::int)
      ) || v_motifs,
      case when random() < 0.75 then v_comment else null end,
      'new', 40 + floor(random() * 140)::int, v_created
    ) returning id into v_resp;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8. SUIVIS D'INSATISFACTION + HISTORIQUE
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_feedback_followups (response_id, assigned_to, status, internal_note, resolved_at, created_at)
select r.id, r.advisor_id,
  (case
    when random() < 0.35 then 'resolved'
    when random() < 0.65 then 'in_progress'
    when random() < 0.80 then 'assigned'
    else 'new' end)::public.enquete_satisfaction_followup_status,
  case when random() < 0.5 then
    (array['Client rappelé, point prévu la semaine prochaine.','Dossier transmis au responsable.',
           'Attente retour client après explication des frais.','RDV de régularisation planifié.'])[1 + floor(random()*4)::int]
  else null end,
  null, r.created_at + interval '2 hours'
from public.enquete_satisfaction_survey_responses r where r.overall_score <= 6;

update public.enquete_satisfaction_feedback_followups set resolved_at = created_at + (2 + random()*72 || ' hours')::interval
where status = 'resolved';

insert into public.enquete_satisfaction_followup_events (followup_id, user_id, action, note, created_at)
select f.id, 'e0000000-0000-4000-8000-000000000002', 'created', 'Création automatique — note faible détectée', f.created_at
from public.enquete_satisfaction_feedback_followups f;

insert into public.enquete_satisfaction_followup_events (followup_id, user_id, action, note, created_at)
select f.id, 'e0000000-0000-4000-8000-000000000002', 'resolved', 'Client recontacté, situation régularisée', f.resolved_at
from public.enquete_satisfaction_feedback_followups f where f.status = 'resolved';

-- ----------------------------------------------------------------------------
-- 9. INVITATIONS (liens à jeton pour tests)
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_survey_invitations (campaign_id, questionnaire_id, advisor_id, service_type, recipient_name, recipient_email, status, sent_at)
select 'c0000000-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000001',
       (array['a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000005'])[1 + (i % 5)]::uuid,
       (array['Bilan patrimonial','Rendez-vous annuel','PER et préparation retraite'])[1 + (i % 3)],
       'Client Test ' || i, 'client' || i || '@exemple.fr',
       (case when i <= 4 then 'sent' when i <= 7 then 'opened' else 'pending' end)::public.enquete_satisfaction_invitation_status,
       now() - (i || ' days')::interval
from generate_series(1, 12) i;

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATIONS DE DÉMO
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_notifications (user_id, title, message, link)
select 'e0000000-0000-4000-8000-000000000001',
       'Insatisfaction en attente de traitement',
       (select count(*) || ' insatisfactions nécessitent une action.' from public.enquete_satisfaction_feedback_followups where status = 'new'),
       '/admin/insatisfactions';

insert into public.enquete_satisfaction_notifications (user_id, title, message, link, read_at)
values
  ('e0000000-0000-4000-8000-000000000001','Récapitulatif hebdomadaire','42 réponses reçues cette semaine, note moyenne 8,4/10.','/admin/rapports', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000002','Campagne « Bilans patrimoniaux »','La campagne a atteint 60 % de son objectif.','/admin/campagnes', now() - interval '2 days');

-- ----------------------------------------------------------------------------
-- 11. JOURNAL D'AUDIT DE DÉMO
-- ----------------------------------------------------------------------------
insert into public.enquete_satisfaction_audit_logs (user_id, action, entity_type, entity_id, details, created_at)
values
  ('e0000000-0000-4000-8000-000000000001','questionnaire.update','questionnaire','b0000000-0000-4000-8000-000000000001','{"champ":"seuil","valeur":6}', now() - interval '5 days'),
  ('e0000000-0000-4000-8000-000000000002','campaign.create','campaign','c0000000-0000-4000-8000-000000000003','{"nom":"Bilans patrimoniaux — octobre"}', now() - interval '12 days'),
  ('e0000000-0000-4000-8000-000000000001','settings.update','settings',null,'{"champ":"google_review_url"}', now() - interval '20 days');
