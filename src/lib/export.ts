import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SurveyResponse } from './types'
import { formatDateTime, formatScore } from './format'

const NAVY: [number, number, number] = [14, 31, 61]
const GOLD: [number, number, number] = [201, 162, 75]

// ---------------------------------------------------------------------------
// Export Excel des réponses
// ---------------------------------------------------------------------------
export function exportResponsesToExcel(responses: SurveyResponse[], filename = 'avis-clients') {
  const rows = responses.map((r) => ({
    'Date': formatDateTime(r.created_at),
    'Client': r.anonymous ? 'Anonyme' : (r.client_name ?? '—'),
    'E-mail': r.anonymous ? '' : (r.client_email ?? ''),
    'Conseiller': r.advisors?.full_name ?? '—',
    'Prestation': r.service_type ?? '—',
    'Questionnaire': r.questionnaires?.title ?? '—',
    'Note globale': r.overall_score ?? '',
    'NPS': r.nps_score ?? '',
    'Commentaire': r.comment ?? '',
    'Statut': r.status,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 24 },
    { wch: 26 }, { wch: 12 }, { wch: 6 }, { wch: 50 }, { wch: 10 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Avis clients')
  XLSX.writeFile(wb, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

// ---------------------------------------------------------------------------
// Rapport PDF professionnel aux couleurs AGAVIC
// ---------------------------------------------------------------------------
export interface ReportData {
  periodLabel: string
  totalResponses: number
  averageScore: number
  nps: number
  csat: number
  participationRate: number | null
  openFollowups: number
  scoreDistribution: { label: string; value: number }[]
  topReasons: { label: string; count: number }[]
  advisorStats: { name: string; count: number; avg: number }[]
  serviceStats: { name: string; count: number; avg: number }[]
}

export function exportReportPdf(data: ReportData) {
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()

  // Bandeau bleu nuit
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 42, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 42, W, 1.6, 'F')

  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(22)
  doc.text('AGAVIC', 14, 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(230, 230, 230)
  doc.text('P A T R I M O I N E', 14, 22)
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('Rapport de satisfaction client', 14, 33)
  doc.setFontSize(9)
  doc.text(`Période : ${data.periodLabel}  —  Généré le ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`, W - 14, 33, { align: 'right' })

  // KPIs
  let y = 54
  doc.setTextColor(...NAVY)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Indicateurs clés', 14, y)

  autoTable(doc, {
    startY: y + 4,
    head: [['Réponses', 'Note moyenne', 'NPS', 'CSAT (≥7)', 'Participation', 'Insatisfactions ouvertes']],
    body: [[
      String(data.totalResponses),
      `${formatScore(data.averageScore)} / 10`,
      `${data.nps > 0 ? '+' : ''}${data.nps}`,
      `${data.csat} %`,
      data.participationRate === null ? '—' : `${data.participationRate} %`,
      String(data.openFollowups),
    ]],
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 10, halign: 'center', textColor: NAVY },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.text('Répartition des notes', 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [['Segment', 'Réponses']],
    body: data.scoreDistribution.map((r) => [r.label, String(r.value)]),
    theme: 'striped',
    headStyles: { fillColor: GOLD, textColor: NAVY },
    margin: { left: 14, right: 14 },
    tableWidth: 85,
  })

  const distY = (doc as any).lastAutoTable.finalY
  autoTable(doc, {
    startY: y + 4,
    head: [['Motif d\'insatisfaction', 'Occurrences']],
    body: data.topReasons.length
      ? data.topReasons.map((r) => [r.label, String(r.count)])
      : [['Aucun motif signalé', '—']],
    theme: 'striped',
    headStyles: { fillColor: GOLD, textColor: NAVY },
    margin: { left: 105, right: 14 },
  })
  y = Math.max(distY, (doc as any).lastAutoTable.finalY) + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Satisfaction par conseiller', 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [['Conseiller', 'Réponses', 'Note moyenne']],
    body: data.advisorStats.map((a) => [a.name, String(a.count), `${formatScore(a.avg)} / 10`]),
    theme: 'striped',
    headStyles: { fillColor: NAVY },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  if (y > 250) { doc.addPage(); y = 20 }
  doc.setFontSize(13)
  doc.text('Satisfaction par type de prestation', 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [['Prestation', 'Réponses', 'Note moyenne']],
    body: data.serviceStats.map((s) => [s.name, String(s.count), `${formatScore(s.avg)} / 10`]),
    theme: 'striped',
    headStyles: { fillColor: NAVY },
    margin: { left: 14, right: 14 },
  })

  // Pied de page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text('AGAVIC Patrimoine — 45 rue de la Bourse, 69002 Lyon — Document interne confidentiel', 14, 292)
    doc.text(`${i} / ${pages}`, W - 14, 292, { align: 'right' })
  }

  doc.save(`rapport-satisfaction-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
