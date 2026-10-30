import { AgavicLogo } from '@/components/agavic-logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, FileCode, KeyRound } from 'lucide-react'

/** Écran affiché tant que les variables Supabase ne sont pas configurées. */
export function SetupScreen() {
  return (
    <div className="min-h-screen navy-gradient flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center">
          <AgavicLogo className="mb-4 justify-center" />
          <CardTitle className="text-2xl">Configuration requise</CardTitle>
          <CardDescription>
            L'application a besoin d'une base Supabase pour fonctionner. Trois étapes suffisent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Step n={1} icon={<Database className="h-5 w-5 text-gold-600" />} title="Créer le projet Supabase">
            Sur <span className="font-mono text-xs">supabase.com</span>, créez un projet gratuit puis ouvrez
            le <strong>SQL Editor</strong>.
          </Step>
          <Step n={2} icon={<FileCode className="h-5 w-5 text-gold-600" />} title="Exécuter les scripts SQL">
            Exécutez <span className="font-mono text-xs">supabase/schema.sql</span> puis{' '}
            <span className="font-mono text-xs">supabase/seed.sql</span> (données de démonstration incluses).
          </Step>
          <Step n={3} icon={<KeyRound className="h-5 w-5 text-gold-600" />} title="Renseigner les clés">
            Copiez <span className="font-mono text-xs">.env.example</span> en{' '}
            <span className="font-mono text-xs">.env.local</span> et renseignez{' '}
            <span className="font-mono text-xs">VITE_SUPABASE_URL</span> et{' '}
            <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span>{' '}
            (Dashboard → Settings → API), puis redémarrez <span className="font-mono text-xs">npm run dev</span>.
          </Step>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Guide détaillé : <span className="font-mono">README.md</span> et <span className="font-mono">supabase/README.md</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 rounded-lg border bg-muted/40 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 font-serif text-lg font-bold text-gold-700">
        {n}
      </div>
      <div>
        <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
