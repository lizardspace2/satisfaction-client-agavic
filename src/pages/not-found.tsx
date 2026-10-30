import { Link } from 'react-router-dom'
import { AgavicLogo } from '@/components/agavic-logo'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream p-6 text-center dark:bg-navy-950">
      <AgavicLogo className="mb-8" />
      <p className="font-serif text-6xl font-bold text-gold-500">404</p>
      <p className="mt-3 text-lg font-medium">Cette page n'existe pas</p>
      <p className="mt-1 text-sm text-muted-foreground">Le lien est peut-être expiré ou incorrect.</p>
      <Button asChild variant="gold" className="mt-6"><Link to="/">Retour à l'accueil</Link></Button>
    </div>
  )
}
