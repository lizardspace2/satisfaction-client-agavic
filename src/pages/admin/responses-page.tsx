import { useEffect, useMemo, useState } from 'react'
import {
  Search, FileSpreadsheet, Archive, Trash2, Eye, ArrowUpDown, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import { exportResponsesToExcel } from '@/lib/export'
import type { Advisor, Question, SurveyResponse } from '@/lib/types'
import { formatDateTime, formatScore, scoreBadgeClass } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

export default function ResponsesPage() {
  const { profile, isAdmin, canWrite } = useAuth()
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [questions, setQuestions] = useState<Question[]>([])

  const [search, setSearch] = useState('')
  const [bandFilter, setBandFilter] = useState('all')
  const [advisorFilter, setAdvisorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(0)

  const [detail, setDetail] = useState<SurveyResponse | null>(null)
  const [toDelete, setToDelete] = useState<SurveyResponse | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [r, a, q] = await Promise.all([
      supabase.from('enquete_satisfaction_survey_responses')
        .select('*, advisors:enquete_satisfaction_advisors(full_name), questionnaires:enquete_satisfaction_questionnaires(title)')
        .order('created_at', { ascending: false }),
      supabase.from('enquete_satisfaction_advisors').select('*').order('full_name'),
      supabase.from('enquete_satisfaction_questions').select('*'),
    ])
    setResponses((r.data ?? []) as SurveyResponse[])
    setAdvisors((a.data ?? []) as Advisor[])
    setQuestions((q.data ?? []) as Question[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return responses
      .filter((r) => statusFilter === 'all' || (statusFilter === 'archived' ? r.status === 'archived' : r.status !== 'archived'))
      .filter((r) => {
        if (bandFilter === 'low') return (r.overall_score ?? 10) <= 6
        if (bandFilter === 'mid') return r.overall_score === 7 || r.overall_score === 8
        if (bandFilter === 'high') return (r.overall_score ?? 0) >= 9
        return true
      })
      .filter((r) => advisorFilter === 'all' || r.advisor_id === advisorFilter)
      .filter((r) => !s ||
        (r.client_name ?? '').toLowerCase().includes(s) ||
        (r.comment ?? '').toLowerCase().includes(s) ||
        (r.service_type ?? '').toLowerCase().includes(s))
      .sort((a, b) => sortDesc
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at))
  }, [responses, search, bandFilter, advisorFilter, statusFilter, sortDesc])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { if (page >= pages) setPage(0) }, [pages])

  async function setStatus(r: SurveyResponse, status: 'read' | 'archived' | 'new') {
    const { error } = await supabase.from('enquete_satisfaction_survey_responses').update({ status }).eq('id', r.id)
    if (error) { toast.error('Erreur : ' + error.message); return }
    setResponses((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))
    if (detail?.id === r.id) setDetail({ ...r, status })
    logAudit(profile?.id, `response.${status}`, 'survey_response', r.id)
    toast.success(status === 'archived' ? 'Réponse archivée' : 'Statut mis à jour')
  }

  async function confirmDelete() {
    if (!toDelete) return
    const { error } = await supabase.from('enquete_satisfaction_survey_responses').delete().eq('id', toDelete.id)
    if (error) { toast.error('Suppression impossible : ' + error.message); return }
    setResponses((prev) => prev.filter((x) => x.id !== toDelete.id))
    logAudit(profile?.id, 'response.delete', 'survey_response', toDelete.id, {
      score: toDelete.overall_score, client: toDelete.anonymous ? 'anonyme' : toDelete.client_name,
    })
    toast.success('Réponse supprimée définitivement')
    setToDelete(null)
    if (detail?.id === toDelete.id) setDetail(null)
  }

  return (
    <div className="space-y-5">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher (client, commentaire, prestation)…"
            className="w-72 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={bandFilter} onValueChange={setBandFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les notes</SelectItem>
            <SelectItem value="low">0-6 · Insatisfaits</SelectItem>
            <SelectItem value="mid">7-8 · Neutres</SelectItem>
            <SelectItem value="high">9-10 · Satisfaits</SelectItem>
          </SelectContent>
        </Select>
        <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les conseillers</SelectItem>
            {advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="archived">Archivées</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => exportResponsesToExcel(filtered)}>
            <FileSpreadsheet /> Exporter Excel
          </Button>
        </div>
      </div>

      {/* Tableau */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">Aucune réponse ne correspond aux filtres.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button className="flex items-center gap-1" onClick={() => setSortDesc(!sortDesc)}>
                      Date <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Conseiller</TableHead>
                  <TableHead>Prestation</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="max-w-[280px]">Commentaire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => {
                    setDetail(r)
                    if (r.status === 'new') setStatus(r, 'read')
                  }}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell className="font-medium">
                      {r.anonymous ? <span className="italic text-muted-foreground">Anonyme</span> : r.client_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{r.advisors?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.service_type ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('font-bold', scoreBadgeClass(r.overall_score))}>
                        {formatScore(r.overall_score)}/10
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate text-sm text-muted-foreground">{r.comment ?? '—'}</p>
                    </TableCell>
                    <TableCell>
                      {r.status === 'archived'
                        ? <Badge variant="muted">Archivée</Badge>
                        : r.status === 'new' ? <Badge variant="secondary">Nouvelle</Badge>
                        : <Badge variant="outline">Lue</Badge>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Voir le détail" onClick={() => setDetail(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canWrite && r.status !== 'archived' && (
                          <Button variant="ghost" size="icon" title="Archiver" onClick={() => setStatus(r, 'archived')}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        {canWrite && r.status === 'archived' && (
                          <Button variant="ghost" size="icon" title="Restaurer" onClick={() => setStatus(r, 'new')}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" title="Supprimer"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setToDelete(r)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{filtered.length} réponse{filtered.length > 1 ? 's' : ''} — page {page + 1}/{pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      {/* Détail d'une réponse */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  Réponse du {formatDateTime(detail.created_at)}
                  <Badge variant="outline" className={cn('font-bold', scoreBadgeClass(detail.overall_score))}>
                    {formatScore(detail.overall_score)}/10
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {detail.questionnaires?.title} · {detail.service_type ?? 'Prestation non précisée'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <Info label="Client" value={detail.anonymous ? 'Anonyme' : detail.client_name ?? '—'} />
                <Info label="E-mail" value={detail.anonymous ? '—' : detail.client_email ?? '—'} />
                <Info label="Conseiller" value={detail.advisors?.full_name ?? '—'} />
                <Info label="NPS" value={detail.nps_score !== null ? `${detail.nps_score}/10` : '—'} />
                <Info label="Durée de réponse" value={detail.duration_seconds ? `${detail.duration_seconds} s` : '—'} />
                <Info label="Statut" value={detail.status === 'new' ? 'Nouvelle' : detail.status === 'read' ? 'Lue' : 'Archivée'} />
              </div>
              {detail.comment && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commentaire</p>
                  <p className="mt-1 text-sm">« {detail.comment} »</p>
                </div>
              )}
              <Separator />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Réponses détaillées</p>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {questions
                    .filter((q) => q.questionnaire_id === detail.questionnaire_id)
                    .sort((a, b) => a.position - b.position)
                    .map((q) => {
                      const v = detail.answers?.[q.id]
                      if (v === undefined || v === null || q.type === 'message') return null
                      return (
                        <div key={q.id} className="flex justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{q.title}</span>
                          <span className="shrink-0 font-medium text-right">
                            {Array.isArray(v) ? v.join(', ') : String(v)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réponse ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La réponse et son suivi éventuel seront supprimés
              (droit à l'effacement RGPD).
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
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
