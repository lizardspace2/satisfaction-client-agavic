import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, AlertTriangle, ClipboardList, Megaphone,
  Users, BarChart3, Settings, LogOut, Menu, X, Bell, ScrollText, CheckCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { AgavicLogo } from '@/components/agavic-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ROLE_LABELS, timeAgo } from '@/lib/format'
import type { AppNotification } from '@/lib/types'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/admin/avis', icon: MessageSquare, label: 'Avis clients' },
  { to: '/admin/insatisfactions', icon: AlertTriangle, label: 'Insatisfactions' },
  { to: '/admin/questionnaires', icon: ClipboardList, label: 'Questionnaires' },
  { to: '/admin/campagnes', icon: Megaphone, label: 'Campagnes' },
  { to: '/admin/conseillers', icon: Users, label: 'Conseillers' },
  { to: '/admin/rapports', icon: BarChart3, label: 'Rapports' },
  { to: '/admin/journal', icon: ScrollText, label: 'Journal' },
  { to: '/admin/parametres', icon: Settings, label: 'Paramètres', adminOnly: true },
]

export default function AdminLayout() {
  const { session, profile, loading, signOut, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-10 w-10 rounded-xl" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    )
  }
  if (!session) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="font-serif text-xl font-semibold">Compte non provisionné</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre compte existe dans l'authentification mais n'a pas de profil applicatif.
            Ajoutez une ligne dans la table <code>profiles</code> (voir README).
          </p>
          <Button variant="outline" className="mt-4" onClick={signOut}>Se déconnecter</Button>
        </div>
      </div>
    )
  }

  const initials = profile.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col navy-gradient text-white transition-transform lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between p-5">
          <AgavicLogo light />
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-gold-500/20 text-gold-300' : 'text-navy-200 hover:bg-white/10 hover:text-white'
              )}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-gold-300">{ROLE_LABELS[profile.role]}</p>
            </div>
            <button onClick={signOut} title="Se déconnecter" className="text-navy-300 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <PageTitle pathname={location.pathname} />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationsBell userId={profile.id} onNavigate={(l) => navigate(l)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1"><Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{profile.full_name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{profile.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}><LogOut /> Se déconnecter</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function PageTitle({ pathname }: { pathname: string }) {
  const item = [...NAV].sort((a, b) => b.to.length - a.to.length)
    .find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
  return <h1 className="font-serif text-lg font-semibold sm:text-xl">{item?.label ?? 'Administration'}</h1>
}

function NotificationsBell({ userId, onNavigate }: { userId: string; onNavigate: (l: string) => void }) {
  const [items, setItems] = useState<AppNotification[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.from('enquete_satisfaction_notifications')
        .select('*').eq('user_id', userId).is('read_at', null)
        .order('created_at', { ascending: false }).limit(20)
      if (mounted) setItems((data ?? []) as AppNotification[])
    }
    load()
    const ch = supabase.channel('notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enquete_satisfaction_notifications', filter: `user_id=eq.${userId}` },
        (p) => setItems((prev) => [p.new as AppNotification, ...prev]))
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [userId])

  async function markAllRead() {
    const ids = items.map((n) => n.id)
    if (!ids.length) return
    await supabase.from('enquete_satisfaction_notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    setItems([])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {items.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {items.length > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Aucune notification</p>
          ) : items.map((n) => (
            <button key={n.id} onClick={() => n.link && onNavigate(n.link)}
              className="block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-muted/50">
              <p className="text-sm font-medium">{n.title}</p>
              {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
              <Badge variant="muted" className="mt-1.5">{timeAgo(n.created_at)}</Badge>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
