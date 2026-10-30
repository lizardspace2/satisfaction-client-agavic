import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/use-auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { SetupScreen } from '@/components/setup-screen'
import LandingPage from '@/pages/landing'
import SurveyPage from '@/pages/survey/survey-page'
import LoginPage from '@/pages/auth/login-page'
import AdminLayout from '@/components/layout/admin-layout'
import DashboardPage from '@/pages/admin/dashboard-page'
import ResponsesPage from '@/pages/admin/responses-page'
import FollowupsPage from '@/pages/admin/followups-page'
import QuestionnairesPage from '@/pages/admin/questionnaires-page'
import QuestionnaireEditorPage from '@/pages/admin/questionnaire-editor-page'
import CampaignsPage from '@/pages/admin/campaigns-page'
import AdvisorsPage from '@/pages/admin/advisors-page'
import ReportsPage from '@/pages/admin/reports-page'
import SettingsPage from '@/pages/admin/settings-page'
import AuditPage from '@/pages/admin/audit-page'
import NotFoundPage from '@/pages/not-found'

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/avis/:slug" element={<SurveyPage />} />
          <Route path="/avis/:slug/:token" element={<SurveyPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="avis" element={<ResponsesPage />} />
            <Route path="insatisfactions" element={<FollowupsPage />} />
            <Route path="questionnaires" element={<QuestionnairesPage />} />
            <Route path="questionnaires/:id" element={<QuestionnaireEditorPage />} />
            <Route path="campagnes" element={<CampaignsPage />} />
            <Route path="conseillers" element={<AdvisorsPage />} />
            <Route path="rapports" element={<ReportsPage />} />
            <Route path="journal" element={<AuditPage />} />
            <Route path="parametres" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  )
}
