import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList, Copy, ExternalLink, FilePlus2, MoreVertical, Pencil,
  Power, QrCode, Trash2, CopyPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import type { Questionnaire } from '@/lib/types'
import { QUESTIONNAIRE_STATUS_LABELS } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export default function QuestionnairesPage() {
  const { profile, canWrite } = useAuth()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<(Questionnaire & { _qCount: number; _rCount: number })[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Questionnaire | null>(null)
  const [qrItem, setQrItem] = useState<Questionnaire | null>(null)
  const [qrUrl, setQrUrl] = useState('')

  const [form, setForm] = useState({ title: '', description: '', slug: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('enquete_satisfaction_questionnaires').select('*').order('created_at', { ascending: false })
    const qs = (data ?? []) as Questionnaire[]
    const [qCount, rCount] = await Promise.all([
      supabase.from('enquete_satisfaction_questions').select('questionnaire_id'),
      supabase.from('enquete_satisfaction_survey_responses').select('questionnaire_id'),
    ])
    const qc = new Map<string, number>()
    const rc = new Map<string, number>()
    for (const x of qCount.data ?? []) qc.set(x.questionnaire_id, (qc.get(x.questionnaire_id) ?? 0) + 1)
    for (const x of rCount.data ?? []) rc.set(x.questionnaire_id, (rc.get(x.questionnaire_id) ?? 0) + 1)
    setItems(qs.map((q) => ({ ...q, _qCount: qc.get(q.id) ?? 0, _rCount: rc.get(q.id) ?? 0 })))
    setLoading(false)
  }

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
  }

  async function create() {
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    const slug = form.slug.trim() || slugify(form.title)
    const { data, error } = await supabase.from('enquete_satisfaction_questionnaires').insert({
      title: form.title.trim(), description: form.description || null, slug, status: 'draft',
    }).select().single()
    if (error) { toast.error(error.message.includes('duplicate') ? 'Cet identifiant (slug) existe déjà.' : error.message); return }
    logAudit(profile?.id, 'questionnaire.create', 'questionnaire', data.id, { title: data.title })
    toast.success('Questionnaire créé — ajoutez maintenant vos questions')
    setCreateOpen(false)
    setForm({ title: '', description: '', slug: '' })
    load()
  }

  async function duplicate(q: Questionnaire) {
    const { data: copy, error } = await supabase.from('enquete_satisfaction_questionnaires').insert({
      title: `${q.title} (copie)`, description: q.description,
      slug: `${q.slug}-${Date.now().toString(36)}`, status: 'draft', settings: q.settings,
    }).select().single()
    if (error) { toast.error(error.message); return }
    const { data: qs } = await supabase.from('enquete_satisfaction_questions').select('*').eq('questionnaire_id', q.id).order('position')
    if (qs?.length) {
      await supabase.from('enquete_satisfaction_questions').insert(qs.map(({ id: _id, created_at: _c, ...rest }) => ({
        ...rest, questionnaire_id: copy.id,
      })))
    }
    logAudit(profile?.id, 'questionnaire.duplicate', 'questionnaire', copy.id, { source: q.title })
    toast.success('Questionnaire dupliqué')
    load()
  }

  async function setStatus(q: Questionnaire, status: Questionnaire['status']) {
    const { error } = await supabase.from('enquete_satisfaction_questionnaires').update({ status }).eq('id', q.id)
    if (error) { toast.error(error.message); return }
    logAudit(profile?.id, `questionnaire.${status}`, 'questionnaire', q.id)
    toast.success(`Questionnaire ${QUESTIONNAIRE_STATUS_LABELS[status].toLowerCase()}`)
    load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    const { error } = await supabase.from('enquete_satisfaction_questionnaires').delete().eq('id', toDelete.id)
    if (error) { toast.error('Suppression impossible : ' + error.message); return }
    logAudit(profile?.id, 'questionnaire.delete', 'questionnaire', toDelete.id, { title: toDelete.title })
    toast.success('Questionnaire supprimé')
    setToDelete(null)
    load()
  }

  function copyLink(q: Questionnaire) {
    navigator.clipboard.writeText(`${location.origin}/avis/${q.slug}`)
    toast.success('Lien copié dans le presse-papiers')
  }

  async function showQr(q: Questionnaire) {
    setQrItem(q)
    setQrUrl(await QRCode.toDataURL(`${location.origin}/avis/${q.slug}`, { width: 480, margin: 2, color: { dark: '#0e1f3d', light: '#ffffff' } }))
  }

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} questionnaire{items.length > 1 ? 's' : ''}</p>
        {canWrite && (
          <Button variant="gold" onClick={() => setCreateOpen(true)}>
            <FilePlus2 /> Nouveau questionnaire
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((q) => (
          <Card key={q.id} className="flex flex-col transition-shadow hover:shadow-md">
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15">
                  <ClipboardList className="h-5 w-5 text-secondary" />
                </div>
                <Badge variant={
                  q.status === 'active' ? 'success' : q.status === 'draft' ? 'warning' : 'muted'
                }>
                  {QUESTIONNAIRE_STATUS_LABELS[q.status]}
                </Badge>
              </div>
              <h3 className="mt-3 font-serif text-lg font-semibold">{q.title}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{q.description ?? 'Sans description'}</p>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{q._qCount} question{q._qCount > 1 ? 's' : ''}</span>
                <span>{q._rCount} réponse{q._rCount > 1 ? 's' : ''}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to={`/admin/questionnaires/${q.id}`}><Pencil /> Modifier</Link>
                </Button>
                <Button variant="ghost" size="icon" title="Copier le lien public" onClick={() => copyLink(q)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="QR Code" onClick={() => showQr(q)}>
                  <QrCode className="h-4 w-4" />
                </Button>
                {canWrite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <a href={`/avis/${q.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Ouvrir la page publique</a>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicate(q)}><CopyPlus /> Dupliquer</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {q.status !== 'active' && (
                        <DropdownMenuItem onClick={() => setStatus(q, 'active')}><Power /> Activer</DropdownMenuItem>
                      )}
                      {q.status === 'active' && (
                        <DropdownMenuItem onClick={() => setStatus(q, 'archived')}><Power /> Archiver</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(q)}>
                        <Trash2 /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau questionnaire</DialogTitle>
            <DialogDescription>Vous pourrez ensuite ajouter et organiser les questions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input className="mt-1.5" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugify(e.target.value) })}
                placeholder="Ex : Satisfaction post-rendez-vous" />
            </div>
            <div>
              <Label>Identifiant d'URL (slug)</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/avis/</span>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Description interne</Label>
              <Textarea className="mt-1.5" rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button variant="gold" onClick={create}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppression */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les questions, invitations, réponses et suivis associés seront définitivement supprimés.
              Pensez à archiver plutôt si vous souhaitez conserver les données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Code */}
      <Dialog open={!!qrItem} onOpenChange={(o) => !o && setQrItem(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR Code — {qrItem?.title}</DialogTitle>
            <DialogDescription>À afficher en agence ou à imprimer sur vos documents.</DialogDescription>
          </DialogHeader>
          {qrUrl && <img src={qrUrl} alt="QR Code" className="mx-auto rounded-xl border p-2" />}
          <p className="break-all font-mono text-xs text-muted-foreground">
            {qrItem && `${location.origin}/avis/${qrItem.slug}`}
          </p>
          <Button variant="gold" onClick={() => {
            const a = document.createElement('a')
            a.href = qrUrl; a.download = `qr-${qrItem?.slug}.png`; a.click()
          }}>
            Télécharger le QR Code
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
