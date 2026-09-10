import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, Check, ChevronRight, Clock3, Heart, Home, Menu, Moon, Plus, RefreshCw, Settings2, Sparkles, Trash2, Wifi, X, Zap } from 'lucide-react'
import { supabase, supabaseConfigError } from './lib/supabase'
import './App.css'

type Category = 'fun' | 'romantique' | 'defi' | 'surprise'
type ContentKind = 'action' | 'scenario'
type Action = { id: string; title: string; description: string; category: Category; kind: ContentKind; isTemplate?: boolean; createdAt: string }
type Trigger = { id: string; actionId: string; actionTitle: string; time: string; partner: string }
type Schedule = { id: string; label: string; start: string; end: string; days: string[]; active: boolean }
type Partner = { id: string; name: string; email: string }
type Couple = { id: string; name: string; joinCode: string | null }
type SessionUser = { id: string; email?: string }
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const demoActions: Action[] = [
  { id: 'demo-1', title: 'Danse dans le salon', description: 'Lancez une chanson au hasard et dansez ensemble.', category: 'fun', kind: 'action', isTemplate: false, createdAt: '2026-09-08' },
  { id: 'demo-2', title: 'Le mot doux inattendu', description: 'Écrivez trois choses que vous aimez chez l’autre.', category: 'romantique', kind: 'action', isTemplate: false, createdAt: '2026-09-07' },
  { id: 'demo-3', title: 'Changer de chemin', description: 'Prenez une rue que vous ne connaissez pas.', category: 'surprise', kind: 'scenario', isTemplate: false, createdAt: '2026-09-06' },
]
const demoSchedules: Schedule[] = [
  { id: 'demo-s1', label: 'Matin doux', start: '08:00', end: '10:30', days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'], active: true },
  { id: 'demo-s2', label: 'Pause de midi', start: '12:00', end: '14:00', days: ['Lun', 'Mer', 'Ven'], active: true },
]
const categoryLabels: Record<Category, string> = { fun: 'Fun', romantique: 'Romantique', defi: 'Défi', surprise: 'Surprise' }
const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : initial
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

function daysToLabels(days: number[] | null) { return (days || []).map((day) => dayLabels[day] || '').filter(Boolean) }
function formatTime(value: string) { return value.slice(0, 5) }

function useThemeControl() {
  const [dark, setDark] = useState(() => localStorage.getItem('btr-theme') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', dark)
    localStorage.setItem('btr-theme', dark ? 'dark' : 'light')
    const button = document.createElement('button')
    button.className = 'theme-toggle-floating'
    button.type = 'button'
    button.setAttribute('aria-label', dark ? 'Activer le thème rose' : 'Activer le thème sombre')
    button.textContent = dark ? 'Thème rose' : 'Thème sombre'
    button.addEventListener('click', () => setDark((current) => !current))
    document.body.append(button)
    return () => button.remove()
  }, [dark])
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useThemeControl()
  useEffect(() => {
    let deferred: InstallPrompt | null = null
    const button = document.createElement('button')
    button.className = 'install-pwa-button'
    button.textContent = 'Installer l’application'
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const update = () => { button.hidden = standalone() }
    const capture = (event: Event) => { event.preventDefault(); deferred = event as InstallPrompt }
    const install = async () => { if (!deferred) { alert('Ouvrez le menu du navigateur puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».'); return }; await deferred.prompt(); await deferred.userChoice; deferred = null }
    button.addEventListener('click', install); addEventListener('beforeinstallprompt', capture); addEventListener('appinstalled', update); document.body.append(button); update()
    return () => { button.removeEventListener('click', install); removeEventListener('beforeinstallprompt', capture); button.remove() }
  }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true)
    if (!supabase) { setError(supabaseConfigError || 'Supabase est indisponible.'); setLoading(false); return }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name: name || 'Partenaire' } } })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else if (result.data.user) {
      if (mode === 'signup' && joinCode.trim()) {
        const { error: joinError } = await supabase.rpc('join_couple_by_code', { p_join_code: joinCode, p_name: name || 'Partenaire' })
        if (joinError) { setError(joinError.message); return }
      }
      onAuthenticated({ id: result.data.user.id, email: result.data.user.email })
    }
  }
  return <div className="auth-screen"><div className="auth-glow" /><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><Moon size={19} fill="currentColor" /></div><div><strong>Break The</strong><span>Routine</span></div></div><p className="eyebrow">VOTRE ESPACE PRIVÉ</p><h1>{mode === 'login' ? 'Bienvenue à nouveau.' : 'Créez votre duo.'}</h1><p className="auth-copy">Un espace partagé où toutes vos idées restent anonymes.</p><form onSubmit={submit}>{mode === 'signup' && <><label>Votre prénom<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Élodie" /></label><label>Code du couple <small>(facultatif pour rejoindre un espace existant)</small><input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Ex. 4A8F2C1D" maxLength={8} /></label></>}<label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Mot de passe<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={loading}>{loading ? 'Connexion...' : mode === 'login' ? 'Entrer dans mon espace' : 'Créer mon espace'}</button></form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}</button></div></div>
}

