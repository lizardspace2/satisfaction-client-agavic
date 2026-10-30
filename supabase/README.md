# Scripts SQL Supabase

> **Préfixe** : tous les objets de ce projet (tables, enums, fonctions, index)
> portent le préfixe `enquete_satisfaction_` — la base peut donc être partagée
> avec d'autres applications sans collision de noms.
> Ex. : `enquete_satisfaction_questionnaires`, `enquete_satisfaction_survey_responses`.

## Ordre d'exécution
1. **`schema.sql`** — tables, enums, index, fonctions RPC, politiques RLS.
2. **`seed.sql`** — paramètres du cabinet, 3 comptes de démo, 5 conseillers fictifs,
   5 questionnaires (dont 1 complet avec logique conditionnelle), 4 campagnes,
   ~130 réponses sur 6 mois, suivis d'insatisfaction, notifications, audit.

## Comptes de démo créés par le seed
| Rôle | E-mail | Mot de passe |
|---|---|---|
| admin | `admin@agavic-demo.fr` | `Admin2026!` |
| manager | `responsable@agavic-demo.fr` | `Manager2026!` |
| advisor | `conseiller@agavic-demo.fr` | `Conseiller2026!` |

> Si la connexion échoue (certaines versions de Supabase exigent une ligne
> `auth.identities` différente), créez l'utilisateur via Dashboard → Authentication →
> Add user, puis insérez son profil :
> ```sql
> insert into public.enquete_satisfaction_profiles (id, full_name, email, role)
> values ('<uuid>', 'Nom', 'email@agavic.fr', 'admin');
> ```

## Points d'architecture importants

### Fonctions publiques (anon)
| Fonction | Rôle |
|---|---|
| `enquete_satisfaction_get_public_settings()` | URL Google + nom du cabinet uniquement |
| `enquete_satisfaction_get_advisors_public()` | Liste (id + nom) des conseillers actifs |
| `enquete_satisfaction_get_invitation_context(token)` | Pré-remplissage d'un lien unique + marque « ouvert » |
| `enquete_satisfaction_submit_survey_response(...)` | **Seule** voie d'insertion d'une réponse : valide le questionnaire, le jeton, bloque les doublons, anonymise, crée le suivi + notifications si note ≤ seuil |

### Rôles et RLS
- `anon` : ne lit que les questionnaires/questions **actifs** ; aucune donnée client.
- `viewer` : lecture seule.
- `advisor` : lit ses propres réponses et ses suivis assignés.
- `manager` : gestion complète hors suppression de réponses et paramètres.
- `admin` : tout, y compris suppressions, paramètres, gestion des profils.

### Conventions de données
- `enquete_satisfaction_questions.options.role` : `'overall'` (note 0-10 principale), `'nps'`, `'comment'`
  — déterminent ce qui alimente `overall_score`, `nps_score`, `comment`.
- `enquete_satisfaction_questions.conditions` : `{ "combinator": "and"|"or", "rules": [{ "question_id", "op", "value" }] }`
  avec `op` ∈ `eq neq lt lte gt gte contains`. Liste vide = question toujours visible.
- `enquete_satisfaction_questionnaires.settings` : `anonymous`, `welcome_title`, `welcome_text`,
  `estimated_minutes`, `service_types[]`, `google_review_url`.
- `enquete_satisfaction_settings.value` (clé `cabinet`) : identité, seuil d'alerte, durée de conservation,
  mentions légales, bascules de notifications.

## Purge RGPD (exemple planifiable via pg_cron)
```sql
-- Supprime les réponses plus anciennes que la durée configurée
delete from public.enquete_satisfaction_survey_responses
where created_at < now() - (
  select (coalesce((value->>'retention_months')::int, 36) || ' months')::interval
  from public.enquete_satisfaction_settings where key = 'cabinet'
);
```
