import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, CalendarDays, Check, ChevronRight, Clock3, Heart, Home,
  Menu, Moon, Plus, RefreshCw, Settings2, Sparkles, Trash2, Wifi, X, Zap,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './App.css'

type Category = 'fun' | 'romantique' | 'defi' | 'surprise'
type Action = { id: string; title: string; description: string; category: Category; createdAt: string }
type Trigger = { id: string; actionId: string; actionTitle: string; time: string; partner: string }
type Schedule = { id: string; label: string; start: string; end: string; days: string[]; active: boolean }

const seedActions: Action[] = [
  { id: '1', title: 'Danse dans le salon', description: 'Lancez une chanson au hasard et dansez ensemble, sans vous prendre au sérieux.', category: 'fun', createdAt: '2026-09-08' },
  { id: '2', title: 'Le mot doux inattendu', description: 'Écrivez trois choses que vous aimez chez l’autre et glissez-les dans sa poche.', category: 'romantique', createdAt: '2026-09-07' },
  { id: '3', title: 'Changer de chemin', description: 'Sur le chemin du retour, prenez une rue que vous ne connaissez pas.', category: 'surprise', createdAt: '2026-09-06' },
  { id: '4', title: 'Défi 60 secondes', description: 'Faites rire l’autre en moins d’une minute. Le perdant prépare le thé.', category: 'defi', createdAt: '2026-09-04' },
]
const seedTriggers: Trigger[] = [
  { id: 't1', actionId: '2', actionTitle: 'Le mot doux inattendu', time: 'Aujourd’hui, 08:42', partner: 'Partenaire B' },
  { id: 't2', actionId: '1', actionTitle: 'Danse dans le salon', time: 'Hier, 19:15', partner: 'Partenaire A' },
  { id: 't3', actionId: '3', actionTitle: 'Changer de chemin', time: 'Lundi, 12:03', partner: 'Partenaire B' },
]
const seedSchedules: Schedule[] = [
  { id: 's1', label: 'Matin doux', start: '08:00', end: '10:30', days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'], active: true },
  { id: 's2', label: 'Pause de midi', start: '12:00', end: '14:00', days: ['Lun', 'Mer', 'Ven'], active: true },
  { id: 's3', label: 'Soirée complice', start: '18:30', end: '22:00', days: ['Ven', 'Sam', 'Dim'], active: false },
]

const categoryLabels: Record<Category, string> = { fun: 'Fun', romantique: 'Romantique', defi: 'Défi', surprise: 'Surprise' }

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : initial
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

type SessionUser = { email?: string; id: string }

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    if (!supabase) {
      onAuthenticated({ id: 'demo-user', email: email || 'demo@breakroutine.app' })
      setLoading(false)
      return
    }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name: name || 'Partenaire' } } })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else if (result.data.user) onAuthenticated({ id: result.data.user.id, email: result.data.user.email })
  }

  return <div className="auth-screen"><div className="auth-glow"></div><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><Moon size={19} fill="currentColor" /></div><div><strong>Break The</strong><span>Routine</span></div></div><p className="eyebrow">VOTRE ESPACE PRIVÉ</p><h1>{mode === 'login' ? 'Bienvenue à nouveau.' : 'Créez votre duo.'}</h1><p className="auth-copy">{mode === 'login' ? 'Retrouvez vos idées et vos moments inattendus.' : 'Un espace à deux, sans auteur et sans routine.'}</p><form onSubmit={submit}>{mode === 'signup' && <label>Votre prénom<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Élodie" /></label>}<label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" /></label><label>Mot de passe<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 caractères minimum" /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={loading}>{loading ? 'Connexion...' : mode === 'login' ? 'Entrer dans mon espace' : 'Créer mon espace'}</button></form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}</button>{!supabase && <small className="demo-note">Mode démo actif · aucune configuration Supabase détectée</small>}</div></div>
}

