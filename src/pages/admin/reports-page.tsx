import { useEffect, useMemo, useState } from 'react'
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { subDays } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Advisor, Question, SurveyResponse } from '@/lib/types'
import {
  averageScore, computeNps, computeCsat, scoreDistribution,
  groupAverage, topDissatisfactionReasons, monthlyEvolution,
} from '@/lib/stats'
import { exportReportPdf, exportResponsesToExcel } from '@/lib/export'
import { formatScore } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [motifQuestions, setMotifQuestions] = useState<string[]>([])
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [days, setDays] = useState(90)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      const [r, q, a] = await Promise.all([
        supabase.from('enquete_satisfaction_survey_responses').select('*, advisors:enquete_satisfaction_advisors(full_name)').order('created_at'),
        supabase.from('enquete_satisfaction_questions').select('id, type').eq('type', 'multi_choice'),
        supabase.from('enquete_satisfaction_advisors').select('*').order('full_name'),
      ])
      setResponses((r.data ?? []) as SurveyResponse[])
      setMotifQuestions(((q.data ?? []) as Pick<Question, 'id' | 'type'>[]).map((x) => x.id))
      setAdvisors((a.data ?? []) as Advisor[])
      setLoading(false)
    }
    load()
  }, [])

  const cutoff = useMemo(() => subDays(new Date(), days), [days])
  const prevCutoff = useMemo(() => subDays(new Date(), days * 2), [days])

  const current = useMemo(() => responses.filter((r) => new Date(r.created_at) >= cutoff), [responses, cutoff])
  const previous = useMemo(
    () => responses.filter((r) => { const d = new Date(r.created_at); return d >= prevCutoff && d < cutoff }),
    [responses, cutoff, prevCutoff]
  )

  const data = useMemo(() => ({
    current: {
      total: current.length,
      avg: averageScore(current),
      nps: computeNps(current),
      csat: computeCsat(current),
    },
    previous: {
      total: previous.length,
      avg: averageScore(previous),
      nps: computeNps(previous),
      csat: computeCsat(previous),
    },
    evolution: monthlyEvolution(current, Math.min(6, Math.max(2, Math.ceil(days / 30)))),
    dist: scoreDistribution(current),
    reasons: topDissatisfactionReasons(current, motifQuestions).slice(0, 8),
    byAdvisor: groupAverage(current, (r) => r.advisors?.full_name),
    byService: groupAverage(current, (r) => r.service_type),
  }), [current, previous, days, motifQuestions])

  function delta(now: number, prev: number, suffix = '') {
    const d = now - prev
    const sign = d > 0 ? '+' : ''
    return `${sign}${suffix === ' %' ? Math.round(d) : Math.round(d * 10) / 10}${suffix}`
  }

  async function exportPdf() {
    setExporting(true)
    const { count: open } = await supabase.from('enquete_satisfaction_feedback_followups')
      .select('id', { count: 'exact', head: true }).in('status', ['new', 'assigned', 'in_progress'])
    exportReportPdf({
      periodLabel: `${days} derniers jours`,
      totalResponses: data.current.total,
      averageScore: data.current.avg,
      nps: data.current.nps,
      csat: data.current.csat,
      participationRate: null,
      openFollowups: open ?? 0,
      scoreDistribution: data.dist.map((d) => ({ label: d.label, value: d.value })),
      topReasons: data.reasons.map((r) => ({ label: r.label, count: r.count })),
      advisorStats: data.byAdvisor.map((a) => ({ name: a.name, count: a.count, avg: a.avg })),
      serviceStats: data.byService.map((s) => ({ name: s.name, count: s.count, avg: s.avg })),
    })
    setExporting(false)
    toast.success('Rapport PDF généré')
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-72" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
            <SelectItem value="180">6 derniers mois</SelectItem>
            <SelectItem value="365">12 derniers mois</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportResponsesToExcel(current, 'rapport-avis')}>
            <FileSpreadsheet /> Export Excel
          </Button>
          <Button variant="gold" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />} Rapport PDF
          </Button>
        </div>
      </div>

      {/* Comparaison de périodes */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Réponses', now: data.current.total, prev: data.previous.total, fmt: (v: number) => String(v), suffix: '' },
          { label: 'Note moyenne', now: data.current.avg, prev: data.previous.avg, fmt: (v: number) => `${formatScore(v)}/10`, suffix: ' pts' },
          { label: 'NPS', now: data.current.nps, prev: data.previous.nps, fmt: (v: number) => String(Math.round(v)), suffix: ' pts' },
          { label: 'CSAT (≥7)', now: data.current.csat, prev: data.previous.csat, fmt: (v: number) => `${v} %`, suffix: ' %' },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-1 font-serif text-3xl font-bold">{k.fmt(k.now)}</p>
              <p className={cn('mt-1 text-xs font-medium',
                k.now >= k.prev ? 'text-emerald-600' : 'text-red-600')}>
                {delta(k.now, k.prev, k.suffix)} vs période précédente ({k.fmt(k.prev)})
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution de la satisfaction</CardTitle>
          <CardDescription>Note moyenne et volume de réponses par mois</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.evolution}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="moyenne" name="Note moyenne" stroke="#c9a24b" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="reponses" name="Réponses" stroke="#294370" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Par conseiller</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Conseiller</th><th className="pb-2 text-right">Réponses</th><th className="pb-2 text-right">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {data.byAdvisor.map((a) => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="py-2.5 font-medium">{a.name}</td>
                    <td className="py-2.5 text-right">{a.count}</td>
                    <td className={cn('py-2.5 text-right font-semibold',
                      a.avg <= 6 ? 'text-red-600' : a.avg <= 8 ? 'text-amber-600' : 'text-emerald-600')}>
                      {formatScore(a.avg)}/10
                    </td>
                  </tr>
                ))}
                {data.byAdvisor.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Aucune donnée</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Par type de prestation</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Prestation</th><th className="pb-2 text-right">Réponses</th><th className="pb-2 text-right">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {data.byService.map((s) => (
                  <tr key={s.name} className="border-b last:border-0">
                    <td className="py-2.5 font-medium">{s.name}</td>
                    <td className="py-2.5 text-right">{s.count}</td>
                    <td className={cn('py-2.5 text-right font-semibold',
                      s.avg <= 6 ? 'text-red-600' : s.avg <= 8 ? 'text-amber-600' : 'text-emerald-600')}>
                      {formatScore(s.avg)}/10
                    </td>
                  </tr>
                ))}
                {data.byService.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Aucune donnée</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Répartition des notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.dist.map((d, i) => {
              const pct = data.current.total ? Math.round((d.value / data.current.total) * 100) : 0
              return (
                <div key={d.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{d.label}</span><span className="font-semibold">{d.value} ({pct} %)</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: ['#ef4444', '#f59e0b', '#10b981'][i] }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Principaux motifs d'insatisfaction</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.reasons.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun motif signalé.</p>}
            {data.reasons.map((r) => {
              const max = data.reasons[0]?.count ?? 1
              return (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{r.label}</span><span className="font-semibold">{r.count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-navy-700 transition-all" style={{ width: `${(r.count / max) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Conseillers référencés : {advisors.length}</p>
    </div>
  )
}