function AppShell({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const location = useLocation(); const navigate = useNavigate(); const remote = Boolean(supabase && user.id !== 'demo-user')
  const [actions, setActions] = useStored<Action[]>(`btr-actions-${user.id}`, remote ? [] : demoActions)
  const [triggers, setTriggers] = useStored<Trigger[]>(`btr-triggers-${user.id}`, remote ? [] : [])
  const [schedules, setSchedules] = useStored<Schedule[]>(`btr-schedules-${user.id}`, remote ? [] : demoSchedules)
  const [couple, setCouple] = useState<Couple | null>(null); const [partners, setPartners] = useState<Partner[]>([])
  const [coupleId, setCoupleId] = useState<string | null>(null); const [showAdd, setShowAdd] = useState(false); const [toast, setToast] = useState<string | null>(null); const [online, setOnline] = useState(navigator.onLine)
  useThemeControl()

  const loadSharedData = useCallback(async (client: NonNullable<typeof supabase>) => {
    const { data: membership } = await client.from('partners').select('couple_id').eq('id', user.id).single()
    if (!membership) return
    setCoupleId(membership.couple_id)
    const [{ data: coupleData }, { data: partnerData }, { data: remoteActions }, { data: remoteTriggers }, { data: remoteSchedules }] = await Promise.all([
      client.from('couples').select('id,name,join_code').eq('id', membership.couple_id).single(),
      client.from('partners').select('id,name,email').eq('couple_id', membership.couple_id).order('created_at'),
      client.from('actions').select('id,title,description,category,kind,is_template,created_at').eq('couple_id', membership.couple_id).eq('created_by_partner_id', user.id).order('created_at', { ascending: false }),
      client.from('triggers').select('id,action_id,triggered_at,delivered_to_partner_id,actions(title)').order('triggered_at', { ascending: false }),
      client.from('schedules').select('id,start_hour,end_hour,days_of_week,active').eq('couple_id', membership.couple_id).order('start_hour'),
    ])
    if (coupleData) setCouple({ id: coupleData.id, name: coupleData.name, joinCode: coupleData.join_code })
    if (partnerData) setPartners(partnerData)
    if (remoteActions) setActions(remoteActions.map((item) => ({ id: item.id, title: item.title, description: item.description, category: item.category as Category, kind: (item.kind || 'action') as ContentKind, isTemplate: item.is_template, createdAt: item.created_at })))
    if (remoteTriggers) setTriggers(remoteTriggers.map((item) => { const relation = Array.isArray(item.actions) ? item.actions[0] : item.actions; return { id: item.id, actionId: item.action_id, actionTitle: relation?.title || 'Action surprise', time: new Date(item.triggered_at).toLocaleString('fr-FR'), partner: partnerData?.find((person) => person.id === item.delivered_to_partner_id)?.name || 'Votre partenaire' } }))
    if (remoteSchedules) setSchedules(remoteSchedules.map((item) => ({ id: item.id, label: `Plage ${formatTime(item.start_hour)} - ${formatTime(item.end_hour)}`, start: formatTime(item.start_hour), end: formatTime(item.end_hour), days: daysToLabels(item.days_of_week), active: item.active })))
  }, [setActions, setSchedules, setTriggers, user.id])

  useEffect(() => { const update = () => setOnline(navigator.onLine); addEventListener('online', update); addEventListener('offline', update); return () => { removeEventListener('online', update); removeEventListener('offline', update) } }, [])
  useEffect(() => {
    const row = document.querySelector('.welcome-row')
    if (!row || row.querySelector('.scenario-add-button')) return
    const button = document.createElement('button')
    button.className = 'secondary-button scenario-add-button'
    button.innerHTML = '<span aria-hidden="true">✦</span> Ajouter un scénario'
    button.addEventListener('click', () => { setShowAdd(true); window.setTimeout(() => (document.querySelector('.kind-choice button:nth-child(2)') as HTMLButtonElement | null)?.click(), 0) })
    row.querySelector('.primary-button')?.parentElement?.append(button)
    return () => button.remove()
  }, [location.pathname])
  useEffect(() => {
    const button = document.querySelector('.mobile-menu')
    const shell = document.querySelector('.app-shell')
    if (!button || !shell) return
    const toggleMenu = () => shell.classList.toggle('menu-open')
    button.addEventListener('click', toggleMenu)
    return () => button.removeEventListener('click', toggleMenu)
  }, [])
  useEffect(() => {
    document.querySelectorAll('.nav-item[href="/horaires"] span').forEach((item) => { item.textContent = 'Scénarios' })
  }, [])
  useEffect(() => {
    const card = document.querySelector('.couple-card')
    if (!card || card.querySelector('.join-code-button')) return
    const button = document.createElement('button')
    button.className = 'join-code-button'
    button.type = 'button'
    button.textContent = 'Voir le code de liaison'
    button.addEventListener('click', async () => {
      const code = couple?.joinCode || 'indisponible'
      if (couple?.joinCode && navigator.clipboard) await navigator.clipboard.writeText(couple.joinCode)
      setToast(`Code de liaison : ${code}`)
      window.setTimeout(() => setToast(null), 4200)
    })
    card.append(button)
    return () => button.remove()
  }, [couple?.joinCode])
  useEffect(() => {
    let deferred: InstallPrompt | null = null
    const button = document.createElement('button')
    button.className = 'install-pwa-button'
    button.textContent = 'Installer l’application'
    button.hidden = false
    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const update = () => { button.hidden = isStandalone() }
    const capture = (event: Event) => { event.preventDefault(); deferred = event as InstallPrompt; update() }
    const install = async () => { if (!deferred) { alert('Pour installer Break The Routine, ouvrez le menu de votre navigateur puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».'); return }; await deferred.prompt(); await deferred.userChoice; deferred = null; update() }
    button.addEventListener('click', install)
    addEventListener('beforeinstallprompt', capture)
    addEventListener('appinstalled', () => { deferred = null; update() })
    document.body.append(button)
    update()
    return () => { button.removeEventListener('click', install); removeEventListener('beforeinstallprompt', capture); button.remove() }
  }, [])
  useEffect(() => {
    const client = supabase
    if (!client || user.id === 'demo-user') return
    void loadSharedData(client)
    const channel = client.channel(`shared-couple-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, () => void loadSharedData(client)).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'triggers' }, async (payload) => { const inserted = payload.new as { action_id?: string; delivered_to_partner_id?: string }; void loadSharedData(client); if (inserted.delivered_to_partner_id !== user.id || !inserted.action_id) return; const { data: action } = await client.from('actions').select('title,kind').eq('id', inserted.action_id).single(); if (action) { setToast(`Nouveau ${action.kind === 'scenario' ? 'scénario' : 'action'} : ${action.title}`); window.setTimeout(() => setToast(null), 5000) } }).on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, () => void loadSharedData(client)).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [loadSharedData, user.id])

  const triggerAction = useCallback(async (action = actions[Math.floor(Math.random() * actions.length)]) => {
    if (!action) return
    const recipient = partners[Math.floor(Math.random() * partners.length)]
    const trigger: Trigger = { id: crypto.randomUUID(), actionId: action.id, actionTitle: action.title, time: 'À l’instant', partner: recipient?.name || 'Votre partenaire' }
    setTriggers((current) => [trigger, ...current]); setToast(`${action.title} · ${trigger.partner}`); setTimeout(() => setToast(null), 4200)
    if (supabase && coupleId) await supabase.from('triggers').insert({ action_id: action.id, delivered_to_partner_id: recipient?.id || user.id })
  }, [actions, coupleId, partners, setTriggers, user.id])

  useEffect(() => { const timer = window.setInterval(() => { const hour = new Date().getHours(); if (schedules.some((item) => item.active && hour >= Number(item.start.slice(0, 2)) && hour < Number(item.end.slice(0, 2))) && Math.random() > .65) void triggerAction() }, 30000); return () => clearInterval(timer) }, [schedules, triggerAction])

  const addAction = async (draft: Omit<Action, 'id' | 'createdAt' | 'isTemplate'>) => { let saved: Action = { ...draft, isTemplate: false, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; if (supabase && coupleId) { const { data } = await supabase.from('actions').insert({ couple_id: coupleId, is_template: false, ...draft }).select('id,created_at').single(); if (data) saved = { ...saved, id: data.id, createdAt: data.created_at } } setActions((current) => [saved, ...current]); setShowAdd(false); setToast(draft.kind === 'scenario' ? 'Nouveau scénario ajouté' : 'Nouvelle action ajoutée') }
  const editAction = async (action: Action) => { const title = window.prompt('Modifier le titre', action.title); if (!title?.trim()) return; const description = window.prompt('Modifier la description', action.description) ?? action.description; const updated = { ...action, title: title.trim(), description }; if (supabase) await supabase.from('actions').update({ title: updated.title, description: updated.description, category: updated.category, kind: updated.kind }).eq('id', action.id).eq('created_by_partner_id', user.id); setActions((current) => current.map((item) => item.id === action.id ? updated : item)); setToast('Élément modifié') }
  const toggleSchedule = async (schedule: Schedule) => { setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, active: !item.active } : item)); if (supabase) await supabase.from('schedules').update({ active: !schedule.active }).eq('id', schedule.id) }
  const coupleTitle = couple?.name || partners.map((partner) => partner.name).join(' & ') || 'Votre espace partagé'

 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Moon size={19} fill="currentColor" /></div><div><strong>Break The</strong><span>Routine</span></div></div><div className="couple-card"><div className="avatar-pair">{partners.slice(0, 2).map((partner) => <span key={partner.id}>{partner.name.charAt(0).toUpperCase()}</span>)}</div><div><strong>{coupleTitle}</strong><small>{partners.length} partenaire{partners.length > 1 ? 's' : ''} connecté{partners.length > 1 ? 's' : ''}</small></div><ChevronRight size={15} /></div><nav className="nav-list"><p className="nav-label">Espace duo</p><NavItem to="/" icon={<Home size={18} />} label="Accueil" /><NavItem to="/actions" icon={<Sparkles size={18} />} label="Actions" count={actions.length} /><NavItem to="/horaires" icon={<Clock3 size={18} />} label="Horaires" /><NavItem to="/historique" icon={<CalendarDays size={18} />} label="Historique" /></nav><div className="sidebar-bottom"><div className="sync-status"><span className={`status-dot ${online ? '' : 'offline'}`} /><span>{online ? 'Synchronisé' : 'Mode hors-ligne'}</span></div><button className="icon-button" aria-label="Réglages"><Settings2 size={17} /></button></div></aside><main className="main-content"><header className="topbar"><button className="mobile-menu icon-button"><Menu size={20} /></button><div className="breadcrumb">Ton espace <span>/</span> <strong>{getPageName(location.pathname)}</strong></div><div className="top-actions"><div className="online-pill"><Wifi size={14} /> {online ? 'En ligne' : 'Hors-ligne'}</div><button className="notification-button" onClick={() => navigate('/historique')} aria-label="Historique"><Bell size={19} /><span /></button><button className="profile-mini" onClick={onSignOut} title={user.email}> {partners.find((partner) => partner.id === user.id)?.name.charAt(0) || '•'} </button></div></header><div className="page-wrap"><Routes><Route path="/" element={<Dashboard actions={actions} triggers={triggers} schedules={schedules} couple={couple} partners={partners} onTrigger={() => void triggerAction()} onAdd={() => setShowAdd(true)} />} /><Route path="/actions" element={<ActionsPage actions={actions} onAdd={() => setShowAdd(true)} onDelete={(id) => { setActions((current) => current.filter((item) => item.id !== id)); if (supabase) void supabase.from('actions').delete().eq('id', id) }} onEdit={editAction} />} /><Route path="/horaires" element={<SchedulesPage schedules={schedules} onToggle={toggleSchedule} />} /><Route path="/historique" element={<HistoryPage triggers={triggers} />} /></Routes></div></main>{showAdd && <AddActionModal onClose={() => setShowAdd(false)} onSave={addAction} />}{toast && <div className="toast"><div className="toast-icon"><Zap size={17} fill="currentColor" /></div><div><small>Nouveau déclenchement</small><strong>{toast}</strong></div><button onClick={() => setToast(null)}><X size={16} /></button></div>}</div>
}

function NavItem({ to, icon, label, count }: { to: string; icon: React.ReactNode; label: string; count?: number }) { return <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{icon}<span>{label}</span>{count ? <em>{count}</em> : null}</NavLink> }
function Dashboard({ actions, triggers, schedules, couple, partners, onTrigger, onAdd }: { actions: Action[]; triggers: Trigger[]; schedules: Schedule[]; couple: Couple | null; partners: Partner[]; onTrigger: () => void; onAdd: () => void }) { const active = schedules.filter((item) => item.active).length; const names = partners.map((item) => item.name).join(' & ') || 'vous deux'; return <><section className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</p><h1>Bonjour, {names} <span>♡</span></h1><p className="subheading">{couple?.name || 'Votre espace partagé'} · {partners.length} partenaire{partners.length > 1 ? 's' : ''}</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Ajouter une action</button></section><section className="hero-panel"><div className="hero-copy"><div className="live-tag"><span /> SYSTÈME ACTIF</div><h2>La routine n’a<br /><i>qu’à bien se tenir.</i></h2><p>Vos actions se déclenchent aléatoirement selon vos moments à deux.</p><button className="light-button" onClick={onTrigger}><RefreshCw size={16} /> Déclencher maintenant</button></div><div className="hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Heart size={28} fill="currentColor" /></div><div className="orbit-dot dot-one" /><div className="orbit-dot dot-two" /></div></section><div className="section-heading"><div><p className="eyebrow">VUE D’ENSEMBLE</p><h2>Votre duo en chiffres</h2></div><NavLink to="/historique" className="text-link">Voir l’historique <ChevronRight size={15} /></NavLink></div><section className="stats-grid"><StatCard icon={<Sparkles size={19} />} value={actions.length} label="Actions imaginées" tone="violet" /><StatCard icon={<Zap size={19} />} value={triggers.length} label="Déclenchements" tone="amber" /><StatCard icon={<Clock3 size={19} />} value={active} label="Plages actives" tone="blue" /><StatCard icon={<Heart size={19} />} value={partners.length} label="Partenaires" tone="rose" /></section><section className="dashboard-grid"><div className="content-card"><div className="card-heading"><div><p className="eyebrow">BIBLIOTHÈQUE PARTAGÉE</p><h3>Dernières actions</h3></div><NavLink to="/actions" className="circle-arrow"><ChevronRight size={18} /></NavLink></div>{actions.slice(0, 3).map((action) => <ActionRow key={action.id} action={action} />)}</div><div className="content-card"><div className="card-heading"><div><p className="eyebrow">À VENIR</p><h3>Vos plages horaires</h3></div><NavLink to="/horaires" className="circle-arrow"><ChevronRight size={18} /></NavLink></div>{schedules.slice(0, 3).map((schedule) => <div className="schedule-mini" key={schedule.id}><div className="schedule-icon on"><Clock3 size={17} /></div><div><strong>{schedule.label}</strong><small>{schedule.start} — {schedule.end} · {schedule.days.slice(0, 3).join(', ')}</small></div><span className={schedule.active ? 'active-label' : 'paused-label'}>{schedule.active ? 'Active' : 'Pause'}</span></div>)}</div></section></> }
function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><strong>{value}</strong><span>{label}</span></div> }
function ActionRow({ action, onDelete, onEdit }: { action: Action; onDelete?: () => void; onEdit?: () => void }) { return <div className="action-row"><div className={`category-mark ${action.category}`} /><div className="action-info"><strong>{action.title}</strong><span>{action.description}</span></div>{action.isTemplate && <span className="template-label">Prérempli</span>}<span className={`kind-label ${action.kind}`}>{action.kind === 'scenario' ? 'Scénario' : 'Action'}</span><span className={`category-label ${action.category}`}>{categoryLabels[action.category]}</span>{onEdit && !action.isTemplate && <button className="edit-button" onClick={onEdit} aria-label="Modifier">Modifier</button>}{onDelete && !action.isTemplate && <button className="delete-button" onClick={onDelete} aria-label="Supprimer"><Trash2 size={16} /></button>}</div> }
function ContentPage({ actions, kind, onAdd, onDelete, onEdit }: { actions: Action[]; kind: ContentKind; onAdd: () => void; onDelete: (id: string) => void; onEdit: (action: Action) => void }) { const [filter, setFilter] = useState<'all' | Category>('all'); const visible = useMemo(() => actions.filter((item) => item.kind === kind && (filter === 'all' || item.category === filter)), [actions, filter, kind]); return <><section className="page-title-row"><div><p className="eyebrow">BIBLIOTHÈQUE PARTAGÉE</p><h1>{kind === 'scenario' ? 'Scénarios' : 'Actions'}</h1><p className="subheading">{kind === 'scenario' ? 'Les scénarios que vous avez ajoutés.' : 'Les actions que vous avez ajoutées.'}</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Ajouter {kind === 'scenario' ? 'un scénario' : 'une action'}</button></section><div className="filter-row"><div className="filters">{(['all', 'fun', 'romantique', 'defi', 'surprise'] as const).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'Toutes' : categoryLabels[item]}</button>)}</div><span className="muted-text">{visible.length} élément{visible.length > 1 ? 's' : ''}</span></div><div className="content-card full-card">{visible.length ? visible.map((action) => <ActionRow key={action.id} action={action} onEdit={() => onEdit(action)} onDelete={() => onDelete(action.id)} />) : <div className="empty-state"><Sparkles size={25} /><strong>Aucun {kind === 'scenario' ? 'scénario' : 'action'} pour le moment</strong><span>Ajoutez votre première idée personnelle.</span></div>}</div></> }
function ActionsPage(props: { actions: Action[]; onAdd: () => void; onDelete: (id: string) => void; onEdit: (action: Action) => void }) { return <ContentPage {...props} kind="action" /> }
function SchedulesPage({ schedules }: { schedules: Schedule[]; onToggle: (schedule: Schedule) => void }) { void schedules; const scenarios = Object.keys(localStorage).filter((key) => key.startsWith('btr-actions-')).flatMap((key) => { try { return (JSON.parse(localStorage.getItem(key) || '[]') as Action[]).filter((item) => item.kind === 'scenario') } catch { return [] } }); return <><section className="page-title-row"><div><p className="eyebrow">BIBLIOTHÈQUE PARTAGÉE</p><h1>Scénarios</h1><p className="subheading">Les scénarios imaginés par votre duo.</p></div></section><div className="content-card full-card">{scenarios.length ? scenarios.map((scenario) => <ActionRow key={scenario.id} action={scenario} />) : <div className="empty-state"><Sparkles size={25} /><strong>Aucun scénario pour le moment</strong><span>Ajoutez votre première idée partagée depuis l’accueil.</span></div>}</div></> }
function HistoryPage({ triggers }: { triggers: Trigger[] }) { return <><section className="page-title-row"><div><p className="eyebrow">JOURNAL DU DUO</p><h1>Historique</h1><p className="subheading">Les déclenchements reçus par votre couple.</p></div><div className="history-count"><strong>{triggers.length}</strong><span>déclenchements</span></div></section><div className="content-card full-card">{triggers.map((trigger) => <div className="history-row" key={trigger.id}><div className="history-check"><Check size={16} /></div><div><strong>{trigger.actionTitle}</strong><span>{trigger.time} · envoyé à {trigger.partner}</span></div><ChevronRight size={17} className="history-arrow" /></div>)}</div></> }
function AddActionModal({ onClose, onSave, initialKind = 'action' }: { onClose: () => void; onSave: (action: Omit<Action, 'id' | 'createdAt'>) => void; initialKind?: ContentKind }) { const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [category, setCategory] = useState<Category>('fun'); const [kind, setKind] = useState<ContentKind>(initialKind); return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NOUVELLE IDÉE PARTAGÉE</p><h2>{kind === 'scenario' ? 'Nouveau scénario' : 'Nouvelle action'}</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="kind-choice"><button type="button" className={kind === 'action' ? 'selected' : ''} onClick={() => setKind('action')}><Zap size={16} /><strong>Action</strong><small>Une idée simple à réaliser</small></button><button type="button" className={kind === 'scenario' ? 'selected' : ''} onClick={() => setKind('scenario')}><Sparkles size={16} /><strong>Scénario</strong><small>Une expérience en plusieurs étapes</small></button></div><label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label><label>Catégorie<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="modal-footer"><button className="ghost-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={!title.trim()} onClick={() => onSave({ title, description, category, kind })}><Plus size={17} /> Ajouter</button></div></div></div> }
function getPageName(path: string) { if (path === '/') return 'Accueil'; if (path.includes('actions')) return 'Actions'; if (path.includes('horaires') || path.includes('scenarios')) return 'Scénarios'; return 'Historique' }

export default function App() { const [user, setUser] = useState<SessionUser | null>(null); const [checking, setChecking] = useState(Boolean(supabase)); useEffect(() => { const client = supabase; if (!client) return; void client.auth.getSession().then(({ data }) => { if (data.session?.user) setUser({ id: data.session.user.id, email: data.session.user.email }); setChecking(false) }); const { data: listener } = client.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)); return () => listener.subscription.unsubscribe() }, []); if (checking) return <div className="auth-loading"><Moon size={23} fill="currentColor" /> Chargement...</div>; return <BrowserRouter>{user ? <AppShell user={user} onSignOut={() => { void supabase?.auth.signOut(); setUser(null) }} /> : <AuthScreen onAuthenticated={setUser} />}</BrowserRouter> }