function AppShell({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [actions, setActions] = useStored<Action[]>('btr-actions', seedActions)
  const [triggers, setTriggers] = useStored<Trigger[]>('btr-triggers', seedTriggers)
  const [schedules, setSchedules] = useStored<Schedule[]>('btr-schedules', seedSchedules)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [coupleId, setCoupleId] = useState<string | null>(null)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || user.id === 'demo-user') return
    const loadRemoteData = async () => {
      const { data: partner } = await client.from('partners').select('couple_id').eq('id', user.id).single()
      if (!partner) return
      setCoupleId(partner.couple_id)
      const { data: remoteActions } = await client.from('actions').select('id,title,description,category,created_at').eq('couple_id', partner.couple_id).order('created_at', { ascending: false })
      if (remoteActions) setActions(remoteActions.map((action) => ({ id: action.id, title: action.title, description: action.description, category: action.category as Category, createdAt: action.created_at })))
      const { data: remoteTriggers } = await client.from('triggers').select('id,action_id,triggered_at,delivered_to_partner_id,actions(title)').order('triggered_at', { ascending: false })
      if (remoteTriggers) setTriggers(remoteTriggers.map((trigger) => { const relatedAction = Array.isArray(trigger.actions) ? trigger.actions[0] : trigger.actions; return { id: trigger.id, actionId: trigger.action_id, actionTitle: relatedAction?.title || 'Action surprise', time: new Date(trigger.triggered_at).toLocaleString('fr-FR'), partner: trigger.delivered_to_partner_id === user.id ? 'Vous' : 'Votre partenaire' } }))
    }
    void loadRemoteData()
  }, [user.id, setActions, setTriggers])

  const triggerAction = useCallback((action = actions[Math.floor(Math.random() * actions.length)]) => {
    if (!action) return
    const trigger: Trigger = { id: crypto.randomUUID(), actionId: action.id, actionTitle: action.title, time: 'À l’instant', partner: Math.random() > .5 ? 'Partenaire A' : 'Partenaire B' }
    setTriggers((current) => [trigger, ...current])
    if (supabase && coupleId && user.id !== 'demo-user') void supabase.from('triggers').insert({ action_id: action.id, delivered_to_partner_id: user.id })
    setToast(`${action.title} · ${trigger.partner}`)
    setTimeout(() => setToast(null), 4200)
  }, [actions, coupleId, setTriggers, user.id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const hour = new Date().getHours()
      const active = schedules.some((schedule) => schedule.active && hour >= Number(schedule.start.split(':')[0]) && hour < Number(schedule.end.split(':')[0]))
      if (active && Math.random() > .65) triggerAction()
    }, 30000)
    return () => window.clearInterval(timer)
  }, [actions, schedules, triggerAction])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Moon size={19} fill="currentColor" /></div><div><strong>Break The</strong><span>Routine</span></div></div>
      <div className="couple-card"><div className="avatar-pair"><span>É</span><span>M</span></div><div><strong>Élodie &amp; Marc</strong><small>Votre espace privé</small></div><ChevronRight size={15} /></div>
      <nav className="nav-list">
        <p className="nav-label">Espace duo</p>
        <NavItem to="/" icon={<Home size={18} />} label="Accueil" />
        <NavItem to="/actions" icon={<Sparkles size={18} />} label="Actions" count={actions.length} />
        <NavItem to="/horaires" icon={<Clock3 size={18} />} label="Horaires" />
        <NavItem to="/historique" icon={<CalendarDays size={18} />} label="Historique" />
      </nav>
      <div className="sidebar-bottom"><div className="sync-status"><span className={online ? 'status-dot' : 'status-dot offline'}></span><span>{online ? 'Synchronisé' : 'Mode hors-ligne'}</span></div><button className="icon-button" aria-label="Réglages"><Settings2 size={17} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu icon-button"><Menu size={20} /></button><div className="breadcrumb">Ton espace <span>/</span> <strong>{getPageName(location.pathname)}</strong></div><div className="top-actions"><div className="online-pill"><Wifi size={14} /> {online ? 'En ligne' : 'Hors-ligne'}</div><button className="notification-button" onClick={() => navigate('/historique')} aria-label="Voir l’historique"><Bell size={19} /><span></span></button><button className="profile-mini" onClick={onSignOut} title={`Déconnexion de ${user.email || 'votre compte'}`}>É</button></div></header>
      <div className="page-wrap"><Routes><Route path="/" element={<Dashboard actions={actions} triggers={triggers} schedules={schedules} onTrigger={() => triggerAction()} onAdd={() => setShowAdd(true)} />} /><Route path="/actions" element={<ActionsPage actions={actions} onAdd={() => setShowAdd(true)} onDelete={(actionId) => { setActions((current) => current.filter((item) => item.id !== actionId)); if (supabase) void supabase.from('actions').delete().eq('id', actionId) }} />} /><Route path="/horaires" element={<SchedulesPage schedules={schedules} setSchedules={setSchedules} />} /><Route path="/historique" element={<HistoryPage triggers={triggers} />} /></Routes></div>
    </main>
    {showAdd && <AddActionModal onClose={() => setShowAdd(false)} onSave={async (action) => { const localAction = { ...action, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; if (supabase && coupleId && user.id !== 'demo-user') { const { data } = await supabase.from('actions').insert({ couple_id: coupleId, title: action.title, description: action.description, category: action.category }).select('id,created_at').single(); if (data) { localAction.id = data.id; localAction.createdAt = data.created_at } } setActions((current) => [localAction, ...current]); setShowAdd(false); setToast('Nouvelle action ajoutée') }} />}
    {toast && <div className="toast"><div className="toast-icon"><Zap size={17} fill="currentColor" /></div><div><small>Nouveau déclenchement</small><strong>{toast}</strong></div><button onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>
}

function NavItem({ to, icon, label, count }: { to: string; icon: React.ReactNode; label: string; count?: number }) { return <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{icon}<span>{label}</span>{count && <em>{count}</em>}</NavLink> }

function Dashboard({ actions, triggers, schedules, onTrigger, onAdd }: { actions: Action[]; triggers: Trigger[]; schedules: Schedule[]; onTrigger: () => void; onAdd: () => void }) {
  const activeSchedules = schedules.filter((schedule) => schedule.active).length
  return <><section className="welcome-row"><div><p className="eyebrow">MERCREDI 10 SEPTEMBRE 2026</p><h1>Bonjour, vous deux <span>♡</span></h1><p className="subheading">Un peu d’inattendu peut changer toute une journée.</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Ajouter une action</button></section><section className="hero-panel"><div className="hero-copy"><div className="live-tag"><span></span> SYSTÈME ACTIF</div><h2>La routine n’a<br /><i>qu’à bien se tenir.</i></h2><p>Vos actions se déclenchent aléatoirement selon vos moments à deux.</p><button className="light-button" onClick={onTrigger}><RefreshCw size={16} /> Déclencher maintenant</button></div><div className="hero-orbit"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orbit-core"><Heart size={28} fill="currentColor" /></div><div className="orbit-dot dot-one"></div><div className="orbit-dot dot-two"></div></div></section><div className="section-heading"><div><p className="eyebrow">VUE D’ENSEMBLE</p><h2>Votre duo en chiffres</h2></div><NavLink to="/historique" className="text-link">Voir l’historique <ChevronRight size={15} /></NavLink></div><section className="stats-grid"><StatCard icon={<Sparkles size={19} />} value={actions.length} label="Actions imaginées" tone="violet" /><StatCard icon={<Zap size={19} />} value={triggers.length} label="Déclenchements" tone="amber" /><StatCard icon={<Clock3 size={19} />} value={activeSchedules} label="Plages actives" tone="blue" /><StatCard icon={<Heart size={19} />} value="∞" label="Moments partagés" tone="rose" /></section><section className="dashboard-grid"><div className="content-card"><div className="card-heading"><div><p className="eyebrow">BIBLIOTHÈQUE</p><h3>Dernières actions</h3></div><NavLink to="/actions" className="circle-arrow"><ChevronRight size={18} /></NavLink></div><div className="action-list">{actions.slice(0, 3).map((action) => <ActionRow key={action.id} action={action} />)}</div></div><div className="content-card"><div className="card-heading"><div><p className="eyebrow">À VENIR</p><h3>Vos plages horaires</h3></div><NavLink to="/horaires" className="circle-arrow"><ChevronRight size={18} /></NavLink></div><div className="schedule-mini-list">{schedules.slice(0, 3).map((schedule) => <div className="schedule-mini" key={schedule.id}><div className={`schedule-icon ${schedule.active ? 'on' : ''}`}><Clock3 size={17} /></div><div><strong>{schedule.label}</strong><small>{schedule.start} — {schedule.end} · {schedule.days.slice(0, 3).join(', ')}</small></div><span className={schedule.active ? 'active-label' : 'paused-label'}>{schedule.active ? 'Active' : 'Pause'}</span></div>)}</div></div></section></>
}

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><strong>{value}</strong><span>{label}</span></div> }
function ActionRow({ action, onDelete }: { action: Action; onDelete?: () => void }) { return <div className="action-row"><div className={`category-mark ${action.category}`}></div><div className="action-info"><strong>{action.title}</strong><span>{action.description}</span></div><span className={`category-label ${action.category}`}>{categoryLabels[action.category]}</span>{onDelete && <button className="delete-button" onClick={onDelete} aria-label="Supprimer"><Trash2 size={16} /></button>}</div> }

