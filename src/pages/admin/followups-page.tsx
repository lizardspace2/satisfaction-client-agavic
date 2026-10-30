import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, Clock, History, User } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import type { Advisor, FeedbackFollowup, FollowupEvent, FollowupStatus } from '@/lib/types'
import { FOLLOWUP_STATUS_LABELS, formatDateTime, scoreBadgeClass, timeAgo } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const STATUS_META: Record<FollowupStatus, { icon: React.ReactNode; cls: string }> = {
  new: { icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  assigned: { icon: <User className="h-3.5 w-3.5" />, cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  in_progress: { icon: <Clock className="h-3.5 w-3.5" />, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  resolved: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
}

export default function FollowupsPage() {
  const { profile, canWrite, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [followups, setFollowups] = useState<FeedbackFollowup[]>([])
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [tab, setTab] = useState('open')
  const [selected, setSelected] = useState<FeedbackFollowup | null>(null)
  const [events, setEvents] = useState<FollowupEvent[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const canAct = canWrite || role === 'advisor'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [f, a] = await Promise.all([
      supabase.from('enquete_satisfaction_feedback_followups')
        .select('*, survey_responses:enquete_satisfaction_survey_responses(*, advisors:enquete_satisfaction_advisors(full_name), questionnaires:enquete_satisfaction_questionnaires(title)), advisors:enquete_satisfaction_advisors(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('enquete_satisfaction_advisors').select('*').eq('active', true).order('full_name'),
    ])
    setFollowups((f.data ?? []) as FeedbackFollowup[])
    setAdvisors((a.data ?? []) as Advisor[])
    setLoading(false)
  }

  const counts = useMemo(() => ({
    new: followups.filter((f) => f.status === 'new').length,
    open: followups.filter((f) => f.status !== 'resolved').length,
    resolved: followups.filter((f) => f.status === 'resolved').length,
  }), [followups])

  const filtered = useMemo(() => followups.filter((f) => {
    if (tab === 'open') return f.status !== 'resolved'
    return f.status === tab
  }), [followups, tab])

  async function openDetail(f: FeedbackFollowup) {
    setSelected(f)
    setNote(f.internal_note ?? '')
    const { data } = await supabase.from('enquete_satisfaction_followup_events')
      .select('*, profiles:enquete_satisfaction_profiles(full_name)').eq('followup_id', f.id).order('created_at')
    setEvents((data ?? []) as FollowupEvent[])
  }

  async function addEvent(followupId: string, action: string, eventNote?: string) {
    await supabase.from('enquete_satisfaction_followup_events').insert({
      followup_id: followupId, user_id: profile?.id, action, note: eventNote ?? null,
    })
  }

  async function updateFollowup(patch: Partial<FeedbackFollowup>, actionLabel: string, eventNote?: string) {
    if (!selected) return
    setSaving(true)
    if (patch.status === 'resolved' && !patch.resolved_at) patch.resolved_at = new Date().toISOString()
    if (patch.status && patch.status !== 'resolved') patch.resolved_at = null
    const { error } = await supabase.from('enquete_satisfaction_feedback_followups').update(patch).eq('id', selected.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    const updated = { ...selected, ...patch }
    setSelected(updated)
    setFollowups((prev) => prev.map((x) => (x.id === selected.id ? updated : x)))
    await addEvent(selected.id, actionLabel, eventNote)
    logAudit(profile?.id, `followup.${actionLabel}`, 'feedback_followup', selected.id)
    const { data } = await supabase.from('enquete_satisfaction_followup_events')
      .select('*, profiles:enquete_satisfaction_profiles(full_name)').eq('followup_id', selected.id).order('created_at')
    setEvents((data ?? []) as FollowupEvent[])
    setSaving(false)
    toast.success('Suivi mis à jour')
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">À traiter ({counts.open})</TabsTrigger>
            <TabsTrigger value="new">Nouvelles ({counts.new})</TabsTrigger>
            <TabsTrigger value="resolved">Traitées ({counts.resolved})</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          Les notes internes ne sont jamais visibles par les clients.
        </p>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card><CardContent className="py-14 text-center text-muted-foreground">
            {tab === 'resolved' ? 'Aucune insatisfaction traitée pour le moment.' : 'Aucune insatisfaction à traiter. 🎉'}
          </CardContent></Card>
        )}
        {filtered.map((f) => {
          const r = f.survey_responses
          const meta = STATUS_META[f.status]
          return (
            <Card key={f.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDetail(f)}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold', scoreBadgeClass(r?.overall_score))}>
                  {r?.overall_score ?? '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {r?.anonymous ? 'Client anonyme' : r?.client_name ?? 'Client'}
                    </p>
                    <Badge className={cn('gap-1 border-0', meta.cls)}>
                      {meta.icon} {FOLLOWUP_STATUS_LABELS[f.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {r?.comment ?? 'Sans commentaire'} — {r?.service_type ?? 'Prestation inconnue'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(r?.created_at)} · Conseiller : {f.advisors?.full_name ?? r?.advisors?.full_name ?? 'non assigné'}
                  </p>
                </div>
                <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Détail / traitement */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  Suivi d'insatisfaction
                  <Badge variant="outline" className={cn('font-bold', scoreBadgeClass(selected.survey_responses?.overall_score))}>
                    {selected.survey_responses?.overall_score}/10
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Créé {timeAgo(selected.created_at)} — {selected.survey_responses?.questionnaires?.title}
                </DialogDescription>
              </DialogHeader>

              {selected.survey_responses?.comment && (
                <div className="rounded-lg border border-red-200 bg-red-500/5 p-3 text-sm dark:border-red-900/50">
                  « {selected.survey_responses.comment} »
                </div>
              )}

              {canAct ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Statut</Label>
                    <Select value={selected.status}
                      onValueChange={(v) => updateFollowup({ status: v as FollowupStatus }, 'status_change', `Statut → ${FOLLOWUP_STATUS_LABELS[v]}`)}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FOLLOWUP_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Affecter au conseiller</Label>
                    <Select value={selected.assigned_to ?? 'none'}
                      onValueChange={(v) => updateFollowup({ assigned_to: v === 'none' ? null : v, status: selected.status === 'new' ? 'assigned' : selected.status }, 'assigned')}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Non assigné" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non assigné</SelectItem>
                        {advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Note interne (privée)</Label>
                    <Textarea className="mt-1.5" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Contexte, actions menées…" />
                    <Button variant="outline" size="sm" className="mt-2" disabled={saving}
                      onClick={() => updateFollowup({ internal_note: note }, 'note', 'Note interne mise à jour')}>
                      Enregistrer la note
                    </Button>
                  </div>
                  {selected.status !== 'resolved' && (
                    <Button variant="gold" className="sm:col-span-2" disabled={saving}
                      onClick={() => updateFollowup({ status: 'resolved' }, 'resolved', 'Insatisfaction traitée')}>
                      <CheckCircle2 /> Marquer comme traitée
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Consultation seule — votre rôle ne permet pas de modifier ce suivi.</p>
              )}

              <Separator />
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Historique
                </p>
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {events.map((e) => (
                    <div key={e.id} className="flex gap-3 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      <div>
                        <p>{e.note ?? e.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(e.created_at)} · {e.profiles?.full_name ?? 'Système'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
