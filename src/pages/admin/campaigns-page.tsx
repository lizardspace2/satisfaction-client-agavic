import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Link2, QrCode, Mail, MessageSquareText, Copy, Check, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import type { Advisor, Campaign, Questionnaire, SurveyInvitation } from '@/lib/types'
import { INVITATION_STATUS_LABELS, formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const CHANNELS = [
  { v: 'link', l: 'Lien partagé', icon: Link2 },
  { v: 'email', l: 'E-mail', icon: Mail },
  { v: 'sms', l: 'SMS', icon: MessageSquareText },
  { v: 'qrcode', l: 'QR Code', icon: QrCode },
]

export default function CampaignsPage() {
  const { profile, canWrite } = useAuth()
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([])
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [advisors, setAdvisors] = useState<Advisor[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [genOpen, setGenOpen] = useState<Campaign | null>(null)
  const [qrOpen, setQrOpen] = useState<Campaign | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [linksOpen, setLinksOpen] = useState<Campaign | null>(null)

  const [form, setForm] = useState({
    name: '', questionnaire_id: '', channel: 'link',
    goal_responses: '', start_date: '', end_date: '',
  })
  const [genForm, setGenForm] = useState({ advisor_id: 'none', service_type: '', emails: '' })
  const [genBusy, setGenBusy] = useState(false)
  const [generated, setGenerated] = useState<{ email: string; url: string }[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [c, i, q, a] = await Promise.all([
      supabase.from('enquete_satisfaction_campaigns').select('*, questionnaires:enquete_satisfaction_questionnaires(title, slug)').order('created_at', { ascending: false }),
      supabase.from('enquete_satisfaction_survey_invitations').select('*, advisors:enquete_satisfaction_advisors(full_name)').order('created_at', { ascending: false }),
      supabase.from('enquete_satisfaction_questionnaires').select('*').order('title'),
      supabase.from('enquete_satisfaction_advisors').select('*').eq('active', true).order('full_name'),
    ])
    setCampaigns((c.data ?? []) as Campaign[])
    setInvitations((i.data ?? []) as SurveyInvitation[])
    setQuestionnaires((q.data ?? []) as Questionnaire[])
    setAdvisors((a.data ?? []) as Advisor[])
    setLoading(false)
  }

  const statsByCampaign = useMemo(() => {
    const m = new Map<string, { total: number; opened: number; completed: number }>()
    for (const inv of invitations) {
      if (!inv.campaign_id) continue
      const e = m.get(inv.campaign_id) ?? { total: 0, opened: 0, completed: 0 }
      e.total += 1
      if (['opened', 'completed'].includes(inv.status)) e.opened += 1
      if (inv.status === 'completed') e.completed += 1
      m.set(inv.campaign_id, e)
    }
    return m
  }, [invitations])

  function surveyUrl(c: Campaign) {
    const slug = c.questionnaires?.slug ?? questionnaires.find((q) => q.id === c.questionnaire_id)?.slug
    return `${location.origin}/avis/${slug}`
  }

  async function create() {
    if (!form.name.trim() || !form.questionnaire_id) { toast.error('Nom et questionnaire requis'); return }
    const { data, error } = await supabase.from('enquete_satisfaction_campaigns').insert({
      name: form.name.trim(), questionnaire_id: form.questionnaire_id,
      channel: form.channel, status: 'active',
      goal_responses: form.goal_responses ? Number(form.goal_responses) : null,
      start_date: form.start_date || null, end_date: form.end_date || null,
    }).select().single()
    if (error) { toast.error(error.message); return }
    logAudit(profile?.id, 'campaign.create', 'campaign', data.id, { name: data.name })
    toast.success('Campagne créée')
    setCreateOpen(false)
    setForm({ name: '', questionnaire_id: '', channel: 'link', goal_responses: '', start_date: '', end_date: '' })
    load()
  }

  async function setStatus(c: Campaign, status: Campaign['status']) {
    await supabase.from('enquete_satisfaction_campaigns').update({ status }).eq('id', c.id)
    logAudit(profile?.id, `campaign.${status}`, 'campaign', c.id)
    load()
  }

  async function generateLinks() {
    if (!genOpen) return
    const emails = genForm.emails.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    if (!emails.length) { toast.error('Ajoutez au moins une adresse e-mail'); return }
    setGenBusy(true)
    const slug = genOpen.questionnaires?.slug ?? questionnaires.find((q) => q.id === genOpen.questionnaire_id)?.slug
    const rows = emails.map((email) => ({
      campaign_id: genOpen.id,
      questionnaire_id: genOpen.questionnaire_id,
      advisor_id: genForm.advisor_id === 'none' ? null : genForm.advisor_id,
      service_type: genForm.service_type || null,
      recipient_email: email,
      status: 'sent' as const,
      sent_at: new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('enquete_satisfaction_survey_invitations').insert(rows).select()
    setGenBusy(false)
    if (error) { toast.error(error.message); return }
    setGenerated((data ?? []).map((inv) => ({
      email: inv.recipient_email ?? '',
      url: `${location.origin}/avis/${slug}/${inv.secure_token}`,
    })))
    logAudit(profile?.id, 'invitations.generate', 'campaign', genOpen.id, { count: rows.length })
    toast.success(`${rows.length} lien${rows.length > 1 ? 's' : ''} sécurisé${rows.length > 1 ? 's' : ''} généré${rows.length > 1 ? 's' : ''}`)
    load()
  }

  async function showQr(c: Campaign) {
    setQrOpen(c)
    setQrUrl(await QRCode.toDataURL(surveyUrl(c), { width: 480, margin: 2, color: { dark: '#0e1f3d' } }))
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{campaigns.length} campagne{campaigns.length > 1 ? 's' : ''}</p>
        {canWrite && <Button variant="gold" onClick={() => setCreateOpen(true)}><Plus /> Nouvelle campagne</Button>}
      </div>

      <div className="grid gap-4">
        {campaigns.map((c) => {
          const st = statsByCampaign.get(c.id) ?? { total: 0, opened: 0, completed: 0 }
          const ChannelIcon = CHANNELS.find((x) => x.v === c.channel)?.icon ?? Link2
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center gap-5 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15">
                  <ChannelIcon className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg font-semibold">{c.name}</h3>
                    <Badge variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'muted' : 'warning'}>
                      {{ draft: 'Brouillon', active: 'Active', completed: 'Terminée', paused: 'En pause' }[c.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.questionnaires?.title} · {formatDate(c.start_date)}{c.end_date ? ` → ${formatDate(c.end_date)}` : ''}
                    {c.goal_responses ? ` · Objectif : ${c.goal_responses} réponses` : ''}
                  </p>
                </div>
                <div className="flex gap-6 text-center">
                  <Stat label="Envoyés" value={st.total} />
                  <Stat label="Ouverts" value={st.opened} />
                  <Stat label="Réponses" value={st.completed} accent />
                </div>
                <div className="flex items-center gap-1">
                  {canWrite && (
                    <Select value={c.status} onValueChange={(v) => setStatus(c, v as Campaign['status'])}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">En pause</SelectItem>
                        <SelectItem value="completed">Terminée</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="ghost" size="icon" title="Liens générés" onClick={() => setLinksOpen(c)}><Link2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="QR Code" onClick={() => showQr(c)}><QrCode className="h-4 w-4" /></Button>
                  {canWrite && (
                    <Button variant="outline" size="sm" onClick={() => { setGenOpen(c); setGenerated([]) }}>
                      <Plus /> Générer des liens
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {campaigns.length === 0 && (
          <Card><CardContent className="py-14 text-center text-muted-foreground">Aucune campagne pour le moment.</CardContent></Card>
        )}
      </div>

      {/* Création de campagne */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle campagne</DialogTitle>
            <DialogDescription>Diffusez un questionnaire par lien, e-mail, SMS ou QR code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom de la campagne *</Label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Envois post-rendez-vous — novembre" />
            </div>
            <div>
              <Label>Questionnaire *</Label>
              <Select value={form.questionnaire_id} onValueChange={(v) => setForm({ ...form, questionnaire_id: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sélectionnez…" /></SelectTrigger>
                <SelectContent>
                  {questionnaires.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal principal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Objectif de réponses</Label>
                <Input className="mt-1.5" type="number" min={0} value={form.goal_responses}
                  onChange={(e) => setForm({ ...form, goal_responses: e.target.value })} placeholder="—" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Début</Label>
                <Input className="mt-1.5" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Fin</Label>
                <Input className="mt-1.5" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Les envois e-mail/SMS s'appuient sur un prestataire configurable (Resend, Brevo…) à brancher
              dans les paramètres. En attendant, les liens uniques générés peuvent être copiés et envoyés
              depuis votre messagerie habituelle.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button variant="gold" onClick={create}>Créer la campagne</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Génération de liens uniques */}
      <Dialog open={!!genOpen} onOpenChange={(o) => !o && setGenOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Générer des liens sécurisés</DialogTitle>
            <DialogDescription>
              Chaque client reçoit un lien unique à usage unique, avec conseiller et prestation pré-remplis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conseiller concerné</Label>
                <Select value={genForm.advisor_id} onValueChange={(v) => setGenForm({ ...genForm, advisor_id: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prestation</Label>
                <Input className="mt-1.5" value={genForm.service_type}
                  onChange={(e) => setGenForm({ ...genForm, service_type: e.target.value })}
                  placeholder="Ex : Rendez-vous annuel" />
              </div>
            </div>
            <div>
              <Label>Destinataires (un e-mail par ligne)</Label>
              <Textarea className="mt-1.5 font-mono text-xs" rows={5} value={genForm.emails}
                onChange={(e) => setGenForm({ ...genForm, emails: e.target.value })}
                placeholder={'client1@exemple.fr\nclient2@exemple.fr'} />
            </div>
            <Button variant="gold" className="w-full" onClick={generateLinks} disabled={genBusy}>
              {genBusy ? <Loader2 className="animate-spin" /> : <Link2 />} Générer les liens
            </Button>
            {generated.length > 0 && (
              <>
                <Separator />
                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {generated.map((g) => <CopyRow key={g.url} label={g.email} url={g.url} />)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Copiez chaque lien et envoyez-le au client depuis votre messagerie.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR de campagne */}
      <Dialog open={!!qrOpen} onOpenChange={(o) => !o && setQrOpen(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR Code — {qrOpen?.name}</DialogTitle>
            <DialogDescription>Pointe vers le questionnaire « {qrOpen?.questionnaires?.title} ».</DialogDescription>
          </DialogHeader>
          {qrUrl && <img src={qrUrl} alt="QR Code" className="mx-auto rounded-xl border p-2" />}
          <Button variant="gold" onClick={() => {
            const a = document.createElement('a')
            a.href = qrUrl; a.download = `qr-campagne-${qrOpen?.id}.png`; a.click()
          }}>Télécharger le QR Code</Button>
        </DialogContent>
      </Dialog>

      {/* Liste des invitations */}
      <Dialog open={!!linksOpen} onOpenChange={(o) => !o && setLinksOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Liens de la campagne</DialogTitle>
            <DialogDescription>{linksOpen?.name}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinataire</TableHead><TableHead>Conseiller</TableHead>
                  <TableHead>Statut</TableHead><TableHead>Lien</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.filter((i) => i.campaign_id === linksOpen?.id).map((inv) => {
                  const slug = linksOpen?.questionnaires?.slug
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm">{inv.recipient_email ?? '—'}</TableCell>
                      <TableCell className="text-sm">{inv.advisors?.full_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'completed' ? 'success' : inv.status === 'opened' ? 'warning' : 'muted'}>
                          {INVITATION_STATUS_LABELS[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button className="text-xs text-secondary hover:underline"
                          onClick={() => { navigator.clipboard.writeText(`${location.origin}/avis/${slug}/${inv.secure_token}`); toast.success('Lien copié') }}>
                          Copier le lien
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className={cn('font-serif text-2xl font-bold', accent && 'text-gold-600')}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="w-44 shrink-0 truncate text-xs font-medium">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
      <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
      </button>
    </div>
  )
}