function ActionsPage({ actions, onAdd, onDelete }: { actions: Action[]; onAdd: () => void; onDelete: (actionId: string) => void }) { const [filter, setFilter] = useState<'all' | Category>('all'); const visible = useMemo(() => filter === 'all' ? actions : actions.filter((a) => a.category === filter), [actions, filter]); return <><section className="page-title-row"><div><p className="eyebrow">VOTRE BIBLIOTHÈQUE</p><h1>Actions &amp; scénarios</h1><p className="subheading">Des idées anonymes, pour des surprises plus spontanées.</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Nouvelle action</button></section><div className="filter-row"><div className="filters">{(['all', 'fun', 'romantique', 'defi', 'surprise'] as const).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'Toutes' : categoryLabels[item]}</button>)}</div><span className="muted-text">{visible.length} idées</span></div><div className="content-card full-card"><div className="action-list spacious">{visible.map((action) => <ActionRow key={action.id} action={action} onDelete={() => onDelete(action.id)} />)}</div></div></> }

function SchedulesPage({ schedules, setSchedules }: { schedules: Schedule[]; setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>> }) { return <><section className="page-title-row"><div><p className="eyebrow">AUTOMATISATION</p><h1>Vos horaires</h1><p className="subheading">Choisissez les moments où la surprise peut apparaître.</p></div><button className="primary-button"><Plus size={18} /> Ajouter une plage</button></section><div className="schedule-grid">{schedules.map((schedule) => <div className={`schedule-card ${schedule.active ? '' : 'disabled'}`} key={schedule.id}><div className="schedule-card-top"><div className="schedule-icon on"><Clock3 size={19} /></div><button className={`toggle ${schedule.active ? 'checked' : ''}`} onClick={() => setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, active: !item.active } : item))} aria-label="Activer la plage"><span></span></button></div><h3>{schedule.label}</h3><div className="schedule-time">{schedule.start} <span>→</span> {schedule.end}</div><div className="days-row">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <span className={schedule.days.includes(day) ? 'day-on' : ''} key={day}>{day.slice(0, 1)}</span>)}</div><div className="schedule-footer"><span>{schedule.active ? 'Déclenchements autorisés' : 'Plage en pause'}</span><Settings2 size={15} /></div></div>)}</div></> }
function HistoryPage({ triggers }: { triggers: Trigger[] }) { return <><section className="page-title-row"><div><p className="eyebrow">JOURNAL DU DUO</p><h1>Historique</h1><p className="subheading">La trace de vos petites ruptures de routine.</p></div><div className="history-count"><strong>{triggers.length}</strong><span>déclenchements</span></div></section><div className="content-card full-card"><div className="history-list">{triggers.map((trigger) => <div className="history-row" key={trigger.id}><div className="history-check"><Check size={16} /></div><div><strong>{trigger.actionTitle}</strong><span>{trigger.time} · envoyé à {trigger.partner}</span></div><ChevronRight size={17} className="history-arrow" /></div>)}</div></div></> }

function AddActionModal({ onClose, onSave }: { onClose: () => void; onSave: (action: Omit<Action, 'id' | 'createdAt'>) => void }) { const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [category, setCategory] = useState<Category>('fun'); return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">NOUVELLE IDÉE</p><h2>Ajouter une action</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Petit-déjeuner surprise" autoFocus /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Décrivez ce que vous aimeriez tenter..." rows={4} /></label><label>Catégorie<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="modal-footer"><button className="ghost-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={!title.trim()} onClick={() => onSave({ title, description, category })}><Plus size={17} /> Ajouter l’idée</button></div></div></div> }

function getPageName(path: string) { if (path === '/') return 'Accueil'; if (path.includes('actions')) return 'Actions'; if (path.includes('horaires')) return 'Horaires'; return 'Historique' }

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser({ id: data.session.user.id, email: data.session.user.email })
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      setCheckingSession(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) return <div className="auth-loading"><Moon size={23} fill="currentColor" /> Chargement de votre espace...</div>
  return <BrowserRouter>{user ? <AppShell user={user} onSignOut={() => { supabase?.auth.signOut(); setUser(null) }} /> : <AuthScreen onAuthenticated={setUser} />}</BrowserRouter>
}
