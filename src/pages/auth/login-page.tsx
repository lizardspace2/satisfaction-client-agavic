import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { AgavicLogo } from '@/components/agavic-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect } from 'react'

export default function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string })?.from ?? '/admin'

  useEffect(() => {
    if (!loading && session) navigate(from, { replace: true })
  }, [session, loading])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
    else navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-screen">
      {/* Panneau gauche — identité */}
      <div className="hidden lg:flex w-[45%] navy-gradient flex-col justify-between p-12 text-white">
        <AgavicLogo light />
        <div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-balance">
            L'excellence de l'accompagnement patrimonial se mesure.
          </h1>
          <p className="mt-4 max-w-md text-navy-200">
            Plateforme interne de mesure de la satisfaction client —
            pilotez la qualité de vos conseils en temps réel.
          </p>
        </div>
        <p className="text-xs text-navy-300">© AGAVIC Patrimoine — 45 rue de la Bourse, 69002 Lyon</p>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center bg-cream p-6 dark:bg-navy-950">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <AgavicLogo className="mb-3 lg:hidden" compact />
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/15">
              <Lock className="h-5 w-5 text-secondary" />
            </div>
            <CardTitle className="text-2xl">Espace cabinet</CardTitle>
            <CardDescription>Connectez-vous pour accéder au tableau de bord</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Adresse e-mail professionnelle</Label>
                <Input id="email" type="email" required autoComplete="email" className="mt-1.5 h-11"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@agavic.fr" />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" required autoComplete="current-password"
                  className="mt-1.5 h-11" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="gold" className="w-full h-11" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : 'Se connecter'}
              </Button>
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Accès réservé à l'équipe AGAVIC. Démo : admin@agavic-demo.fr
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
