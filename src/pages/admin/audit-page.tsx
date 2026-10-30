import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuditLog } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ACTION_LABELS: Record<string, string> = {
  'questionnaire.create': 'Création de questionnaire',
  'questionnaire.update': 'Modification de questionnaire',
  'questionnaire.duplicate': 'Duplication de questionnaire',
  'questionnaire.delete': 'Suppression de questionnaire',
  'questionnaire.active': 'Activation de questionnaire',
  'questionnaire.archived': 'Archivage de questionnaire',
  'campaign.create': 'Création de campagne',
  'campaign.active': 'Activation de campagne',
  'campaign.paused': 'Campagne mise en pause',
  'campaign.completed': 'Campagne terminée',
  'invitations.generate': 'Génération de liens',
  'advisor.create': 'Ajout de conseiller',
  'advisor.update': 'Modification de conseiller',
  'advisor.activate': 'Activation de conseiller',
  'advisor.deactivate': 'Désactivation de conseiller',
  'response.read': 'Réponse marquée lue',
  'response.archived': 'Réponse archivée',
  'response.delete': 'Suppression de réponse',
  'followup.status_change': 'Changement de statut du suivi',
  'followup.assigned': 'Affectation du suivi',
  'followup.note': 'Note interne ajoutée',
  'followup.resolved': 'Insatisfaction traitée',
  'settings.update': 'Paramètres modifiés',
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    supabase.from('enquete_satisfaction_audit_logs')
      .select('*, profiles:enquete_satisfaction_profiles(full_name)')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setLogs((data ?? []) as AuditLog[]); setLoading(false) })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal des actions administratives</CardTitle>
        <CardDescription>Traçabilité des opérations sensibles (200 dernières entrées).</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead><TableHead>Objet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(l.created_at)}</TableCell>
                  <TableCell className="text-sm">{l.profiles?.full_name ?? 'Système'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACTION_LABELS[l.action] ?? l.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.entity_type ?? '—'}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}…` : ''}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Aucune entrée.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
