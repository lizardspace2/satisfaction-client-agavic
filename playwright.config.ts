import { defineConfig } from '@playwright/test'

// Charge .env.local pour les clés Supabase locales (optionnel)
try {
  process.loadEnvFile('.env.local')
} catch {
  // fichier absent : les variables peuvent venir de l'environnement
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
})
