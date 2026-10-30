import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock3, ShieldCheck, Star, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AnswersMap, InvitationContext, Question, Questionnaire } from '@/lib/types'
import { visibleQuestions, isAnswerable, isAnswerValid, answerByRole } from '@/lib/logic'
import { AgavicLogo } from '@/components/agavic-logo'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QuestionInput } from './question-inputs'

type Phase = 'loading' | 'error' | 'survey' | 'done' | 'already-done'

interface AdvisorOpt { id: string; full_name: string }

export default function SurveyPage() {
  const { slug, token } = useParams<{ slug: string; token?: string }>()

  const [phase, setPhase] = useState<Phase>('loading')
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [invitation, setInvitation] = useState<InvitationContext | null>(null)
  const [advisors, setAdvisors] = useState<AdvisorOpt[]>([])
  const [googleUrl, setGoogleUrl] = useState('')

  const [answers, setAnswers] = useState<AnswersMap>({})
  const [stepIndex, setStepIndex] = useState(0)   // 0 = accueil, 1 = identité, 2+ = questions
  const [direction, setDirection] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const startedAt = useRef<number>(Date.now())
  const submittedRef = useRef(false)

  // Identification facultative
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [advisorId, setAdvisorId] = useState<string>('')
  const [serviceType, setServiceType] = useState<string>('')
  const [stayAnonymous, setStayAnonymous] = useState(false)

  const storageKey = `agavic-survey:${slug}:${token ?? 'open'}`

  // ------------------------------------------------------------------
  // Chargement initial
  // ------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      // Questionnaire + questions (lecture publique limitée aux actifs via RLS)
      const { data: q, error } = await supabase
        .from('enquete_satisfaction_questionnaires').select('*').eq('slug', slug).eq('status', 'active').maybeSingle()
      if (error || !q) { setPhase('error'); return }
      setQuestionnaire(q as Questionnaire)

      const { data: qs } = await supabase
        .from('enquete_satisfaction_questions').select('*').eq('questionnaire_id', q.id).order('position')
      setQuestions((qs ?? []) as Question[])

      const [{ data: pub }, { data: adv }] = await Promise.all([
        supabase.rpc('enquete_satisfaction_get_public_settings'),
        supabase.rpc('enquete_satisfaction_get_advisors_public'),
      ])
      if (pub?.google_review_url) setGoogleUrl(pub.google_review_url)
      else if (q.settings?.google_review_url) setGoogleUrl(q.settings.google_review_url)
      setAdvisors((adv ?? []) as AdvisorOpt[])

      // Jeton d'invitation éventuel
      if (token) {
        const { data: ctx } = await supabase.rpc('enquete_satisfaction_get_invitation_context', { p_token: token })
        if (!ctx || ctx.questionnaire_id !== q.id) { setPhase('error'); return }
        const c = ctx as InvitationContext
        setInvitation(c)
        if (c.completed) { setPhase('already-done'); return }
        if (c.recipient_name) setClientName(c.recipient_name)
        if (c.recipient_email) setClientEmail(c.recipient_email)
        if (c.advisor_id) setAdvisorId(c.advisor_id)
        if (c.service_type) setServiceType(c.service_type)
      }

      // Reprise d'un brouillon local
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const draft = JSON.parse(saved)
          if (draft.answers) setAnswers(draft.answers)
          if (typeof draft.stepIndex === 'number' && draft.stepIndex > 0) setStepIndex(draft.stepIndex)
        }
      } catch { /* ignore */ }

      startedAt.current = Date.now()
      setPhase('survey')
    }
    load()
  }, [slug, token])

  // Sauvegarde automatique du brouillon
  useEffect(() => {
    if (phase !== 'survey') return
    localStorage.setItem(storageKey, JSON.stringify({ answers, stepIndex }))
  }, [answers, stepIndex, phase, storageKey])

  // ------------------------------------------------------------------
  // Étapes : 0 accueil · 1 identité · 2..n questions
  // ------------------------------------------------------------------
  const visible = useMemo(() => visibleQuestions(questions, answers), [questions, answers])
  const totalSteps = visible.length + 2
  const currentQuestion = stepIndex >= 2 ? visible[stepIndex - 2] : null
  const isLast = stepIndex === totalSteps - 1

  // Borne l'index si un brouillon restauré dépasse le nombre d'étapes visible
  useEffect(() => {
    if (stepIndex > totalSteps - 1) setStepIndex(Math.max(0, totalSteps - 1))
  }, [stepIndex, totalSteps])

  const progress = useMemo(() => {
    const answerable = visible.filter(isAnswerable)
    if (!answerable.length) return 0
    const answered = answerable.filter((q) => {
      const v = answers[q.id]
      return v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0)
    })
    return Math.round((answered.length / answerable.length) * 100)
  }, [visible, answers])

  const setAnswer = useCallback((qid: string, v: AnswersMap[string]) => {
    setAnswers((prev) => ({ ...prev, [qid]: v }))
  }, [])

  const canContinue = !currentQuestion || isAnswerValid(currentQuestion, answers[currentQuestion.id])

  function next() {
    if (stepIndex >= totalSteps - 1) { submit(); return }
    setDirection(1)
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1))
  }
  function prev() {
    setDirection(-1)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  // ------------------------------------------------------------------
  // Soumission via la fonction sécurisée (double-soumission bloquée)
  // ------------------------------------------------------------------
  async function submit() {
    if (submitting || submittedRef.current || !questionnaire) return
    setSubmitting(true)
    setSubmitError('')
    const anonymous = questionnaire.settings?.anonymous ? stayAnonymous && !invitation : false
    const { error } = await supabase.rpc('enquete_satisfaction_submit_survey_response', {
      p_questionnaire_id: questionnaire.id,
      p_invitation_token: token ?? null,
      p_advisor_id: advisorId || null,
      p_service_type: serviceType || null,
      p_client_name: clientName || null,
      p_client_email: clientEmail || null,
      p_overall_score: (answerByRole(questions, answers, 'overall') as number | null) ?? null,
      p_nps_score: (answerByRole(questions, answers, 'nps') as number | null) ?? null,
      p_anonymous: anonymous,
      p_answers: answers,
      p_comment: (answerByRole(questions, answers, 'comment') as string | null) ?? null,
      p_duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
    setSubmitting(false)
    if (error) {
      if (error.message.includes('already_completed')) { setPhase('already-done'); return }
      if (error.message.includes('questionnaire_unavailable')) { setPhase('error'); return }
      setSubmitError("Une erreur est survenue. Merci de réessayer dans un instant.")
      return
    }
    submittedRef.current = true
    localStorage.removeItem(storageKey)
    setPhase('done')
  }

  // ------------------------------------------------------------------
  // Rendus
  // ------------------------------------------------------------------
  if (phase === 'loading') {
    return (
      <SurveyShell>
        <div className="flex flex-col items-center gap-4 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
          <p className="text-sm text-muted-foreground">Chargement du questionnaire…</p>
        </div>
      </SurveyShell>
    )
  }

  if (phase === 'error') {
    return (
      <SurveyShell>
        <div className="py-16 text-center">
          <p className="font-serif text-2xl font-semibold">Questionnaire indisponible</p>
          <p className="mt-2 text-muted-foreground">Ce lien a expiré ou le questionnaire n'est plus actif.</p>
        </div>
      </SurveyShell>
    )
  }

  if (phase === 'already-done') {
    return (
      <SurveyShell>
        <div className="py-16 text-center animate-fade-in">
          <CheckCircle2 className="mx-auto h-14 w-14 text-gold-500" />
          <p className="mt-4 font-serif text-2xl font-semibold">Vous avez déjà répondu</p>
          <p className="mt-2 text-muted-foreground">Merci, votre avis a bien été pris en compte.</p>
        </div>
      </SurveyShell>
    )
  }

  if (phase === 'done') {
    return (
      <SurveyShell>
        <ThankYouScreen googleUrl={googleUrl} />
      </SurveyShell>
    )
  }

  const settings = questionnaire!.settings ?? {}
  const serviceTypes = settings.service_types ?? []
  const identityOptional = settings.anonymous !== false

  return (
    <SurveyShell progress={stepIndex >= 2 ? progress : undefined}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={stepIndex}
          custom={direction}
          initial={{ opacity: 0, x: 40 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 * direction }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="w-full"
        >
          {/* Étape 0 — Accueil */}
          {stepIndex === 0 && (
            <div className="flex flex-col items-center text-center">
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-balance">
                {settings.welcome_title ?? 'Votre avis nous intéresse !'}
              </h1>
              <p className="mt-4 max-w-md text-muted-foreground">
                {settings.welcome_text ??
                  'Votre retour est précieux pour nous aider à améliorer la qualité de nos conseils et de notre accompagnement patrimonial.'}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Durée estimée : {settings.estimated_minutes ?? '1 à 2'} minutes
              </div>
              <Button variant="gold" size="lg" className="mt-8 group" onClick={next}>
                Commencer
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Button>
              <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Vos réponses restent confidentielles — merci pour votre confiance !
              </p>
            </div>
          )}

          {/* Étape 1 — Identification facultative */}
          {stepIndex === 1 && (
            <div className="mx-auto w-full max-w-md">
              <StepCounter current={1} total={totalSteps} />
              <h2 className="font-serif text-2xl font-semibold">Quelques informations sur vous</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {identityOptional
                  ? 'Ces informations sont facultatives et nous aident à mieux traiter votre retour.'
                  : 'Ces informations nous aident à contextualiser votre retour.'}
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="name">Nom et prénom</Label>
                  <Input id="name" className="mt-1.5 h-11" value={clientName}
                    onChange={(e) => setClientName(e.target.value)} placeholder="Jean Dupont"
                    disabled={stayAnonymous} />
                </div>
                <div>
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input id="email" type="email" className="mt-1.5 h-11" value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)} placeholder="jean.dupont@email.fr"
                    disabled={stayAnonymous} />
                </div>
                <div>
                  <Label>Conseiller concerné</Label>
                  <Select value={advisorId} onValueChange={setAdvisorId}
                    disabled={stayAnonymous || Boolean(invitation?.advisor_id)}>
                    <SelectTrigger className="mt-1.5 h-11">
                      <SelectValue placeholder="Sélectionnez votre conseiller" />
                    </SelectTrigger>
                    <SelectContent>
                      {advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {invitation?.advisor_name && (
                    <p className="mt-1 text-xs text-muted-foreground">Conseiller : {invitation.advisor_name}</p>
                  )}
                </div>
                <div>
                  <Label>Type de rendez-vous ou prestation</Label>
                  <Select value={serviceType} onValueChange={setServiceType} disabled={stayAnonymous}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Sélectionnez…" /></SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {identityOptional && !invitation && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox id="anon" checked={stayAnonymous}
                      onCheckedChange={(c) => setStayAnonymous(c === true)} />
                    <Label htmlFor="anon" className="text-sm font-normal text-muted-foreground">
                      Je préfère répondre anonymement
                    </Label>
                  </div>
                )}
              </div>
              <StepNav onPrev={prev} onNext={next} nextLabel="Suivant" />
            </div>
          )}

          {/* Étapes questions */}
          {currentQuestion && (
            <div className="mx-auto w-full max-w-2xl text-center">
              <StepCounter current={stepIndex} total={totalSteps} />
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-balance">
                {currentQuestion.title}
              </h2>
              {currentQuestion.description && (
                <p className="mt-2 text-muted-foreground">{currentQuestion.description}</p>
              )}
              <div className="mt-8">
                <QuestionInput
                  question={currentQuestion}
                  value={answers[currentQuestion.id] ?? null}
                  onChange={(v) => setAnswer(currentQuestion.id, v)}
                  onAdvance={next}
                />
              </div>
              {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}
              <StepNav
                onPrev={prev}
                onNext={next}
                nextLabel={isLast ? (submitting ? 'Envoi…' : 'Envoyer') : 'Suivant'}
                nextDisabled={!canContinue || submitting}
                hideNext={isAutoAdvancing(currentQuestion.type)}
                optional={!currentQuestion.required && isAnswerable(currentQuestion)}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </SurveyShell>
  )
}

// ---------------------------------------------------------------------------

function isAutoAdvancing(type: string) {
  return ['score_10', 'nps', 'stars', 'single_choice', 'yes_no'].includes(type)
}

function StepCounter({ current, total }: { current: number; total: number }) {
  return (
    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold-600">
      {current} / {total - 1}
    </p>
  )
}

function StepNav({ onPrev, onNext, nextLabel, nextDisabled, hideNext, optional }: {
  onPrev: () => void
  onNext: () => void
  nextLabel: string
  nextDisabled?: boolean
  hideNext?: boolean
  optional?: boolean
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <Button variant="ghost" onClick={onPrev} className="text-muted-foreground">
        <ArrowLeft /> Retour
      </Button>
      <div className="flex items-center gap-3">
        {optional && (
          <button onClick={onNext} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Passer
          </button>
        )}
        {!hideNext && (
          <Button variant="gold" onClick={onNext} disabled={nextDisabled}>
            {nextLabel} <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page de remerciement — le lien Google reste accessible à tous les répondants
// ---------------------------------------------------------------------------
function ThankYouScreen({ googleUrl }: { googleUrl: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="py-10 text-center"
    >
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full gold-gradient shadow-xl"
      >
        <CheckCircle2 className="h-10 w-10 text-navy-950" />
      </motion.div>
      <h1 className="mt-6 font-serif text-3xl sm:text-4xl font-bold">Merci pour votre confiance !</h1>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        Votre avis contribue directement à l'amélioration continue de notre accompagnement.
      </p>
      {googleUrl && (
        <div className="mt-8">
          <p className="mb-3 text-sm text-muted-foreground">
            Vous pouvez également partager votre avis sur Google — cela nous aidera beaucoup.
          </p>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer">
              <Star className="h-4 w-4 fill-gold-400 text-gold-500" />
              Laisser un avis sur Google
            </a>
          </Button>
        </div>
      )}
      <p className="mt-10 font-serif text-sm italic text-muted-foreground">
        Ensemble, construisons votre patrimoine de demain.
      </p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Coquille : fond crème, carte centrée, barre de progression
// ---------------------------------------------------------------------------
function SurveyShell({ children, progress }: { children: React.ReactNode; progress?: number }) {
  return (
    <div className="min-h-screen bg-cream dark:bg-navy-950 flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <AgavicLogo />
        <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Espace cabinet
        </Link>
      </header>
      {progress !== undefined && (
        <div className="px-5 sm:px-8">
          <Progress value={progress} className="h-1" />
        </div>
      )}
      <main className="flex flex-1 items-center justify-center px-5 pb-16 pt-6">
        <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-xl shadow-navy-900/5 sm:p-10">
          {children}
        </div>
      </main>
      <footer className="pb-5 text-center text-[11px] text-muted-foreground">
        AGAVIC Patrimoine — 45 rue de la Bourse, 69002 Lyon · Réponses traitées conformément au RGPD
      </footer>
    </div>
  )
}
