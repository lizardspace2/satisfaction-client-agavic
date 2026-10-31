# AGAVIC Satisfaction — Plateforme de mesure de la satisfaction client

Application web complète (React + TypeScript + Supabase + Tailwind) permettant au cabinet
**AGAVIC Patrimoine** de recueillir, mesurer et piloter la satisfaction de ses clients.

## Fonctionnalités

### Espace client (public, sans compte)
- Questionnaire fluide style Typeform : `/avis/:slug` ou lien unique `/avis/:slug/:token`
- Accueil personnalisable, identification facultative (anonymat possible)
- Notation 0-10, étoiles, choix, NPS, texte libre, oui/non, date, e-mail, liste déroulante
- **Moteur de logique conditionnelle** (SI note ≤ 6 → parcours insatisfaction…)
- Sauvegarde automatique du brouillon, reprise, protection double soumission
- Écran de remerciement : lien Google Business **réservé aux notes ≥ 9/10** ; en dessous, contact direct proposé au cabinet

### Espace cabinet (`/admin`, sécurisé)
- **Tableau de bord** : KPIs temps réel, évolution, répartition, motifs, satisfaction/conseiller
- **Avis clients** : recherche, filtres, tri, détail, archivage, suppression (confirmée), export Excel
- **Insatisfactions** : suivi nouveau → affecté → en cours → traité, notes internes privées, historique
- **Éditeur de questionnaires** : glisser-déposer, 11 types de questions, éditeur visuel de conditions
- **Campagnes** : liens uniques à jeton sécurisé, QR codes, suivi envoyés/ouverts/répondus
- **Conseillers**, **Rapports** (PDF + Excel), **Paramètres cabinet**, **Journal d'audit**
- Rôles : `admin`, `manager` (responsable), `advisor` (conseiller), `viewer` (lecture seule)
- Notifications temps réel en cas de note faible, mode clair/sombre, responsive

## Mise en route (≈ 10 min)

### 1. Créer le projet Supabase
1. Allez sur [supabase.com](https://supabase.com) → *New project* (gratuit)
2. Ouvrez **SQL Editor** → *New query*
3. Collez le contenu de **`supabase/schema.sql`** → *Run*
4. Collez le contenu de **`supabase/seed.sql`** → *Run* (crée les données de démo + 3 comptes)

### 2. Connecter l'application
```bash
cp .env.example .env.local
```
Renseignez dans `.env.local` (Dashboard Supabase → *Settings* → *API*) :
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Lancer
```bash
npm install
npm run dev
```

### 4. Se connecter
| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@agavic-demo.fr` | `Admin2026!` |
| Responsable | `responsable@agavic-demo.fr` | `Manager2026!` |
| Conseiller | `conseiller@agavic-demo.fr` | `Conseiller2026!` |

**Lien client de démo** : `http://localhost:5173/avis/satisfaction-rendez-vous`

## Créer un vrai compte utilisateur
1. Supabase Dashboard → *Authentication* → *Add user* → e-mail + mot de passe
2. Copiez l'UUID de l'utilisateur puis dans le SQL Editor :
```sql
insert into public.enquete_satisfaction_profiles (id, full_name, email, role)
values ('<uuid-utilisateur>', 'Prénom Nom', 'email@agavic.fr', 'admin');
```

## Sécurité (conçue dès le départ)
- Aucune clé `service_role` côté client — uniquement la clé `anon` protégée par RLS
- Les réponses sont insérées **uniquement** via la fonction `enquete_satisfaction_submit_survey_response()`
  (validation du questionnaire actif, du jeton, anti double-soumission, anonymisation)
- Les données d'invitation passent par `enquete_satisfaction_get_invitation_context()` — aucune lecture directe
- Notes internes et réponses : réservées au personnel authentifié, filtrées par rôle
- RGPD : anonymat possible, durée de conservation configurable, suppression confirmée

## Intégrations futures
L'architecture est prête pour brancher **Resend** ou **Brevo** (e-mails transactionnels)
et un fournisseur **SMS** via Supabase Edge Functions — les points d'extension sont les
tables `enquete_satisfaction_campaigns`/`enquete_satisfaction_survey_invitations` et les paramètres `notify_*`/`weekly_digest`/`monthly_report`.

## Déploiement Vercel
```bash
npm run build        # vérifie tsc + produit dist/
```
Sur Vercel : importer le repo, ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
dans *Environment Variables*, déployer. (SPA : ajouter un `vercel.json` avec
rewrites vers `index.html` — fourni.)

## Stack
React 19 · TypeScript · Vite · Tailwind CSS 3 · composants Radix/shadcn-style ·
Supabase (Auth + Postgres + RLS + RPC) · Recharts · dnd-kit · jsPDF · SheetJS · qrcode ·
Framer Motion · sonner · date-fns
