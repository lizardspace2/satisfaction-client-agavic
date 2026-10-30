// Types alignés sur supabase/schema.sql

export type AppRole = 'admin' | 'manager' | 'advisor' | 'viewer'
export type QuestionnaireStatus = 'draft' | 'active' | 'archived'
export type QuestionType =
  | 'score_10' | 'stars' | 'nps' | 'single_choice' | 'multi_choice'
  | 'text' | 'yes_no' | 'date' | 'email' | 'dropdown' | 'message'
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'paused'
export type InvitationStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'expired'
export type ResponseStatus = 'new' | 'read' | 'archived'
export type FollowupStatus = 'new' | 'assigned' | 'in_progress' | 'resolved'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: AppRole
  active: boolean
  created_at: string
}

export interface Advisor {
  id: string
  profile_id: string | null
  full_name: string
  email: string
  position: string | null
  active: boolean
  created_at: string
}

export interface QuestionnaireSettings {
  anonymous?: boolean
  google_review_url?: string
  estimated_minutes?: string
  welcome_title?: string
  welcome_text?: string
  service_types?: string[]
  collect_identity?: boolean
}

export interface Questionnaire {
  id: string
  title: string
  description: string | null
  slug: string
  status: QuestionnaireStatus
  settings: QuestionnaireSettings
  created_at: string
  updated_at: string
}

export interface ConditionRule {
  question_id: string
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains'
  value: number | string
}

export interface QuestionConditions {
  combinator?: 'and' | 'or'
  rules?: ConditionRule[]
}

export interface QuestionOptions {
  role?: 'overall' | 'nps' | 'comment'
  choices?: string[]
  min_label?: string
  max_label?: string
  placeholder?: string
  max_length?: number
  variant?: 'empathy' | 'neutral' | 'positive'
}

export interface Question {
  id: string
  questionnaire_id: string
  title: string
  description: string | null
  type: QuestionType
  options: QuestionOptions
  conditions: QuestionConditions
  required: boolean
  position: number
  created_at: string
}

export interface Campaign {
  id: string
  questionnaire_id: string
  name: string
  status: CampaignStatus
  channel: string
  goal_responses: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  questionnaires?: { title: string; slug: string }
}

export interface SurveyInvitation {
  id: string
  campaign_id: string | null
  questionnaire_id: string
  advisor_id: string | null
  service_type: string | null
  secure_token: string
  recipient_name: string | null
  recipient_email: string | null
  status: InvitationStatus
  sent_at: string | null
  opened_at: string | null
  completed_at: string | null
  created_at: string
  advisors?: { full_name: string } | null
}

export interface SurveyResponse {
  id: string
  questionnaire_id: string
  invitation_id: string | null
  advisor_id: string | null
  service_type: string | null
  client_name: string | null
  client_email: string | null
  overall_score: number | null
  nps_score: number | null
  anonymous: boolean
  answers: Record<string, unknown>
  comment: string | null
  status: ResponseStatus
  duration_seconds: number | null
  created_at: string
  advisors?: { full_name: string } | null
  questionnaires?: { title: string } | null
}

export interface FeedbackFollowup {
  id: string
  response_id: string
  assigned_to: string | null
  status: FollowupStatus
  internal_note: string | null
  resolved_at: string | null
  created_at: string
  survey_responses?: SurveyResponse | null
  advisors?: { full_name: string } | null
}

export interface FollowupEvent {
  id: string
  followup_id: string
  user_id: string | null
  action: string
  note: string | null
  created_at: string
  profiles?: { full_name: string } | null
}

export interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  profiles?: { full_name: string } | null
}

export interface CabinetSettings {
  company_name?: string
  address?: string
  phone?: string
  email?: string
  google_review_url?: string
  satisfaction_threshold?: number
  anonymous_allowed?: boolean
  retention_months?: number
  notify_low_score?: boolean
  notify_manager_delay_hours?: number
  weekly_digest?: boolean
  monthly_report?: boolean
  legal_notice?: string
  privacy_policy?: string
}

export interface InvitationContext {
  invitation_id: string
  questionnaire_id: string
  advisor_id: string | null
  advisor_name: string | null
  service_type: string | null
  recipient_name: string | null
  recipient_email: string | null
  completed: boolean
}

export type AnswerValue = number | string | string[] | boolean | null
export type AnswersMap = Record<string, AnswerValue>
