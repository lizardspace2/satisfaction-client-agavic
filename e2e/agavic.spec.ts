import { test, expect, type Page } from '@playwright/test'

const SURVEY = '/avis/satisfaction-rendez-vous'
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Clé service_role du Supabase local — à définir dans .env.local (SUPABASE_SERVICE_KEY)
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY manquant : définissez-le dans .env.local')
const QUESTIONNAIRE_ID = 'b0000000-0000-4000-8000-000000000001'

/** Crée une invitation fraîche et retourne son jeton (le token est à usage unique). */
async function createInvitation(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/enquete_satisfaction_survey_invitations`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      questionnaire_id: QUESTIONNAIRE_ID,
      recipient_name: 'Client Test E2E',
      recipient_email: 'e2e-invite@exemple.fr',
      status: 'sent',
      sent_at: new Date().toISOString(),
    }),
  })
  const [row] = await res.json()
  return row.secure_token
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function startSurvey(page: Page, url = SURVEY) {
  await page.goto(url)
  await expect(page.getByRole('heading', { name: /Votre avis nous intéresse/i })).toBeVisible()
  await page.getByRole('button', { name: 'Commencer' }).click()
}

/** Passe l'étape d'identification sans rien remplir. */
async function skipIdentity(page: Page) {
  await expect(page.getByText('Quelques informations sur vous')).toBeVisible()
  await page.getByRole('button', { name: 'Suivant' }).click()
}

const STAR_TITLES = [
  'La qualité des conseils patrimoniaux',
  'La disponibilité de votre conseiller',
  'La clarté des explications fournies',
  "Le suivi et l'accompagnement",
  'La confiance que vous accordez au cabinet',
]

/** Répond aux 5 questions étoiles en attendant chaque titre (évite les courses d'animation). */
async function answerStars(page: Page, note: number) {
  for (const t of STAR_TITLES) {
    await expect(page.getByText(t)).toBeVisible()
    await page.getByRole('button', { name: `${note} étoile${note > 1 ? 's' : ''}` }).click()
  }
}

// ---------------------------------------------------------------------------
// ESPACE PUBLIC
// ---------------------------------------------------------------------------
test.describe('Espace public', () => {
  test('landing page : identité AGAVIC et accès cabinet', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('AGAVIC').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Espace cabinet' })).toBeVisible()
    await page.getByRole('link', { name: 'Espace cabinet' }).click()
    await expect(page).toHaveURL(/admin/)
  })

  test('parcours insatisfait (note 4) : logique conditionnelle + soumission', async ({ page }) => {
    await startSurvey(page)

    // Identification
    await page.getByPlaceholder('Jean Dupont').fill('Client Test E2E')
    await page.getByPlaceholder('jean.dupont@email.fr').fill('e2e@exemple.fr')
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Note globale 4/10 → doit activer le parcours insatisfaction
    await expect(page.getByText('Comment évaluez-vous votre expérience')).toBeVisible()
    await page.getByRole('button', { name: 'Note 4' }).click()

    // 5 questions étoiles
    await answerStars(page, 2)

    // Message empathique (condition note <= 6)
    await expect(page.getByText(/n'ait pas été à la hauteur/)).toBeVisible()
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Motifs d'insatisfaction
    await expect(page.getByText(/ce qui n'a pas fonctionné/)).toBeVisible()
    await page.getByRole('button', { name: 'Délai de réponse' }).click()
    await page.getByRole('button', { name: 'Suivi de votre dossier' }).click()
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Commentaire libre
    await expect(page.getByText(/Décrivez votre expérience/)).toBeVisible()
    await page.getByPlaceholder(/Décrivez votre expérience/).fill('Réponse trop lente à mon email.')
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Question NPS → dernière étape, soumission automatique
    await expect(page.getByText(/Recommanderiez-vous AGAVIC/)).toBeVisible()
    await page.getByRole('button', { name: 'Note 3' }).click()

    // Écran de remerciement
    await expect(page.getByRole('heading', { name: /Merci pour votre confiance/ })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /Laisser un avis sur Google/ })).toBeVisible()
  })

  test('parcours satisfait (note 10) : message positif + lien Google', async ({ page }) => {
    await startSurvey(page)
    await skipIdentity(page)

    await page.getByRole('button', { name: 'Note 10' }).click()
    await answerStars(page, 5)

    // Bloc satisfait (condition >= 9)
    await expect(page.getByText(/Merci beaucoup pour votre retour/)).toBeVisible()
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Commentaire facultatif → passer
    await page.getByRole('button', { name: 'Passer' }).click()

    // NPS → soumet
    await page.getByRole('button', { name: 'Note 10' }).click()
    await expect(page.getByRole('heading', { name: /Merci pour votre confiance/ })).toBeVisible({ timeout: 15000 })
    const google = page.getByRole('link', { name: /Laisser un avis sur Google/ })
    await expect(google).toBeVisible()
    await expect(google).toHaveAttribute('href', /google|g\.page/)
  })

  test('lien à jeton unique : pré-remplissage, ouverture marquée, anti-double-soumission', async ({ page }) => {
    const token = await createInvitation()
    await page.goto(`${SURVEY}/${token}`)
    await expect(page.getByRole('heading', { name: /Votre avis nous intéresse/i })).toBeVisible()
    await page.getByRole('button', { name: 'Commencer' }).click()

    // L'identification est pré-remplie depuis l'invitation
    await expect(page.getByPlaceholder('Jean Dupont')).toHaveValue(/Client Test E2E/)
    await page.getByRole('button', { name: 'Suivant' }).click()

    await page.getByRole('button', { name: 'Note 9' }).click()
    await answerStars(page, 5)
    await page.getByRole('button', { name: 'Suivant' }).click()  // message positif
    await page.getByRole('button', { name: 'Passer' }).click()   // commentaire optionnel
    await page.getByRole('button', { name: 'Note 9' }).click()   // NPS → soumet

    await expect(page.getByRole('heading', { name: /Merci pour votre confiance/ })).toBeVisible({ timeout: 15000 })

    // Le même jeton ne peut plus être utilisé
    await page.goto(`${SURVEY}/${token}`)
    await expect(page.getByText(/déjà répondu/)).toBeVisible()
  })

  test('questionnaire inconnu ou inactif → écran d\'erreur élégant', async ({ page }) => {
    await page.goto('/avis/questionnaire-inexistant')
    await expect(page.getByText('Questionnaire indisponible')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// ESPACE ADMINISTRATEUR
// ---------------------------------------------------------------------------
test.describe('Espace cabinet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByPlaceholder('prenom.nom@agavic.fr').fill('admin@agavic-demo.fr')
    await page.getByPlaceholder('••••••••').fill('Admin2026!')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL('/admin', { timeout: 15000 })
  })

  test('route protégée : redirection vers login sans session', async ({ browser }) => {
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    await p.goto('/admin/avis')
    await expect(p).toHaveURL(/login/)
    await ctx.close()
  })

  test('tableau de bord : KPIs et graphiques alimentés par les données', async ({ page }) => {
    await expect(page.getByText('Note moyenne', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Réponses').first()).toBeVisible()
    await expect(page.getByText('Satisfaction (≥7)')).toBeVisible()
    await expect(page.getByText('Évolution de la note moyenne')).toBeVisible()
    await expect(page.getByText('Derniers avis à traiter')).toBeVisible()
    // Valeurs réelles issues du seed (130 + réponses e2e)
    const kpi = page.locator('p.font-serif.text-3xl').first()
    await expect(kpi).not.toHaveText('0/10')
  })

  test('avis clients : tableau, détail et filtres', async ({ page }) => {
    await page.goto('/admin/avis')
    await expect(page.getByText('Prestation')).toBeVisible({ timeout: 15000 })
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible()

    // Filtre insatisfaits (1er select = filtre de notes)
    await page.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '0-6 · Insatisfaits' }).click()
    await expect(rows.first()).toBeVisible()

    // Détail
    await rows.first().click()
    await expect(page.getByText('Réponses détaillées')).toBeVisible()
    await expect(page.getByText(/Réponse du/)).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('insatisfactions : suivi, affectation et historique', async ({ page }) => {
    await page.goto('/admin/insatisfactions')
    await expect(page.getByText(/À traiter/)).toBeVisible({ timeout: 15000 })

    // Ouvrir le premier suivi
    await page.locator('.cursor-pointer').first().click()
    await expect(page.getByText("Suivi d'insatisfaction")).toBeVisible()
    await expect(page.getByText('Note interne (privée)')).toBeVisible()
    await expect(page.getByText('Historique')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Marquer comme traitée' })).toBeVisible()
  })

  test('questionnaires : liste + éditeur avec conditions', async ({ page }) => {
    await page.goto('/admin/questionnaires')
    await expect(page.getByText('Satisfaction post-rendez-vous')).toBeVisible({ timeout: 15000 })

    // Ouvrir l'éditeur
    await page.getByRole('link', { name: 'Modifier' }).first().click()
    await expect(page.getByText(/Questions \(\d+\)/)).toBeVisible({ timeout: 15000 })

    // Sélectionner la question conditionnelle des motifs
    await page.getByText(/ce qui n'a pas fonctionné/).click()
    await expect(page.getByText("Conditions d'affichage")).toBeVisible()
    await expect(page.getByText('SI', { exact: true }).first()).toBeVisible()
  })

  test('campagnes, conseillers, rapports, paramètres, journal', async ({ page }) => {
    await page.goto('/admin/campagnes')
    await expect(page.getByText('Envois post-rendez-vous — T3 2026')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText("QR Code salle d'attente")).toBeVisible()

    await page.goto('/admin/conseillers')
    await expect(page.getByText('Marc Delaunay')).toBeVisible()
    await expect(page.getByText("Vue d'ensemble de la satisfaction par conseiller")).toBeVisible()

    await page.goto('/admin/rapports')
    await expect(page.getByText('Évolution de la satisfaction')).toBeVisible()
    await expect(page.getByText('Par conseiller')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rapport PDF' })).toBeVisible()

    await page.goto('/admin/parametres')
    await expect(page.getByText('Informations du cabinet')).toBeVisible()
    await expect(page.getByPlaceholder(/g\.page|google/)).toBeVisible()

    await page.goto('/admin/journal')
    await expect(page.getByText('Journal des actions administratives')).toBeVisible()
  })

  test('rôle lecteur : les actions d\'écriture sont masquées', async ({ page }) => {
    // Déconnexion
    await page.locator('header button').last().click()
    await page.getByText('Se déconnecter').last().click()
    await expect(page).toHaveURL(/login/, { timeout: 15000 })

    // Login conseiller (rôle advisor : périmètre restreint)
    await page.getByPlaceholder('prenom.nom@agavic.fr').fill('conseiller@agavic-demo.fr')
    await page.getByPlaceholder('••••••••').fill('Conseiller2026!')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL('/admin', { timeout: 15000 })
    // Le conseiller ne voit pas "Paramètres" (adminOnly)
    await expect(page.getByRole('link', { name: 'Paramètres' })).not.toBeVisible()
  })
})
