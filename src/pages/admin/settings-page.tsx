import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import type { CabinetSettings } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Navigate } from 'react-router-dom'

export default function SettingsPage() {
  const { profile, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [s, setS] = useState<CabinetSettings>({})

  useEffect(() => {
    supabase.from('enquete_satisfaction_settings').select('value').eq('key', 'cabinet').maybeSingle()
      .then(({ data }) => { setS((data?.value ?? {}) as CabinetSettings); setLoading(false) })
  }, [])

  if (!isAdmin && !loading) return <Navigate to="/admin" replace />

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('enquete_satisfaction_settings').update({ value: s }).eq('key', 'cabinet')
    setSaving(false)
    if (error) { toast.error(error.message); return }
    logAudit(profile?.id, 'settings.update', 'settings')
    toast.success('Paramètres enregistrés')
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>

  const set = (patch: Partial<CabinetSettings>) => setS((p) => ({ ...p, ...patch }))

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Informations du cabinet</CardTitle>
          <CardDescription>Repris sur l'écran public et le rapport PDF.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nom du cabinet</Label>
            <Input className="mt-1.5" value={s.company_name ?? ''} onChange={(e) => set({ company_name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Adresse</Label>
            <Input className="mt-1.5" value={s.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input className="mt-1.5" value={s.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
          </div>
          <div>
            <Label>E-mail de contact</Label>
            <Input className="mt-1.5" type="email" value={s.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Lien Google Business Profile (avis)</Label>
            <Input className="mt-1.5" value={s.google_review_url ?? ''} onChange={(e) => set({ google_review_url: e.target.value })}
              placeholder="https://g.page/r/…/review" />
            <p className="mt-1 text-xs text-muted-foreground">
              Proposé à tous les répondants sur l'écran de remerciement — sans filtrage par note.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seuils et notifications</CardTitle>
          <CardDescription>Automatisations déclenchées à chaque nouvelle réponse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Seuil d'alerte (note ≤)</Label>
              <Input className="mt-1.5" type="number" min={0} max={10} value={s.satisfaction_threshold ?? 6}
                onChange={(e) => set({ satisfaction_threshold: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-muted-foreground">En dessous ou égal à cette note, un suivi et des alertes sont créés.</p>
            </div>
            <div>
              <Label>Relance responsable après (heures)</Label>
              <Input className="mt-1.5" type="number" min={1} value={s.notify_manager_delay_hours ?? 48}
                onChange={(e) => set({ notify_manager_delay_hours: Number(e.target.value) })} />
            </div>
          </div>
          <Separator />
          {([
            ['notify_low_score', 'Alerte immédiate sur note faible'],
            ['weekly_digest', 'Récapitulatif hebdomadaire'],
            ['monthly_report', 'Rapport mensuel automatique'],
            ['anonymous_allowed', 'Réponses anonymes autorisées'],
          ] as [keyof CabinetSettings, string][]).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between">
              <Label className="font-normal">{label}</Label>
              <Switch checked={s[k] !== false} onCheckedChange={(c) => set({ [k]: c } as Partial<CabinetSettings>)} />
            </div>
          ))}
          <div>
            <Label>Durée de conservation des réponses (mois) — RGPD</Label>
            <Input className="mt-1.5 w-40" type="number" min={1} value={s.retention_months ?? 36}
              onChange={(e) => set({ retention_months: Number(e.target.value) })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mentions légales et confidentialité</CardTitle>
          <CardDescription>Affichés aux répondants (pied de page du questionnaire).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Mentions légales</Label>
            <Textarea className="mt-1.5" rows={3} value={s.legal_notice ?? ''} onChange={(e) => set({ legal_notice: e.target.value })} />
          </div>
          <div>
            <Label>Politique de confidentialité</Label>
            <Textarea className="mt-1.5" rows={4} value={s.privacy_policy ?? ''} onChange={(e) => set({ privacy_policy: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button variant="gold" size="lg" onClick={save} disabled={saving} className="shadow-lg">
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer les paramètres
        </Button>
      </div>
    </div>
  )
}
