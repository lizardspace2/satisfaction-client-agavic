import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return format(new Date(d), 'dd MMM yyyy', { locale: fr })
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return format(new Date(d), 'dd MMM yyyy à HH:mm', { locale: fr })
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr })
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—'
  return score.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

// Code couleur : rouge 0-6, orange 7-8, vert 9-10
export function scoreBand(score: number | null | undefined): 'low' | 'mid' | 'high' | 'none' {
  if (score === null || score === undefined) return 'none'
  if (score <= 6) return 'low'
  if (score <= 8) return 'mid'
  return 'high'
}

export function scoreBadgeClass(score: number | null | undefined): string {
  switch (scoreBand(score)) {
    case 'low':  return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
    case 'mid':  return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
    case 'high': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
    default:     return 'bg-muted text-muted-foreground'
  }
}

export const FOLLOWUP_STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle',
  assigned: 'Affectée',
  in_progress: 'En cours',
  resolved: 'Traitée',
}

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  sent: 'Envoyée',
  opened: 'Ouverte',
  completed: 'Terminée',
  expired: 'Expirée',
}

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  score_10: 'Note de 0 à 10',
  stars: 'Étoiles (1-5)',
  nps: 'Question NPS',
  single_choice: 'Choix unique',
  multi_choice: 'Choix multiples',
  text: 'Texte libre',
  yes_no: 'Oui / Non',
  date: 'Date',
  email: 'E-mail',
  dropdown: 'Liste déroulante',
  message: 'Message / écran info',
}

export const QUESTIONNAIRE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Responsable',
  advisor: 'Conseiller',
  viewer: 'Lecteur',
}
