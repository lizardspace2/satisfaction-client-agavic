import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft, GripVertical, Plus, Trash2, Save, ExternalLink, X, ListFilter,
  CopyPlus, Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit'
import type { ConditionRule, Question, Questionnaire, QuestionType } from '@/lib/types'
import { QUESTION_TYPE_LABELS, QUESTIONNAIRE_STATUS_LABELS } from '@/lib/format'
import { isAnswerable } from '@/lib/logic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const OPS = [
  { v: 'eq', l: 'est égale à' }, { v: 'neq', l: 'est différente de' },
  { v: 'lt', l: 'est inférieure à' }, { v: 'lte', l: 'est inférieure ou égale à' },
  { v: 'gt', l: 'est supérieure à' }, { v: 'gte', l: 'est supérieure ou égale à' },
  { v: 'contains', l: 'contient' },
]

export default function QuestionnaireEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { profile, canWrite } = useAuth()

  const [loading, setLoading] = useState(true)
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: q } = await supabase.from('enquete_satisfaction_questionnaires').select('*').eq('id', id).single()
    if (!q) { setLoading(false); return }
    const { data: qs } = await supabase.from('enquete_satisfaction_questions')
      .select('*').eq('questionnaire_id', id).order('position')
    setQuestionnaire(q as Questionnaire)
    setQuestions((qs ?? []) as Question[])
    setSelectedId((qs?.[0]?.id) ?? null)
    setLoading(false)
  }

  const selected = questions.find((q) => q.id === selectedId) ?? null

  function patchQuestion(qid: string, patch: Partial<Question>) {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)))
    setDirty(true)
  }

  function addQuestion(type: QuestionType) {
    const q: Question = {
      id: crypto.randomUUID(),
      questionnaire_id: id!,
      title: type === 'message' ? 'Message informatif' : 'Nouvelle question',
      description: null,
      type,
      options: type === 'single_choice' || type === 'multi_choice' || type === 'dropdown'
        ? { choices: ['Option 1', 'Option 2'] }
        : type === 'score_10' || type === 'nps'
        ? { min_label: 'Pas du tout', max_label: 'Tout à fait' }
        : {},
      conditions: {},
      required: type === 'score_10',
      position: questions.length + 1,
      created_at: new Date().toISOString(),
    }
    setQuestions((prev) => [...prev, q])
    setSelectedId(q.id)
    setDirty(true)
    setAddOpen(false)
  }

  function removeQuestion(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid))
    if (!qid.startsWith('temp')) setRemovedIds((prev) => [...prev, qid])
    if (selectedId === qid) setSelectedId(questions.find((q) => q.id !== qid)?.id ?? null)
    setDirty(true)
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = questions.findIndex((q) => q.id === active.id)
    const newIdx = questions.findIndex((q) => q.id === over.id)
    setQuestions(arrayMove(questions, oldIdx, newIdx).map((q, i) => ({ ...q, position: i + 1 })))
    setDirty(true)
  }

  async function save() {
    if (!questionnaire) return
    setSaving(true)
    // 1. Métadonnées du questionnaire
    const { error: qErr } = await supabase.from('enquete_satisfaction_questionnaires').update({
      title: questionnaire.title, description: questionnaire.description,
      slug: questionnaire.slug, status: questionnaire.status, settings: questionnaire.settings,
    }).eq('id', questionnaire.id)
    if (qErr) { toast.error(qErr.message); setSaving(false); return }

    // 2. Suppressions
    if (removedIds.length) {
      await supabase.from('enquete_satisfaction_questions').delete().in('id', removedIds)
    }

    // 3. Upsert des questions avec positions recalculées
    const rows = questions.map((q, i) => ({
      id: q.id, questionnaire_id: id, title: q.title, description: q.description,
      type: q.type, options: q.options, conditions: q.conditions,
      required: q.required, position: i + 1,
    }))
    const { error: upErr } = await supabase.from('enquete_satisfaction_questions').upsert(rows)
    if (upErr) { toast.error(upErr.message); setSaving(false); return }

    logAudit(profile?.id, 'questionnaire.update', 'questionnaire', questionnaire.id, {
      questions: rows.length,
    })
    setRemovedIds([])
    setDirty(false)
    setSaving(false)
    toast.success('Questionnaire enregistré')
  }

  if (loading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
  if (!questionnaire) return <p className="text-muted-foreground">Questionnaire introuvable.</p>

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/questionnaires"><ArrowLeft /></Link></Button>
          <div>
            <h2 className="font-serif text-xl font-semibold">{questionnaire.title}</h2>
            <p className="text-xs text-muted-foreground">
              /avis/{questionnaire.slug} · <Badge variant={questionnaire.status === 'active' ? 'success' : 'warning'} className="ml-1">{QUESTIONNAIRE_STATUS_LABELS[questionnaire.status]}</Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 /> Paramètres</Button>
          <Button variant="outline" asChild disabled={questionnaire.status !== 'active'}>
            <a href={`/avis/${questionnaire.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Aperçu</a>
          </Button>
          {canWrite && (
            <Button variant="gold" onClick={save} disabled={!dirty || saving}>
              <Save /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          )}
        </div>
      </div>

      {dirty && <p className="text-sm text-amber-600">Modifications non enregistrées.</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,2fr)_3fr]">
        {/* Liste des questions (glisser-déposer) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Questions ({questions.length})</CardTitle>
            {canWrite && <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus /> Ajouter</Button>}
          </CardHeader>
          <CardContent className="max-h-[65vh] space-y-2 overflow-y-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                {questions.map((q, i) => (
                  <SortableQuestion key={q.id} q={q} index={i}
                    active={q.id === selectedId}
                    onSelect={() => setSelectedId(q.id)}
                    onRemove={() => removeQuestion(q.id)}
                    readOnly={!canWrite} />
                ))}
              </SortableContext>
            </DndContext>
            {questions.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune question. Cliquez sur « Ajouter » pour commencer.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Panneau d'édition */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">{selected ? 'Édition de la question' : 'Sélectionnez une question'}</CardTitle>
            {selected && <CardDescription>{QUESTION_TYPE_LABELS[selected.type]}</CardDescription>}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Cliquez sur une question dans la liste pour la modifier.</p>
            ) : (
              <QuestionEditor
                key={selected.id}
                question={selected}
                allQuestions={questions}
                readOnly={!canWrite}
                onPatch={(p) => patchQuestion(selected.id, p)}
                onDuplicate={() => {
                  const copy: Question = { ...selected, id: crypto.randomUUID(), title: `${selected.title} (copie)`, position: questions.length + 1, created_at: '' }
                  setQuestions((prev) => [...prev, copy])
                  setDirty(true)
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Choix du type de question */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ajouter une question</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <button key={t} onClick={() => addQuestion(t)}
                className="rounded-xl border-2 border-border p-3 text-left text-sm font-medium transition-colors hover:border-gold-400 hover:bg-gold-50/50 dark:hover:bg-gold-950/20">
                {QUESTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Paramètres du questionnaire */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Paramètres du questionnaire</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titre</Label>
              <Input className="mt-1.5" value={questionnaire.title} disabled={!canWrite}
                onChange={(e) => { setQuestionnaire({ ...questionnaire, title: e.target.value }); setDirty(true) }} />
            </div>
            <div>
              <Label>Description interne</Label>
              <Textarea className="mt-1.5" rows={2} value={questionnaire.description ?? ''} disabled={!canWrite}
                onChange={(e) => { setQuestionnaire({ ...questionnaire, description: e.target.value }); setDirty(true) }} />
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={questionnaire.status} disabled={!canWrite}
                onValueChange={(v) => { setQuestionnaire({ ...questionnaire, status: v as Questionnaire['status'] }); setDirty(true) }}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon (non accessible)</SelectItem>
                  <SelectItem value="active">Actif (accessible via le lien)</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Réponses anonymes autorisées</Label>
              <Switch checked={questionnaire.settings?.anonymous !== false} disabled={!canWrite}
                onCheckedChange={(c) => { setQuestionnaire({ ...questionnaire, settings: { ...questionnaire.settings, anonymous: c } }); setDirty(true) }} />
            </div>
            <div>
              <Label>Titre de l'écran d'accueil</Label>
              <Input className="mt-1.5" value={questionnaire.settings?.welcome_title ?? ''} disabled={!canWrite}
                onChange={(e) => { setQuestionnaire({ ...questionnaire, settings: { ...questionnaire.settings, welcome_title: e.target.value } }); setDirty(true) }} />
            </div>
            <div>
              <Label>Texte de l'écran d'accueil</Label>
              <Textarea className="mt-1.5" rows={2} value={questionnaire.settings?.welcome_text ?? ''} disabled={!canWrite}
                onChange={(e) => { setQuestionnaire({ ...questionnaire, settings: { ...questionnaire.settings, welcome_text: e.target.value } }); setDirty(true) }} />
            </div>
            <div>
              <Label>Types de prestation (un par ligne)</Label>
              <Textarea className="mt-1.5" rows={4} disabled={!canWrite}
                value={(questionnaire.settings?.service_types ?? []).join('\n')}
                onChange={(e) => {
                  const list = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                  setQuestionnaire({ ...questionnaire, settings: { ...questionnaire.settings, service_types: list } })
                  setDirty(true)
                }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Élément sortable
// ---------------------------------------------------------------------------
function SortableQuestion({ q, index, active, onSelect, onRemove, readOnly }: {
  q: Question; index: number; active: boolean
  onSelect: () => void; onRemove: () => void; readOnly: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id, disabled: readOnly })
  const hasConditions = (q.conditions?.rules?.length ?? 0) > 0
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors',
        active ? 'border-gold-500 bg-gold-50/60 dark:bg-gold-950/20' : 'hover:bg-muted/60',
        isDragging && 'z-10 shadow-lg opacity-90'
      )}>
      <button {...attributes} {...listeners}
        className={cn('cursor-grab text-muted-foreground', readOnly && 'invisible')}
        onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{q.title}</p>
        <p className="text-xs text-muted-foreground">
          {QUESTION_TYPE_LABELS[q.type]}
          {q.required && ' · obligatoire'}
          {hasConditions && ' · conditionnelle'}
        </p>
      </div>
      {hasConditions && <ListFilter className="h-3.5 w-3.5 shrink-0 text-secondary" />}
      {!readOnly && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulaire d'édition d'une question
// ---------------------------------------------------------------------------
function QuestionEditor({ question, allQuestions, readOnly, onPatch, onDuplicate }: {
  question: Question
  allQuestions: Question[]
  readOnly: boolean
  onPatch: (p: Partial<Question>) => void
  onDuplicate: () => void
}) {
  const opts = question.options ?? {}
  const conds = question.conditions ?? {}

  const setOpt = (patch: Partial<typeof opts>) => onPatch({ options: { ...opts, ...patch } })
  const setConds = (patch: Partial<typeof conds>) => onPatch({ conditions: { ...conds, ...patch } })

  // Questions utilisables comme source de condition (répondables)
  const condSources = allQuestions.filter((q) => q.id !== question.id && isAnswerable(q))

  function sourceFor(rule: ConditionRule) {
    return allQuestions.find((q) => q.id === rule.question_id)
  }

  function coerceValue(src: Question | undefined, raw: string): string | number {
    if (src && ['score_10', 'nps', 'stars'].includes(src.type)) {
      const n = Number(raw)
      return Number.isNaN(n) ? raw : n
    }
    return raw
  }

  const hasChoices = ['single_choice', 'multi_choice', 'dropdown'].includes(question.type)
  const isScale = ['score_10', 'nps'].includes(question.type)

  return (
    <div className="space-y-5">
      <div>
        <Label>Intitulé de la question *</Label>
        <Input className="mt-1.5" value={question.title} disabled={readOnly}
          onChange={(e) => onPatch({ title: e.target.value })} />
      </div>
      <div>
        <Label>Description (sous-titre)</Label>
        <Input className="mt-1.5" value={question.description ?? ''} disabled={readOnly}
          onChange={(e) => onPatch({ description: e.target.value || null })} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={question.required} disabled={readOnly}
            onCheckedChange={(c) => onPatch({ required: c })} />
          <Label>Réponse obligatoire</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">Rôle métier</Label>
          <Select value={opts.role ?? 'none'} disabled={readOnly}
            onValueChange={(v) => setOpt({ role: v === 'none' ? undefined : (v as 'overall' | 'nps' | 'comment') })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              <SelectItem value="overall">Note globale</SelectItem>
              <SelectItem value="nps">NPS</SelectItem>
              <SelectItem value="comment">Commentaire</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Options selon le type */}
      {hasChoices && (
        <div>
          <Label>Choix de réponse</Label>
          <div className="mt-1.5 space-y-2">
            {(opts.choices ?? []).map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input value={c} disabled={readOnly}
                  onChange={(e) => {
                    const choices = [...(opts.choices ?? [])]
                    choices[i] = e.target.value
                    setOpt({ choices })
                  }} />
                {!readOnly && (
                  <Button variant="ghost" size="icon" onClick={() => setOpt({ choices: (opts.choices ?? []).filter((_, j) => j !== i) })}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => setOpt({ choices: [...(opts.choices ?? []), `Option ${(opts.choices?.length ?? 0) + 1}`] })}>
                <Plus /> Ajouter un choix
              </Button>
            )}
          </div>
        </div>
      )}

      {isScale && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Label minimum (0)</Label>
            <Input className="mt-1.5" value={opts.min_label ?? ''} disabled={readOnly}
              onChange={(e) => setOpt({ min_label: e.target.value })} />
          </div>
          <div>
            <Label>Label maximum (10)</Label>
            <Input className="mt-1.5" value={opts.max_label ?? ''} disabled={readOnly}
              onChange={(e) => setOpt({ max_label: e.target.value })} />
          </div>
        </div>
      )}

      {question.type === 'text' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Placeholder</Label>
            <Input className="mt-1.5" value={opts.placeholder ?? ''} disabled={readOnly}
              onChange={(e) => setOpt({ placeholder: e.target.value })} />
          </div>
          <div>
            <Label>Longueur max</Label>
            <Input className="mt-1.5" type="number" value={opts.max_length ?? 500} disabled={readOnly}
              onChange={(e) => setOpt({ max_length: Number(e.target.value) || 500 })} />
          </div>
        </div>
      )}

      {question.type === 'message' && (
        <div>
          <Label>Ton du message</Label>
          <Select value={opts.variant ?? 'neutral'} disabled={readOnly}
            onValueChange={(v) => setOpt({ variant: v as 'empathy' | 'neutral' | 'positive' })}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="empathy">Empathique (insatisfaction)</SelectItem>
              <SelectItem value="neutral">Neutre (amélioration)</SelectItem>
              <SelectItem value="positive">Positif (satisfaction)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {/* Éditeur de conditions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><ListFilter className="h-4 w-4 text-secondary" /> Conditions d'affichage</Label>
          {(conds.rules?.length ?? 0) > 1 && (
            <Select value={conds.combinator ?? 'and'} disabled={readOnly}
              onValueChange={(v) => setConds({ combinator: v as 'and' | 'or' })}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="and">Toutes (ET)</SelectItem>
                <SelectItem value="or">Au moins une (OU)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Sans condition, la question s'affiche toujours. Exemple : « SI note ≤ 6 ALORS afficher ».
        </p>
        <div className="space-y-2">
          {(conds.rules ?? []).map((rule, i) => {
            const src = sourceFor(rule)
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                <span className="font-semibold text-secondary">SI</span>
                <Select value={rule.question_id} disabled={readOnly}
                  onValueChange={(v) => {
                    const rules = [...(conds.rules ?? [])]
                    rules[i] = { ...rules[i], question_id: v, value: '' }
                    setConds({ rules })
                  }}>
                  <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Question…" /></SelectTrigger>
                  <SelectContent>
                    {condSources.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.title.slice(0, 40)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rule.op} disabled={readOnly}
                  onValueChange={(v) => {
                    const rules = [...(conds.rules ?? [])]
                    rules[i] = { ...rules[i], op: v as ConditionRule['op'] }
                    setConds({ rules })
                  }}>
                  <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
                {src && src.options?.choices?.length ? (
                  <Select value={String(rule.value)} disabled={readOnly}
                    onValueChange={(v) => {
                      const rules = [...(conds.rules ?? [])]
                      rules[i] = { ...rules[i], value: v }
                      setConds({ rules })
                    }}>
                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Valeur…" /></SelectTrigger>
                    <SelectContent>
                      {src.options.choices.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="h-8 w-24" value={String(rule.value)} disabled={readOnly}
                    onChange={(e) => {
                      const rules = [...(conds.rules ?? [])]
                      rules[i] = { ...rules[i], value: coerceValue(src, e.target.value) }
                      setConds({ rules })
                    }} />
                )}
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => setConds({ rules: (conds.rules ?? []).filter((_, j) => j !== i) })}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {!readOnly && condSources.length > 0 && (
          <Button variant="outline" size="sm" className="mt-2"
            onClick={() => setConds({ rules: [...(conds.rules ?? []), { question_id: condSources[0].id, op: 'lte', value: 6 }] })}>
            <Plus /> Ajouter une condition
          </Button>
        )}
      </div>

      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={onDuplicate}>
          <CopyPlus /> Dupliquer cette question
        </Button>
      )}
    </div>
  )
}
