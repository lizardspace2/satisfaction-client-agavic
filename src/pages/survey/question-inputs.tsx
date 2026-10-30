import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Check, AlertCircle, Heart, ThumbsUp, ThumbsDown, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AnswerValue, Question } from '@/lib/types'

interface Props {
  question: Question
  value: AnswerValue
  onChange: (v: AnswerValue) => void
  onAdvance?: () => void
}

export function QuestionInput({ question, value, onChange, onAdvance }: Props) {
  switch (question.type) {
    case 'score_10':
    case 'nps':
      return <ScoreScale question={question} value={value} onChange={onChange} onAdvance={onAdvance} />
    case 'stars':
      return <StarsInput value={value} onChange={onChange} onAdvance={onAdvance} />
    case 'single_choice':
      return <SingleChoice question={question} value={value} onChange={onChange} onAdvance={onAdvance} />
    case 'multi_choice':
      return <MultiChoice question={question} value={value} onChange={onChange} />
    case 'text':
      return <TextInput question={question} value={value} onChange={onChange} />
    case 'yes_no':
      return <YesNo value={value} onChange={onChange} onAdvance={onAdvance} />
    case 'date':
      return <Input type="date" className="h-12 max-w-xs text-base" value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)} />
    case 'email':
      return <Input type="email" placeholder="votre@email.fr" className="h-12 max-w-md text-base"
        value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    case 'dropdown':
      return (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger className="h-12 max-w-xs text-base"><SelectValue placeholder="Sélectionnez…" /></SelectTrigger>
          <SelectContent>
            {(question.options?.choices ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    case 'message':
      return <MessageBlock question={question} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Échelle 0-10 (boutons ronds) — auto-avance après sélection
// ---------------------------------------------------------------------------
function ScoreScale({ question, value, onChange, onAdvance }: Props) {
  const isNps = question.type === 'nps'
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
        {Array.from({ length: 11 }, (_, n) => (
          <motion.button
            key={n}
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => { onChange(n); if (onAdvance) setTimeout(onAdvance, 350) }}
            aria-label={`Note ${n}`}
            className={cn(
              'h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 font-semibold transition-all duration-200 text-sm sm:text-base',
              value === n
                ? 'gold-gradient border-gold-500 text-navy-950 shadow-lg scale-110'
                : 'border-navy-200 bg-white text-navy-800 hover:border-gold-400 hover:shadow-md dark:bg-navy-800 dark:border-navy-600 dark:text-white'
            )}
          >
            {n}
          </motion.button>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-xs sm:text-sm text-muted-foreground">
        <span>{question.options?.min_label ?? (isNps ? 'Pas du tout probable' : 'Pas du tout satisfait')}</span>
        <span>{question.options?.max_label ?? (isNps ? 'Très probable' : 'Très satisfait')}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Étoiles 1-5
// ---------------------------------------------------------------------------
function StarsInput({ value, onChange, onAdvance }: Omit<Props, 'question'>) {
  const [hover, setHover] = useState(0)
  const current = typeof value === 'number' ? value : 0
  return (
    <div className="flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button key={n} type="button" whileTap={{ scale: 0.85 }}
          onMouseEnter={() => setHover(n)}
          onClick={() => { onChange(n); if (onAdvance) setTimeout(onAdvance, 300) }}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          className="p-1 transition-transform hover:scale-110">
          <Star
            className={cn('h-10 w-10 transition-colors',
              (hover || current) >= n ? 'fill-gold-400 text-gold-500' : 'text-navy-200 dark:text-navy-600')}
          />
        </motion.button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Choix unique
// ---------------------------------------------------------------------------
function SingleChoice({ question, value, onChange, onAdvance }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
      {(question.options?.choices ?? []).map((choice, i) => (
        <motion.button key={choice} type="button"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          onClick={() => { onChange(choice); if (onAdvance) setTimeout(onAdvance, 280) }}
          className={cn(
            'flex items-center justify-between rounded-xl border-2 px-5 py-3.5 text-left transition-all',
            value === choice
              ? 'border-gold-500 bg-gold-50 text-navy-900 shadow-md dark:bg-gold-950/30 dark:text-gold-100'
              : 'border-navy-100 bg-white hover:border-gold-300 hover:shadow-sm dark:bg-navy-800 dark:border-navy-700 dark:hover:border-gold-600'
          )}>
          <span className="font-medium">{choice}</span>
          {value === choice && <Check className="h-5 w-5 text-gold-600" />}
        </motion.button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Choix multiples
// ---------------------------------------------------------------------------
function MultiChoice({ question, value, onChange }: Props) {
  const selected = Array.isArray(value) ? value : []
  const toggle = (c: string) =>
    onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c])
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
      {(question.options?.choices ?? []).map((choice) => {
        const active = selected.includes(choice)
        return (
          <button key={choice} type="button" onClick={() => toggle(choice)}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 px-5 py-3 text-left transition-all',
              active
                ? 'border-gold-500 bg-gold-50 text-navy-900 dark:bg-gold-950/30 dark:text-gold-100'
                : 'border-navy-100 bg-white hover:border-gold-300 dark:bg-navy-800 dark:border-navy-700 dark:hover:border-gold-600'
            )}>
            <span className={cn('flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
              active ? 'border-gold-500 bg-gold-500' : 'border-navy-200 dark:border-navy-500')}>
              {active && <Check className="h-3.5 w-3.5 text-navy-950" strokeWidth={3} />}
            </span>
            <span className="font-medium">{choice}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Texte libre
// ---------------------------------------------------------------------------
function TextInput({ question, value, onChange }: Props) {
  const max = question.options?.max_length ?? 500
  const text = String(value ?? '')
  return (
    <div className="mx-auto w-full max-w-lg">
      <Textarea
        value={text}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.options?.placeholder ?? 'Votre réponse…'}
        className="min-h-[130px] rounded-xl text-base"
      />
      <div className="mt-1 text-right text-xs text-muted-foreground">{text.length}/{max}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Oui / Non
// ---------------------------------------------------------------------------
function YesNo({ value, onChange, onAdvance }: Omit<Props, 'question'>) {
  const opts = [
    { v: 'Oui', icon: ThumbsUp },
    { v: 'Non', icon: ThumbsDown },
  ]
  return (
    <div className="flex justify-center gap-4">
      {opts.map(({ v, icon: Icon }) => (
        <button key={v} type="button"
          onClick={() => { onChange(v); if (onAdvance) setTimeout(onAdvance, 280) }}
          className={cn(
            'flex items-center gap-3 rounded-xl border-2 px-8 py-4 font-medium transition-all',
            value === v
              ? 'border-gold-500 bg-gold-50 text-navy-900 shadow-md dark:bg-gold-950/30 dark:text-gold-100'
              : 'border-navy-100 bg-white hover:border-gold-300 dark:bg-navy-800 dark:border-navy-700'
          )}>
          <Icon className="h-5 w-5 text-gold-600" />
          {v}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Écran message (variant: empathy | neutral | positive)
// ---------------------------------------------------------------------------
function MessageBlock({ question }: { question: Question }) {
  const variant = question.options?.variant ?? 'neutral'
  const config = {
    empathy: { icon: AlertCircle, cls: 'bg-red-500/10 text-red-600 border-red-200' },
    neutral: { icon: Heart, cls: 'bg-amber-500/10 text-amber-600 border-amber-200' },
    positive: { icon: PartyPopper, cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  }[variant]
  const Icon = config.icon
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={cn('flex h-16 w-16 items-center justify-center rounded-full border', config.cls)}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  )
}

// Bouton de validation générique pour les questions sans auto-avance
export function ContinueButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="gold" size="lg" onClick={onClick} disabled={disabled} className="mt-6">
      Suivant
    </Button>
  )
}
