import { format, startOfMonth, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SurveyResponse } from './types'

export function averageScore(responses: SurveyResponse[]): number {
  const scored = responses.filter((r) => r.overall_score !== null)
  if (!scored.length) return 0
  return scored.reduce((s, r) => s + (r.overall_score ?? 0), 0) / scored.length
}

/** NPS = % promoteurs (9-10) - % détracteurs (0-6), sur la note NPS. */
export function computeNps(responses: SurveyResponse[]): number {
  const scored = responses.filter((r) => r.nps_score !== null && r.nps_score !== undefined)
  if (!scored.length) return 0
  const promoters = scored.filter((r) => (r.nps_score ?? 0) >= 9).length
  const detractors = scored.filter((r) => (r.nps_score ?? 0) <= 6).length
  return Math.round(((promoters - detractors) / scored.length) * 100)
}

/** CSAT : % de notes >= 7. */
export function computeCsat(responses: SurveyResponse[]): number {
  const scored = responses.filter((r) => r.overall_score !== null)
  if (!scored.length) return 0
  return Math.round((scored.filter((r) => (r.overall_score ?? 0) >= 7).length / scored.length) * 100)
}

export function scoreDistribution(responses: SurveyResponse[]) {
  const buckets = [
    { label: '0-6 · Insatisfaits', min: 0, max: 6 },
    { label: '7-8 · Neutres', min: 7, max: 8 },
    { label: '9-10 · Satisfaits', min: 9, max: 10 },
  ]
  return buckets.map((b) => ({
    label: b.label,
    value: responses.filter((r) =>
      r.overall_score !== null && r.overall_score >= b.min && r.overall_score <= b.max).length,
  }))
}

export function detailedDistribution(responses: SurveyResponse[]) {
  return Array.from({ length: 11 }, (_, n) => ({
    note: String(n),
    value: responses.filter((r) => r.overall_score === n).length,
  }))
}

/** Évolution mensuelle de la note moyenne sur n mois. */
export function monthlyEvolution(responses: SurveyResponse[], months = 6) {
  const now = startOfMonth(new Date())
  return Array.from({ length: months }, (_, i) => {
    const start = subMonths(now, months - 1 - i)
    const end = subMonths(now, months - 2 - i)
    const inMonth = responses.filter((r) => {
      const d = new Date(r.created_at)
      return d >= start && d < end && r.overall_score !== null
    })
    return {
      month: format(start, 'MMM', { locale: fr }),
      moyenne: inMonth.length
        ? Math.round((inMonth.reduce((s, r) => s + (r.overall_score ?? 0), 0) / inMonth.length) * 10) / 10
        : null,
      reponses: inMonth.length,
    }
  })
}

export function groupAverage(
  responses: SurveyResponse[],
  key: (r: SurveyResponse) => string | null | undefined
) {
  const map = new Map<string, { sum: number; count: number }>()
  for (const r of responses) {
    if (r.overall_score === null) continue
    const k = key(r) ?? 'Non renseigné'
    const e = map.get(k) ?? { sum: 0, count: 0 }
    e.sum += r.overall_score
    e.count += 1
    map.set(k, e)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, avg: v.sum / v.count }))
    .sort((a, b) => b.count - a.count)
}

/** Compte les motifs d'insatisfaction choisis dans les réponses multi_choice. */
export function topDissatisfactionReasons(
  responses: SurveyResponse[],
  motifQuestionIds: string[]
): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of responses) {
    for (const qid of motifQuestionIds) {
      const val = r.answers?.[qid]
      const arr = Array.isArray(val) ? val : typeof val === 'string' ? [val] : []
      for (const item of arr) {
        const label = String(item)
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}
