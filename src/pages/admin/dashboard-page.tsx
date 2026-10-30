import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Star, MessageSquare, TrendingUp, AlertTriangle, Gauge, Send, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Advisor, Question, Questionnaire, SurveyResponse } from '@/lib/types'
import {
  averageScore, computeNps, computeCsat, monthlyEvolution,
  detailedDistribution, groupAverage, topDissatisfactionReasons,
} from '@/lib/stats'
import { formatScore, scoreBand } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PIE_COLORS = ['#ef4444', '#f59e0b', '#10b981']
const PERIODS = [
  { v: '30', l: '30 derniers jours' },
  { v: '90', l: '90 derniers jours' },
  { v: '180', l: '6 derniers mois' },
  { v: '365', l: '12 derniers mois' },
  { v: 'all', l: 'Toute la période' },
]

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [motifQuestions, setMotifQuestions] = useState<string[]>([])
  const [openFollowups, setOpenFollowups] = useState(0)
  const [invStats, setInvStats] = useState({ sent: 0, completed: 0 })

  const [period, setPeriod] = useState('180')
  const [advisorFilter, setAdvisorFilter] = useState('all')
  const [qFilter, setQFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const [r, a, q, qq, f, inv] = await Promise.all([
        supabase.from('enquete_satisfaction_survey_responses')
          .select('*, advisors:enquete_satisfaction_advisors(full_name), questionnaires:enquete_satisfaction_questionnaires(title)')
          .order('created_at', { ascending: false }),
        supabase.from('enquete_satisfaction_advisors').select('*').eq('active', true).order('full_name'),
        supabase.from('enquete_satisfaction_questionnaires').select('*').order('title'),
        supabase.from('enquete_satisfaction_questions').select('id, type').eq('type', 'multi_choice'),
        supabase.from('enquete_satisfaction_feedback_followups').select('id', { count: 'exact', head: true })
          .in('status', ['new', 'assigned', 'in_progress']),
        supabase.from('enquete_satisfaction_survey_invitations').select('status'),
      ])
      setResponses((r.data ?? []) as SurveyResponse[])
      setAdvisors((a.data ?? []) as Advisor[])
      setQuestionnaires((q.data ?? []) as Questionnaire[])
      setMotifQuestions(((qq.data ?? []) as Pick<Question, 'id'>[]).map((x) => x.id))
      setOpenFollowups(f.count ?? 0)
      const invs = inv.data ?? []
      setInvStats({
        sent: invs.length,
        completed: invs.filter((i) => i.status === 'completed').length,
      })
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => responses.filter((r) => {
    if (advisorFilter !== 'all' && r.advisor_id !== advisorFilter) return false
    if (qFilter !== 'all' && r.questionnaire_id !== qFilter) return false
    if (period !== 'all') {
      const cutoff = Date.now() - Number(period) * 86400000
      if (new Date(r.created_at).getTime() < cutoff) return false
    }
    return true
  }), [responses, period, advisorFilter, qFilter])

  const stats = useMemo(() => ({
    total: filtered.length,
    avg: averageScore(filtered),
    nps: computeNps(filtered),
    csat: computeCsat(filtered),
    distribution: detailedDistribution(filtered),
    evolution: monthlyEvolution(filtered, 6),
    byAdvisor: groupAverage(filtered, (r) => r.advisors?.full_name),
    reasons: topDissatisfactionReasons(filtered, motifQuestions).slice(0, 6),
    pie: [
      { name: 'Insatisfaits (0-6)', value: filtered.filter((r) => (r.overall_score ?? 10) <= 6).length },
      { name: 'Neutres (7-8)', value: filtered.filter((r) => (r.overall_score ?? 0) === 7 || (r.overall_score ?? 0) === 8).length },
      { name: 'Satisfaits (9-10)', value: filtered.filter((r) => (r.overall_score ?? 0) >= 9).length },
    ],
    participation: invStats.sent ? Math.round((invStats.completed / invStats.sent) * 100) : null,
  }), [filtered, motifQuestions, invStats])

  const latestNegative = useMemo(
    () => filtered.filter((r) => (r.overall_score ?? 10) <= 6).slice(0, 4),
    [filtered]
  )

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tous les conseillers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les conseillers</SelectItem>
            {advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={qFilter} onValueChange={setQFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tous les questionnaires" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les questionnaires</SelectItem>
            {questionnaires.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={<Star className="h-4 w-4" />} label="Note moyenne" value={`${formatScore(stats.avg)}/10`}
          tone={scoreBand(Math.round(stats.avg))} />
        <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Réponses" value={String(stats.total)} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Satisfaction (≥7)" value={`${stats.csat} %`} />
        <Kpi icon={<Gauge className="h-4 w-4" />} label="NPS" value={`${stats.nps > 0 ? '+' : ''}${stats.nps}`} />
        <Kpi icon={<Send className="h-4 w-4" />} label="Participation"
          value={stats.participation === null ? '—' : `${stats.participation} %`} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Insatisfactions" value={String(openFollowups)}
          tone={openFollowups > 0 ? 'low' : 'high'} />
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution de la note moyenne</CardTitle>
            <CardDescription>6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.evolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v === null ? '—' : `${v}/10`, 'Moyenne']} />
                <Line type="monotone" dataKey="moyenne" stroke="#c9a24b" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#c9a24b' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Répartition des notes</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3}>
                  {stats.pie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Distribution détaillée</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.distribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="note" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stats.distribution.map((d) => (
                    <Cell key={d.note}
                      fill={Number(d.note) <= 6 ? '#ef4444' : Number(d.note) <= 8 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Motifs d'insatisfaction</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats.reasons.length === 0 ? (
              <p className="pt-10 text-center text-sm text-muted-foreground">Aucun motif signalé sur la période.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.reasons} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#294370" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Satisfaction par conseiller</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.byAdvisor.length === 0 && (
              <p className="pt-6 text-center text-sm text-muted-foreground">Aucune donnée.</p>
            )}
            {stats.byAdvisor.slice(0, 6).map((a) => (
              <div key={a.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.count} réponse{a.count > 1 ? 's' : ''}</p>
                </div>
                <Badge variant="outline" className={cn('shrink-0',
                  scoreBand(Math.round(a.avg)) === 'low' && 'text-red-600 border-red-300',
                  scoreBand(Math.round(a.avg)) === 'mid' && 'text-amber-600 border-amber-300',
                  scoreBand(Math.round(a.avg)) === 'high' && 'text-emerald-600 border-emerald-300')}>
                  {formatScore(a.avg)}/10
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Derniers avis négatifs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Derniers avis à traiter</CardTitle>
            <CardDescription>Notes inférieures ou égales à 6</CardDescription>
          </div>
          <Link to="/admin/insatisfactions" className="flex items-center gap-1 text-sm text-secondary hover:underline">
            Tout voir <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestNegative.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun avis négatif sur la période. 🎉</p>
          )}
          {latestNegative.map((r) => (
            <Link key={r.id} to="/admin/insatisfactions"
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-500/5 p-3 transition-colors hover:bg-red-500/10 dark:border-red-900/50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-sm font-bold text-red-600">
                {r.overall_score}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {r.anonymous ? 'Client anonyme' : r.client_name ?? 'Client'} — {r.advisors?.full_name ?? 'Non attribué'}
                </p>
                {r.comment && <p className="truncate text-sm text-muted-foreground">« {r.comment} »</p>}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <span className="text-secondary">{icon}</span>
        </div>
        <p className={cn(
          'mt-2 font-serif text-3xl font-bold',
          tone === 'low' && 'text-red-600',
          tone === 'mid' && 'text-amber-600',
          tone === 'high' && 'text-emerald-600'
        )}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-52" /><Skeleton className="h-10 w-56" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}
