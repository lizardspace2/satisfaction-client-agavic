import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Pencil, Plus, Power, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import type { Advisor, SurveyResponse } from '@/lib/types'
import { formatScore, scoreBand } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function AdvisorsPage() {
  const { profile, canWrite } = useAuth()
  const [loading, setLoading] = useState(true)
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Advisor | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', position: '', active: true })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [a, r] = await Promise.all([
      supabase.from('enquete_satisfaction_advisors').select('*').order('full_name'),
      supabase.from('enquete_satisfaction_survey_responses').select('advisor_id, overall_score, created_at'),
    ])
    setAdvisors((a.data ?? []) as Advisor[])
    setResponses((r.data ?? []) as SurveyResponse[])
    setLoading(false)
  }

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; sum: number }>()
    for (const r of responses) {
      if (!r.advisor_id || r.overall_score === null) continue
      const e = m.get(r.advisor_id) ?? { count: 0, sum: 0 }
      e.count += 1; e.sum += r.overall_score
      m.set(r.advisor_id, e)
    }
    return m
  }, [responses])

  const chartData = useMemo(() => advisors
    .filter((a) => stats.has(a.id))
    .map((a) => {
      const s = stats.get(a.id)!
      return { name: a.full_name.split(' ')[0], moyenne: Math.round((s.sum / s.count) * 10) / 10 }
    }), [advisors, stats])

  function openEdit(a?: Advisor) {
    setEditing(a ?? null)
    setForm(a ? { full_name: a.full_name, email: a.email, position: a.position ?? '', active: a.active }
              : { full_name: '', email: '', position: '', active: true })
    setEditOpen(true)
  }

  async function save() {
    if (!form.full_name.trim() || !form.email.trim()) { toast.error('Nom et e-mail requis'); return }
    if (editing) {
      const { error } = await supabase.from('enquete_satisfaction_advisors').update({
        full_name: form.full_name, email: form.email,
        position: form.position || null, active: form.active,
      }).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      logAudit(profile?.id, 'advisor.update', 'advisor', editing.id)
      toast.success('Conseiller mis à jour')
    } else {
      const { data, error } = await supabase.from('enquete_satisfaction_advisors').insert({
        full_name: form.full_name, email: form.email,
        position: form.position || null, active: form.active,
      }).select().single()
      if (error) { toast.error(error.message); return }
      logAudit(profile?.id, 'advisor.create', 'advisor', data.id)
      toast.success('Conseiller ajouté')
    }
    setEditOpen(false)
    load()
  }

  async function toggleActive(a: Advisor) {
    await supabase.from('enquete_satisfaction_advisors').update({ active: !a.active }).eq('id', a.id)
    logAudit(profile?.id, a.active ? 'advisor.deactivate' : 'advisor.activate', 'advisor', a.id)
    load()
  }

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{advisors.length} conseiller{advisors.length > 1 ? 's' : ''}</p>
        {canWrite && <Button variant="gold" onClick={() => openEdit()}><Plus /> Ajouter un conseiller</Button>}
      </div>

      {/* Comparaison douce — pas de classement pénalisant */}
      <Card>
        <CardHeader>
          <CardTitle>Vue d'ensemble de la satisfaction par conseiller</CardTitle>
          <CardDescription>
            Indicateur de pilotage destiné à identifier les besoins d'accompagnement — pas un classement.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}/10`, 'Note moyenne']} />
              <Bar dataKey="moyenne" radius={[6, 6, 0, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.name}
                    fill={d.moyenne <= 6 ? '#ef4444' : d.moyenne <= 8 ? '#f59e0b' : '#0e1f3d'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {advisors.map((a) => {
          const s = stats.get(a.id)
          const initials = a.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
          return (
            <Card key={a.id} className={cn(!a.active && 'opacity-60')}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback className="text-sm">{initials}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-semibold">{a.full_name}</p>
                      <p className="text-xs text-muted-foreground">{a.position ?? 'Conseiller'}</p>
                    </div>
                  </div>
                  <Badge variant={a.active ? 'success' : 'muted'}>{a.active ? 'Actif' : 'Inactif'}</Badge>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{a.email}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-center">
                  <div>
                    <p className="font-serif text-xl font-bold">{s?.count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">réponses</p>
                  </div>
                  <div>
                    <p className={cn('font-serif text-xl font-bold',
                      s && scoreBand(Math.round(s.sum / s.count)) === 'low' && 'text-red-600',
                      s && scoreBand(Math.round(s.sum / s.count)) === 'mid' && 'text-amber-600',
                      s && scoreBand(Math.round(s.sum / s.count)) === 'high' && 'text-emerald-600')}>
                      {s ? `${formatScore(s.sum / s.count)}/10` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">note moyenne</p>
                  </div>
                </div>
                {canWrite && (
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(a)}>
                      <Pencil /> Modifier
                    </Button>
                    <Button variant="ghost" size="icon" title={a.active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(a)}>
                      <Power className={cn('h-4 w-4', a.active ? 'text-emerald-600' : 'text-muted-foreground')} />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
        {advisors.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <UserRound className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">Aucun conseiller — ajoutez votre équipe pour attribuer les avis.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le conseiller' : 'Nouveau conseiller'}</DialogTitle>
            <DialogDescription>
              Le compte utilisateur (connexion) s'associe ensuite via son profil dans la table advisors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom et prénom *</Label>
              <Input className="mt-1.5" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>E-mail professionnel *</Label>
              <Input className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Fonction</Label>
              <Input className="mt-1.5" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="Ex : Conseiller en gestion de patrimoine" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
              <Label>Compte actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button variant="gold" onClick={save}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
