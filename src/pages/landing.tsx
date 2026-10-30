import { Link } from 'react-router-dom'
import { ArrowRight, QrCode, ShieldCheck, BarChart3 } from 'lucide-react'
import { AgavicLogo } from '@/components/agavic-logo'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen navy-gradient text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between p-6">
        <AgavicLogo light />
        <Button asChild variant="outline" className="border-gold-400/40 bg-transparent text-gold-200 hover:bg-gold-500/10 hover:text-gold-100">
          <Link to="/admin">Espace cabinet <ArrowRight /></Link>
        </Button>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400">Plateforme satisfaction client</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-balance sm:text-5xl">
          Chaque avis compte pour<br />construire la confiance.
        </h1>
        <p className="mt-5 max-w-xl text-navy-200">
          Les clients AGAVIC sont invités à partager leur expérience via un lien
          personnalisé ou un QR code remis lors du rendez-vous. Aucune inscription requise.
        </p>
        <div className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {[
            { icon: QrCode, t: 'Réponse en 1 minute', d: 'Lien unique ou QR code, questionnaire fluide sur mobile.' },
            { icon: ShieldCheck, t: 'Confidentialité RGPD', d: 'Réponses anonymes possibles, données protégées.' },
            { icon: BarChart3, t: 'Pilotage qualité', d: 'Suivi par conseiller, prestation et période.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur">
              <Icon className="h-6 w-6 text-gold-400" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-navy-200">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="pb-8 text-center text-xs text-navy-300">
        AGAVIC Patrimoine — Gestion de patrimoine, épargne retraite, épargne salariale, prévoyance · Lyon
      </footer>
    </div>
  )
}
