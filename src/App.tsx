import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Armchair, ArrowDownLeft, RotateCw, Trash2, ArrowRight, Bell, Calendar, Check, ChevronDown, ChevronsLeft, CircleHelp, Coffee, Copy, DoorOpen, Gift, Hand, Hash, Info, LayoutGrid, Layers, Radio, SquarePen, Leaf, Link2, Lock, LocateFixed, LockOpen, LogOut, Map, MessageCircle, Mic, MicOff, Minus, Monitor, MoreHorizontal, Pencil, Plus, Search, Send, Settings2, Sparkles, Sun, Users, Video, VideoOff, X } from 'lucide-react';
import VivoScene from './VivoScene';
import MeetingView, { type MeetingPanel } from './MeetingView';
import ChatView, { conversationKey, messageKey, type Conversation } from './chat/ChatView';
import MiniOffice from './MiniOffice';
import { areaOf } from '../shared/vivo-geometry.js';
import { SPAWN } from '../shared/office-world.js';
import { useOffice } from './useOffice';
import { canHearEachOther, useMedia } from './useMedia';
import type { EditItem, OfficeObject, Participant, Status } from './types';
import { CATALOG } from '../shared/vivo-catalog.js';
import { baseObject, nextFacing } from '../shared/office-objects.js';
import { meetingRoom, meetingRoomOf, roomSeats } from '../shared/office-meetings.js';
import { getOfficeSeats } from '../shared/office-seats.js';
import { ObjectThumb } from './sprites/objects';

const COLORS = ['#7869df', '#e89e57', '#4d9e8b', '#d97797', '#609bd2', '#9d805e'];
const STATUS: Record<Status, string> = { available: 'Activo', busy: 'Ocupado', away: 'Ausente', focus: 'Concentrado' };
const room = new URLSearchParams(location.search).get('room')?.replace(/[^a-z0-9_-]/g, '').slice(0, 64) || 'mi-oficina';
type Theme = 'system' | 'light' | 'dark';
type Panel = 'people' | 'chat' | 'calendar' | 'activity' | 'build' | 'meeting' | null;
type Dialog = 'profile' | 'invite' | 'help' | 'settings' | null;

function IconButton({ label, children, onClick, active = false, className = '', disabled = false }: {
  label: string; children: ReactNode; onClick?: () => void; active?: boolean; className?: string; disabled?: boolean;
}) {
  return <button type="button" className={`icon-button ${active ? 'is-active' : ''} ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Avatar({ person, size = 34 }: { person: Pick<Participant, 'name' | 'color'>; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, background: person.color }}>{person.name.charAt(0).toUpperCase()}</span>;
}

function InvitePortraits() {
  return <div className="invite-portraits" aria-hidden="true">{['#f5d56d', '#94d4b8', '#ed9da4', '#bea4ea', '#8cc9df'].map((background) => <svg key={background} viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill={background} />
    <circle cx="14" cy="11" r="3.5" fill="none" stroke="#565267" strokeWidth="1.5" />
    <path d="M7 22v-2c0-3 3-5 7-5s7 2 7 5v2" fill="none" stroke="#565267" strokeWidth="1.5" />
  </svg>)}</div>;
}

function StreamVideo({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); } }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}

export default function App() {
  const [profile, setProfile] = useState<{ name: string; color: string } | null>(null);
  const [name, setName] = useState(() => localStorage.getItem('office-name') || '');
  const [color, setColor] = useState(() => localStorage.getItem('office-color') || COLORS[0]);
  const [panel, setPanel] = useState<Panel>('people');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [zoom, setZoom] = useState(1.35);
  const [simplified, setSimplified] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number; nonce: number }>();
  const [resetViewKey, setResetViewKey] = useState(0);
  const [editItem, setEditItem] = useState<EditItem | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<'office' | 'nearby' | 'meeting'>('office');
  const [areaCard, setAreaCard] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [seatTarget, setSeatTarget] = useState<{ seatId: string; nonce: number }>();
  const [handRaised, setHandRaised] = useState(false);
  const [meetingView, setMeetingView] = useState(false);
  const [meetingPanel, setMeetingPanel] = useState<MeetingPanel>('chat');
  const [conversation, setConversation] = useState<Conversation>({ kind: 'channel', id: 'general' });
  const [chatQuery, setChatQuery] = useState('');
  const [sections, setSections] = useState({ channels: true, dms: true });
  const [newChannel, setNewChannel] = useState<{ name: string; topic: string } | null>(null);
  const [newDm, setNewDm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('office-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });
  const [notice, setNotice] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const office = useOffice(room, profile);
  const store = (key: string) => `office-${key}-${office.userId}`;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lastRead, setLastRead] = useState<Record<string, string>>({});
  useEffect(() => { try { setDrafts(JSON.parse(localStorage.getItem(store('drafts')) || '{}')); setLastRead(JSON.parse(localStorage.getItem(store('read')) || '{}')); } catch { /* fresh browser */ } }, [office.userId]);
  useEffect(() => { try { localStorage.setItem(store('drafts'), JSON.stringify(drafts)); } catch { /* storage unavailable */ } }, [drafts]);
  useEffect(() => { try { localStorage.setItem(store('read'), JSON.stringify(lastRead)); } catch { /* storage unavailable */ } }, [lastRead]);
  const showError = useCallback((message: string) => setNotice(message), []);
  const media = useMedia({ selfId: office.selfId, participants: office.participants, send: office.send, subscribeSignal: office.subscribeSignal, onError: showError });
  const self = office.participants.find(p => p.id === office.selfId);
  const selectedPerson = office.participants.find(p => p.id === selected);
  const visiblePeople = office.participants.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const online = office.connection === 'online';
  const nearby = office.participants.filter(p => self && canHearEachOther(self, p));
  const meetingArea = self ? meetingRoomOf(self) : null;
  const meeting = meetingArea ? office.meetings[meetingArea.id] : undefined;
  const roomLabel = (areaId: string) => office.areaNames[areaId] ?? meetingRoom(areaId)?.name ?? 'Sala';
  const chatMessages = office.messages.filter(message => message.channel === channel && (channel !== 'meeting' || message.areaId === meetingArea?.id));
  const cardArea = areaCard ? meetingRoom(areaCard) : null;
  const cardMeeting = areaCard ? office.meetings[areaCard] : undefined;
  /** Walk to the free chair nearest the room's table, as the reference does when a meeting starts. */
  const joinMeeting = useCallback((areaId: string) => {
    const area = meetingRoom(areaId);
    if (!area) return;
    if (office.meetings[areaId]?.locked) { setNotice('Esta reunión está bloqueada.'); return; }
    const taken = new Set(office.participants.map(person => person.seatId));
    const seat = roomSeats(area, getOfficeSeats(office.objects, office.overrides)).find(candidate => !taken.has(candidate.id));
    if (!seat) { setNotice('No quedan sillas libres en esta sala.'); return; }
    setAreaCard(null); setPanel(panel => panel === 'build' ? 'people' : panel); setEditItem(null); setSelectedObject(null);
    setSeatTarget({ seatId: seat.id, nonce: Date.now() });
  }, [office.meetings, office.participants, office.objects, office.overrides]);
  const meetingLink = (areaId: string) => `${location.origin}/?room=${encodeURIComponent(room)}&meeting=${encodeURIComponent(areaId)}`;
  async function copyMeetingLink(areaId: string) {
    try { await navigator.clipboard.writeText(meetingLink(areaId)); setNotice('Enlace de la reunión copiado al portapapeles'); }
    catch { setNotice(meetingLink(areaId)); }
  }
  const previousLocked = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const locked = meeting?.locked;
    if (meetingArea && previousLocked.current !== undefined && previousLocked.current !== locked) setNotice(locked ? 'Bloqueada: esta reunión ahora es privada' : 'Desbloqueada: otras personas pueden unirse');
    previousLocked.current = meetingArea ? !!locked : undefined;
  }, [meetingArea?.id, meeting?.locked]);
  useEffect(() => { if (!meetingArea && (panel === 'meeting' || channel === 'meeting')) { setChannel('office'); if (panel === 'meeting') setPanel('people'); } if (!meetingArea) setMeetingView(false); setHandRaised(false); }, [meetingArea?.id]);
  const meetingPeople = meetingArea ? office.participants.filter(person => meetingRoomOf(person)?.id === meetingArea.id) : [];
  const meetingMessages = meetingArea ? office.messages.filter(message => message.channel === 'meeting' && message.areaId === meetingArea.id) : [];
  const showMeetingView = meetingView && !!meetingArea;
  const showChatView = panel === 'chat' && !showMeetingView;
  const onlineUsers = new Set(office.participants.map(person => person.userId));
  const activeKey = conversationKey(conversation, office.userId);
  const conversationMessages = office.messages.filter(message => messageKey(message) === activeKey);
  const unread = (key: string) => office.messages.filter(message => messageKey(message) === key && message.userId !== office.userId && message.createdAt > (lastRead[key] ?? '')).length;
  const mentionsMe = (message: { text: string }) => !!self && new RegExp(`@${self.name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(message.text);
  useEffect(() => {
    if (!showChatView) return;
    const latest = conversationMessages.at(-1)?.createdAt;
    if (latest && latest > (lastRead[activeKey] ?? '')) setLastRead(read => ({ ...read, [activeKey]: latest }));
  }, [showChatView, activeKey, conversationMessages.length]);
  useEffect(() => { if (office.createdChannel) { setConversation({ kind: 'channel', id: office.createdChannel.id }); setPanel('chat'); } }, [office.createdChannel?.nonce]);
  const totalUnread = office.channels.reduce((sum, channel) => sum + unread(`channel:${channel.id}`), 0) + office.users.reduce((sum, user) => sum + unread(`dm:${[office.userId, user.userId].sort().join(':')}`), 0);
  const whereAmI = self ? (meetingArea ? roomLabel(meetingArea.id) : areaOf(self)?.name ?? 'Oficina') : 'Oficina';
  // A meeting link (?meeting=<area>) seats you in that room on arrival, as the reference does.
  const linkHandled = useRef(false);
  useEffect(() => {
    if (!online || linkHandled.current) return;
    const areaId = new URLSearchParams(location.search).get('meeting');
    if (!areaId) return;
    linkHandled.current = true;
    const url = new URL(location.href); url.searchParams.delete('meeting'); history.replaceState(null, '', url);
    joinMeeting(areaId);
  }, [online]);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => { document.documentElement.dataset.theme = theme === 'system' ? system.matches ? 'dark' : 'light' : theme; };
    applyTheme();
    localStorage.setItem('office-theme', theme);
    system.addEventListener('change', applyTheme);
    return () => system.removeEventListener('change', applyTheme);
  }, [theme]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { setDialog(null); setSelected(null); setEditItem(null); setSelectedObject(null); setMoreOpen(false); setAreaCard(null); setRenaming(null); }
      if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPanel('people'); setEditItem(null); requestAnimationFrame(() => searchRef.current?.focus());
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault(); leaveMeeting();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!dialog || !profile) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = dialogRef.current;
    const focusable = () => Array.from(container?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    container?.addEventListener('keydown', trapFocus);
    return () => { container?.removeEventListener('keydown', trapFocus); previous?.focus(); };
  }, [dialog, Boolean(profile)]);
  useEffect(() => {
    if (!moreOpen) return;
    function close(event: PointerEvent) { if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setMoreOpen(false); }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [moreOpen]);

  const move = useCallback((x: number, y: number) => setNavigationTarget({ x, y, nonce: Date.now() }), []);
  function leaveMeeting() { setNavigationTarget({ x: SPAWN.x, y: SPAWN.y, nonce: Date.now() }); setAreaCard(null); }
  const publishMove = useCallback((x: number, y: number) => office.send({ type: 'move', x, y }), [office.send]);
  const place = useCallback((x: number, y: number) => { if (editItem) office.send({ type: 'object:add', ...editItem, x, y }); }, [editItem, office.send]);
  const rotateSelected = useCallback(() => { if (selectedObject) office.send({ type: 'object:update', id: selectedObject, rotate: true }); }, [selectedObject, office.send]);
  const rotateEditItem = useCallback(() => setEditItem(item => { if (!item) return item; const facing = nextFacing({ id: 'x', ...item, x: 0, y: 0 }); return facing ? { ...item, facing } : item; }), []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('[role="dialog"]'))) return;
      if (e.key.toLowerCase() === 'r' && (editItem || selectedObject)) { e.preventDefault(); if (editItem) rotateEditItem(); else rotateSelected(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) { e.preventDefault(); office.send({ type: 'object:remove', id: selectedObject }); setSelectedObject(null); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [editItem, selectedObject, rotateEditItem, rotateSelected, office.send]);
  const remove = useCallback((id: string) => office.send({ type: 'object:remove', id }), [office.send]);
  const moveObject = useCallback((id: string, x: number, y: number) => office.send({ type: 'object:update', id, x, y }), [office.send]);
  function join(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return;
    localStorage.setItem('office-name', name.trim()); localStorage.setItem('office-color', color); setProfile({ name: name.trim(), color });
  }
  function openPanel(value: Panel) { setPanel(old => old === value ? null : value); if (value !== 'build') { setEditItem(null); setSelectedObject(null); } setMoreOpen(false); }
  function saveProfile(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return;
    setProfile({ name: name.trim(), color }); office.send({ type: 'profile', name: name.trim(), color });
    localStorage.setItem('office-name', name.trim()); localStorage.setItem('office-color', color); setDialog(null);
  }
  function sendConversation(value: string) {
    if (conversation.kind === 'channel') office.send({ type: 'chat', channel: 'channel', channelId: conversation.id, text: value });
    else if (conversation.kind === 'dm') office.send({ type: 'chat', channel: 'dm', to: conversation.userId, text: value });
    else office.send({ type: 'chat', channel: 'nearby', text: value });
  }
  function showInvite() { setCopied(false); setDialog('invite'); }
  function searchPeople() { setPanel('people'); setEditItem(null); requestAnimationFrame(() => searchRef.current?.focus()); }
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${location.origin}/?room=${encodeURIComponent(room)}`); setCopied(true); }
    catch { setNotice('Selecciona el enlace y cópialo para abrir otra sesión.'); }
  }
  function leave() { media.stop(); setProfile(null); setSelected(null); setMoreOpen(false); }

  const controlBar = (
        <div className="controlbar" aria-label="Controles de presencia, audio y vídeo">
          <button className="self-button" disabled={!profile} title="Tu perfil y disponibilidad" aria-label="Tu perfil y disponibilidad" onClick={() => setDialog('profile')}><span className="avatar-wrap"><Avatar person={self || { name: name || 'T', color }} size={32} /><i className={`status-dot ${self?.status || 'away'}`} /></span><ChevronDown size={12} /></button>
          <span className="control-separator" />
          <button className={`media-control ${media.mic ? 'enabled' : 'muted'}`} disabled={!online} onClick={() => void media.toggleMic()} title={media.mic ? 'Silenciar micrófono' : 'Activar micrófono'} aria-label={media.mic ? 'Silenciar micrófono' : 'Activar micrófono'} aria-pressed={media.mic}>{media.mic ? <Mic size={21} /> : <MicOff size={21} />}</button>
          <button className={`media-control ${media.camera ? 'enabled' : 'muted'}`} disabled={!online || media.screen} onClick={() => void media.toggleCamera()} title={media.camera ? 'Apagar cámara' : 'Activar cámara'} aria-label={media.camera ? 'Apagar cámara' : 'Activar cámara'} aria-pressed={media.camera}>{media.camera ? <Video size={22} /> : <VideoOff size={22} />}</button>
          <IconButton label={media.screen ? 'Dejar de compartir' : 'Compartir pantalla'} active={media.screen} disabled={!online} onClick={() => void media.toggleScreen()}><Monitor size={21} /></IconButton>
          {meetingArea && <IconButton label={handRaised ? 'Bajar la mano' : 'Levantar la mano'} active={handRaised} onClick={() => setHandRaised(raised => !raised)}><Hand size={21} /></IconButton>}
          {meetingArea && <IconButton label="Volver a mi escritorio · ⌘ D" className="leave-meeting" onClick={leaveMeeting}><LogOut size={20} /></IconButton>}
          <div className="control-more" ref={moreRef}><button className={`icon-button ${moreOpen ? 'is-active' : ''}`} type="button" title="Más opciones" aria-label="Más opciones" aria-expanded={moreOpen} aria-controls="call-options" onClick={() => setMoreOpen(open => !open)}><MoreHorizontal size={22} /></button>
            {moreOpen && <div className="control-menu" id="call-options">
              <div className="nearby-status"><i />{nearby.length ? `${nearby.length} ${nearby.length === 1 ? 'persona cerca' : 'personas cerca'}` : 'No hay personas cerca'}</div>
              <button disabled={!online} onClick={() => { setPanel('chat'); setConversation({ kind: 'nearby' }); setEditItem(null); setMoreOpen(false); }}><MessageCircle size={17} />Chat cercano</button>
              <button disabled={!online} onClick={() => { move(SPAWN.x, SPAWN.y); setMoreOpen(false); }}><ArrowDownLeft size={17} />Volver al lobby</button>
              <button onClick={() => { setDialog('help'); setMoreOpen(false); }}><CircleHelp size={17} />Controles y atajos</button>
              <button className="leave" disabled={!profile} onClick={leave}><DoorOpen size={17} />Salir de la oficina</button>
            </div>}
          </div>
        </div>
  );

  return <div className="app-shell">
    <nav className="rail" aria-label="Navegación principal">
      <button className="brand" aria-label="Open Office — abrir oficina" title="Open Office" onClick={() => { setPanel('people'); setDialog(null); setEditItem(null); }}><span /><span /><span /><span /></button>
      <button className="rail-search" aria-label="Buscar personas" title="Buscar personas · ⌘ / Ctrl K" onClick={searchPeople}><Search size={20} /><span>⌘ K</span></button>
      <div className="rail-main">
        <button className={`nav-item ${!showMeetingView && (panel === 'people' || panel === null) ? 'current' : ''}`} aria-label="Oficina" aria-pressed={!showMeetingView && panel === 'people'} title="Oficina" onClick={() => { setPanel('people'); setEditItem(null); setMeetingView(false); }}><Map size={22} /></button>
        <button className={`nav-item ${showChatView ? 'current' : ''}`} aria-label={totalUnread ? `Chat, ${totalUnread} sin leer` : 'Chat'} aria-pressed={showChatView} title="Chat" onClick={() => { setMeetingView(false); setPanel(old => old === 'chat' ? 'people' : 'chat'); setEditItem(null); setSelectedObject(null); }}><MessageCircle size={22} />{totalUnread > 0 && <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}</button>
        <button className={`nav-item ${panel === 'calendar' ? 'current' : ''}`} aria-label="Calendario" aria-pressed={panel === 'calendar'} title="Calendario" onClick={() => openPanel('calendar')}><Calendar size={22} /></button>
        <button className={`nav-item ${panel === 'activity' ? 'current' : ''}`} aria-label="Actividad" aria-pressed={panel === 'activity'} title="Actividad" onClick={() => openPanel('activity')}><Bell size={22} /></button>
        <button className={`nav-item ${panel === 'build' ? 'current' : ''}`} aria-label="Decorar" aria-pressed={panel === 'build'} title="Decorar" onClick={() => openPanel('build')}><Armchair size={22} /></button>
        {meetingArea && <button className={`nav-item nav-meeting ${showMeetingView ? 'current' : ''}`} aria-label="Reunión" aria-pressed={showMeetingView} title="Vista de reunión" onClick={() => { setMeetingView(true); setMeetingPanel(panel => panel ?? 'chat'); }}><Video size={22} /><span>Reunión</span></button>}
      </div>
      <div className="rail-bottom">
        <IconButton label="Invitar a la oficina" onClick={showInvite}><Gift size={21} /></IconButton>
        <IconButton label="Ayuda y controles" onClick={() => setDialog('help')}><CircleHelp size={21} /></IconButton>
        <IconButton label="Ajustes" onClick={() => setDialog('settings')}><Settings2 size={21} /></IconButton>
      </div>
    </nav>
    <div className="workspace">
      {panel && !showMeetingView && <aside className={`side-panel panel-${panel}`} aria-label={panel === 'people' ? 'Personas de la oficina' : panel === 'chat' ? 'Chat' : panel === 'calendar' ? 'Calendario' : panel === 'activity' ? 'Actividad' : panel === 'meeting' ? 'Reunión' : 'Decorador'}>
        <div className="panel-heading"><h1>{panel === 'people' ? 'Vivo' : panel === 'chat' ? 'Chat' : panel === 'calendar' ? 'Calendario' : panel === 'activity' ? 'Actividad' : panel === 'meeting' ? 'Chat de la reunión' : 'Decorador'}</h1>{panel === 'chat' ? <div className="panel-heading-tools"><IconButton label="Nuevo mensaje" onClick={() => setNewDm(true)}><SquarePen size={17} /></IconButton><IconButton label="Acerca del chat" onClick={() => setNotice('Los canales y mensajes directos se guardan en esta oficina. «Cerca de ti» no se guarda.')}><Info size={17} /></IconButton></div> : <IconButton label="Contraer panel" onClick={() => { setPanel(null); setEditItem(null); }}><ChevronsLeft size={18} /></IconButton>}</div>
        {panel === 'people' && <>
          <div className="floor-selector"><Layers size={15} /><span>Piso 1</span><ChevronDown size={14} /></div>
          <div className="invite-card"><strong>Comparte tu oficina</strong><p>Invita a tus compañeros a trabajar juntos.</p><InvitePortraits /><button onClick={showInvite}><Users size={13} />Invitar colaboradores</button></div>
          <div className="panel-search"><Search size={16} /><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar personas" aria-label="Buscar personas en la oficina" /><kbd>⌘ K</kbd></div>
          <div className="section-label"><ChevronDown size={13} />En línea <span>({office.participants.length})</span></div>
          <div className="people-list">{visiblePeople.map(p => <button className={`person-row ${selected === p.id ? 'selected' : ''}`} key={p.id} onClick={() => setSelected(p.id)}><span className="avatar-wrap"><Avatar person={p} /><i className={`status-dot ${p.status}`} /></span><div><strong>{p.name}{p.id === office.selfId && <span className="you"> (tú)</span>}</strong><span>{STATUS[p.status]}</span></div>{p.mic && <Mic size={14} />}</button>)}{!office.participants.length && <p className="empty-small">Entra para ver quién está en la oficina.</p>}{office.participants.length > 0 && !visiblePeople.length && <p className="empty-small">No hay personas con ese nombre.</p>}</div>
          <details className="office-places"><summary><Layers size={15} />Explorar la oficina<ChevronDown size={13} /></summary>
            <button className="area-row" disabled={!online} onClick={() => move(1008, 848)}><Monitor size={16} /><span>Team</span><ArrowRight size={14} /></button>
            <button className="area-row" disabled={!online} onClick={() => move(1104, 1200)}><Users size={16} /><span>Media room</span><ArrowRight size={14} /></button>
            <button className="area-row" disabled={!online} onClick={() => move(SPAWN.x, SPAWN.y)}><Coffee size={16} /><span>Lobby</span><ArrowRight size={14} /></button>
          </details>
          <div className="sidebar-foot"><span className={`connection ${online ? 'connected' : ''}`}><i />{online ? 'Conectado' : profile ? 'Conectando…' : 'Sin conexión'}</span><span>Open Office</span></div>
        </>}
        {panel === 'meeting' && meetingArea && <>
          <div className="meeting-summary"><span className="meeting-pill"><Users size={14} />{roomLabel(meetingArea.id)}</span><span className="muted">{meeting?.locked ? <><Lock size={12} /> Privada</> : <><LockOpen size={12} /> Abierta: otras personas pueden unirse</>}</span></div>
          <div className="chat-history">{meetingMessages.map(message => message.system ? <div className="message-system" key={message.id}><strong>{message.name}</strong> {message.text}</div> : <div className={`message ${message.participantId === office.selfId ? 'own' : ''}`} key={message.id}><div><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></div>)}<div ref={messageEnd} /></div>
          <form className="chat-compose" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; office.send({ type: 'chat', channel: 'meeting', text: text.trim() }); setText(''); }}><input aria-label={`Mensaje a ${roomLabel(meetingArea.id)}`} value={text} onChange={e => setText(e.target.value)} placeholder={`Mensaje a ${roomLabel(meetingArea.id)}`} maxLength={1000} disabled={!online} /><button className="icon-button" type="submit" title="Enviar mensaje" aria-label="Enviar mensaje" disabled={!online || !text.trim()}><Send size={18} /></button></form>
        </>}
        {panel === 'chat' && <div className="chat-sidebar">
          <div className="invite-card"><strong>Comparte tu oficina</strong><p>Invita a tus compañeros a trabajar juntos.</p><InvitePortraits /><button onClick={showInvite}><Users size={13} />Invitar colaboradores</button></div>
          <div className="panel-search"><Search size={16} /><input value={chatQuery} onChange={e => setChatQuery(e.target.value)} placeholder="Buscar o navegar…" aria-label="Buscar canales y personas" /><kbd>⌘ F</kbd></div>
          <button type="button" className={`chat-nav-row${conversation.kind === 'nearby' ? ' is-active' : ''}`} onClick={() => setConversation({ kind: 'nearby' })}><Radio size={16} /><span>Cerca de ti</span>{unread('nearby') > 0 && <b className="chat-unread">{unread('nearby')}</b>}</button>
          <button type="button" className="chat-nav-row" onClick={() => { const key = Object.keys(drafts).find(candidate => drafts[candidate]?.trim()); if (!key) { setNotice('No tienes borradores.'); return; } if (key.startsWith('channel:')) setConversation({ kind: 'channel', id: key.slice(8) }); else if (key.startsWith('dm:')) setConversation({ kind: 'dm', userId: key.split(':').slice(1).find(id => id !== office.userId) ?? office.userId }); else setConversation({ kind: 'nearby' }); }}><Send size={16} /><span>Borradores</span>{Object.values(drafts).filter(value => value.trim()).length > 0 && <em>{Object.values(drafts).filter(value => value.trim()).length}</em>}</button>
          <div className="chat-section"><button type="button" className="chat-section-toggle" aria-expanded={sections.channels} onClick={() => setSections(value => ({ ...value, channels: !value.channels }))}>Canales<ChevronDown size={13} /></button><button type="button" className="chat-section-add" aria-label="Crear canal" title="Crear canal" onClick={() => setNewChannel({ name: '', topic: '' })}><Plus size={14} /></button></div>
          {sections.channels && office.channels.filter(channel => !chatQuery || channel.name.includes(chatQuery.toLowerCase())).map(channel => { const key = `channel:${channel.id}`; const count = unread(key); const mention = office.messages.some(message => messageKey(message) === key && message.userId !== office.userId && message.createdAt > (lastRead[key] ?? '') && mentionsMe(message)); return <button type="button" key={channel.id} className={`chat-nav-row${activeKey === key ? ' is-active' : ''}${count ? ' is-unread' : ''}`} onClick={() => setConversation({ kind: 'channel', id: channel.id })}><Hash size={16} /><span>{channel.name}</span>{drafts[key]?.trim() && activeKey !== key && <Send size={12} className="chat-draft-mark" />}{count > 0 && <b className={`chat-unread${mention ? ' is-mention' : ''}`}>{mention ? '@' : count}</b>}</button>; })}
          <div className="chat-section"><button type="button" className="chat-section-toggle" aria-expanded={sections.dms} onClick={() => setSections(value => ({ ...value, dms: !value.dms }))}>Mensajes directos<ChevronDown size={13} /></button><button type="button" className="chat-section-add" aria-label="Nuevo mensaje directo" title="Nuevo mensaje directo" onClick={() => setNewDm(true)}><Plus size={14} /></button></div>
          {sections.dms && [...office.users].sort((a, b) => (a.userId === office.userId ? -1 : b.userId === office.userId ? 1 : a.name.localeCompare(b.name))).filter(user => !chatQuery || user.name.toLowerCase().includes(chatQuery.toLowerCase())).map(user => { const key = `dm:${[office.userId, user.userId].sort().join(':')}`; const count = unread(key); return <button type="button" key={user.userId} className={`chat-nav-row dm${activeKey === key ? ' is-active' : ''}${count ? ' is-unread' : ''}`} onClick={() => setConversation({ kind: 'dm', userId: user.userId })}><span className="chat-avatar small" style={{ background: user.color }}>{user.name.charAt(0).toUpperCase()}<i className={`status-dot ${onlineUsers.has(user.userId) ? 'available' : 'away'}`} /></span><span>{user.name}{user.userId === office.userId && <span className="you"> (tú)</span>}</span>{count > 0 && <b className="chat-unread">{count}</b>}</button>; })}
        </div>}
        {panel === 'calendar' && <div className="chat-empty"><Calendar size={30} /><h2>Sin reuniones programadas</h2><p>Conecta un calendario para ver aquí tus reuniones de la semana.</p></div>}
        {panel === 'activity' && <div className="chat-empty"><Bell size={30} /><h2>Sin actividad nueva</h2><p>Aquí aparecerán menciones, mensajes y avisos de la oficina.</p></div>}
        {panel === 'build' && <>
          <div className="panel-search"><Search size={16} /><input value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} placeholder="Buscar una decoración" aria-label="Buscar en el catálogo" /></div>
          <p className="panel-description">{editItem ? 'Clic en la oficina para colocar · R gira · Esc termina' : selectedObject ? 'Arrastra para mover · R gira · Suprimir elimina · Esc deselecciona' : 'Elige un objeto del catálogo, o haz clic en uno del mapa para moverlo, girarlo o eliminarlo. Mientras editas no puedes caminar.'}</p>
          {editItem && <div className="edit-toolbar"><ObjectThumb item={editItem} size={44} /><div><strong>{editItem.kind.replace(/-/g, ' ')}</strong><span>{editItem.color} · {editItem.facing}</span></div><IconButton label="Girar (R)" onClick={rotateEditItem}><RotateCw size={16} /></IconButton><IconButton label="Terminar" onClick={() => setEditItem(null)}><X size={16} /></IconButton></div>}
          {selectedObject && !editItem && <div className="edit-toolbar"><div><strong>Objeto seleccionado</strong><span>{(office.objects.find(o => o.id === selectedObject)?.kind ?? baseObject(selectedObject)?.kind ?? '').replace(/-/g, ' ')}</span></div><IconButton label="Girar (R)" onClick={rotateSelected}><RotateCw size={16} /></IconButton><IconButton label="Eliminar" onClick={() => { remove(selectedObject); setSelectedObject(null); }}><Trash2 size={16} /></IconButton></div>}
          <div className="catalog-list">{Object.entries(Object.values(CATALOG).filter(entry => !catalogQuery || `${entry.family} ${entry.kind} ${entry.color}`.toLowerCase().includes(catalogQuery.toLowerCase())).reduce<Record<string, typeof CATALOG[string][]>>((groups, entry) => { (groups[entry.family] ??= []).push(entry); return groups; }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([family, entries]) => <section key={family}><h3>{family}</h3><div className="catalog-grid">{entries.map(entry => { const facing = Object.keys(entry.facings)[0]; const active = editItem?.kind === entry.kind && editItem.color === entry.color; return <button key={`${entry.kind}/${entry.color}`} disabled={!online} className={active ? 'selected' : ''} aria-pressed={active} title={`${entry.kind.replace(/-/g, ' ')} · ${entry.color}`} onClick={() => { setSelectedObject(null); setEditItem(active ? null : { kind: entry.kind, color: entry.color, facing }); }}><ObjectThumb item={{ kind: entry.kind, color: entry.color, facing }} size={48} /><span>{entry.kind.replace(/-/g, ' ')}</span></button>; })}</div></section>)}</div>
          <div className="section-label">Objetos colocados <span>({office.objects.length})</span></div>
          <p className="save-hint"><Check size={14} /> Los cambios se guardan en esta oficina.</p>
          <button className="primary exit-edit-button" type="button" onClick={() => { setEditItem(null); setSelectedObject(null); setPanel('people'); }}><DoorOpen size={16} />Salir del modo edición</button>
        </>}
        {showChatView && <MiniOffice label={whereAmI} participants={office.participants} selfId={office.selfId} onOpen={() => setPanel('people')}>{controlBar}</MiniOffice>}
      </aside>}
      <main className={`map-area${showMeetingView ? ' is-meeting-view' : ''}${showChatView ? ' is-chat-view' : ''}`} aria-label={showMeetingView ? 'Vista de reunión' : 'Oficina Vivo'}>
        <VivoScene participants={office.participants} selfId={office.selfId} objects={office.objects} overrides={office.overrides} editorOpen={panel === 'build'} zoom={zoom} simplified={simplified} editItem={editItem} selectedObject={selectedObject} navigationTarget={navigationTarget} resetViewKey={resetViewKey} onMove={publishMove} onPlace={place} onSelect={setSelected} onSelectObject={setSelectedObject} onMoveObject={moveObject} onRemove={remove} onSit={id => office.send({ type: 'seat:sit', seatId: id })} onStand={() => office.send({ type: 'seat:stand' })} meetings={office.meetings} areaNames={office.areaNames} seatTarget={seatTarget} onAreaClick={id => { setAreaCard(id); setRenaming(null); setSelected(null); }} />
        {meetingArea && <div className="meeting-bar" aria-label="Reunión en curso">
          <div className="meeting-bar-left"><span className="meeting-pill"><Users size={15} />{roomLabel(meetingArea.id)}</span><button type="button" className={`meeting-lock ${meeting?.locked ? 'is-locked' : ''}`} title={meeting?.locked ? 'Desbloquear reunión' : 'Bloquear reunión'} aria-label={meeting?.locked ? 'Desbloquear reunión' : 'Bloquear reunión'} aria-pressed={!!meeting?.locked} onClick={() => office.send({ type: 'meeting:lock', areaId: meetingArea.id, locked: !meeting?.locked })}>{meeting?.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button></div>
          <div className="meeting-bar-right"><button type="button" className="meeting-tool" title="Copiar enlace de la reunión" aria-label="Copiar enlace de la reunión" onClick={() => void copyMeetingLink(meetingArea.id)}><Link2 size={15} /></button><div className="meeting-view-toggle" role="group" aria-label="Vista"><button type="button" className={!showMeetingView ? 'is-active' : ''} aria-pressed={!showMeetingView} title="Vista de oficina" aria-label="Vista de oficina" onClick={() => setMeetingView(false)}><Map size={14} /></button><button type="button" className={showMeetingView ? 'is-active' : ''} aria-pressed={showMeetingView} title="Vista de reunión" aria-label="Vista de reunión" onClick={() => { setMeetingView(true); setMeetingPanel(panel => panel ?? 'chat'); }}><LayoutGrid size={14} /></button></div></div>
        </div>}
        {showMeetingView && meetingArea && <MeetingView roomName={roomLabel(meetingArea.id)} meeting={meeting} people={meetingPeople} selfId={office.selfId} localStream={media.localStream} remoteStreams={media.remoteStreams} messages={meetingMessages} panel={meetingPanel} online={online} onPanel={setMeetingPanel} onSend={value => office.send({ type: 'chat', text: value, channel: 'meeting' })} onCopyLink={() => void copyMeetingLink(meetingArea.id)} />}
        {showChatView && <ChatView conversation={conversation} channels={office.channels} users={office.users} participants={office.participants} selfUserId={office.userId} messages={conversationMessages} online={online} draft={drafts[activeKey] ?? ''} onDraft={value => setDrafts(old => ({ ...old, [activeKey]: value }))} onSend={sendConversation} onTopic={(channelId, topic) => office.send({ type: 'channel:update', channelId, topic })} />}
        {cardArea && !showMeetingView && !showChatView && <div className="area-card" role="dialog" aria-label={`Sala ${roomLabel(cardArea.id)}`}>
          <div className="area-card-head"><span className="area-card-icon"><Users size={14} /></span><div>{renaming === cardArea.id ? <form className="area-rename" onSubmit={e => { e.preventDefault(); if (roomName.trim()) office.send({ type: 'area:rename', areaId: cardArea.id, name: roomName.trim() }); setRenaming(null); }}><input autoFocus value={roomName} maxLength={40} aria-label="Nombre de la sala" onChange={e => setRoomName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} /><button className="primary" type="submit">Guardar</button></form> : <><strong>{roomLabel(cardArea.id)}</strong><span>Sala de reunión{cardMeeting?.active ? ` · ${cardMeeting.participants} en reunión` : ''}{cardMeeting?.locked ? ' · privada' : ''}</span></>}</div><IconButton label="Cerrar" className="area-card-close" onClick={() => { setAreaCard(null); setRenaming(null); }}><X size={15} /></IconButton></div>
          <div className="area-card-actions"><button className="primary area-card-go" disabled={!online || !!cardMeeting?.locked} onClick={() => joinMeeting(cardArea.id)}><Video size={15} />{cardMeeting?.locked ? 'Reunión privada' : cardMeeting?.active ? 'Unirse a la reunión' : 'Iniciar reunión'}</button><button type="button" className="area-card-tool" title="Copiar enlace de la reunión" aria-label="Copiar enlace de la reunión" onClick={() => void copyMeetingLink(cardArea.id)}><Link2 size={15} /></button><button type="button" className="area-card-tool" title="Cambiar el nombre de la sala" aria-label="Cambiar el nombre de la sala" onClick={() => { setRoomName(roomLabel(cardArea.id)); setRenaming(cardArea.id); }}><Pencil size={15} /></button></div>
        </div>}
        {!online && profile && <div className="connection-banner" role="status">Reconectando a la oficina…</div>}
        {panel === 'build' && <div className="edit-banner"><Sparkles size={16} /><span>{editItem ? 'Clic para colocar · R gira · Esc termina' : 'Modo edición · arrastra para mover · R gira · Suprimir elimina'}</span><button type="button" className="edit-exit" onClick={() => { setEditItem(null); setSelectedObject(null); setPanel('people'); }}><DoorOpen size={14} />Salir de edición</button></div>}
        {selectedPerson && <div className="person-popover"><IconButton label="Cerrar perfil" className="close-profile" onClick={() => setSelected(null)}><X size={15} /></IconButton><Avatar person={selectedPerson} size={54} /><h2>{selectedPerson.name}</h2><span className="muted">{STATUS[selectedPerson.status]}</span><div>{selectedPerson.id === office.selfId ? <button className="secondary" onClick={() => { setDialog('profile'); setSelected(null); }}>Editar perfil</button> : <button className="primary" onClick={() => { move(selectedPerson.x - 32, selectedPerson.y); setSelected(null); }}>Acercarme <ArrowRight size={15} /></button>}</div></div>}
        {!showMeetingView && (media.localStream || Object.keys(media.remoteStreams).length > 0) && <div className="video-strip">{media.localStream && <div className="video-tile"><StreamVideo stream={media.localStream} muted /><span>{self?.name} · Tú</span></div>}{Object.entries(media.remoteStreams).map(([id, stream]) => <div className="video-tile" key={id}><StreamVideo stream={stream} /><span>{office.participants.find(p => p.id === id)?.name || 'Participante'}</span></div>)}</div>}
        {!showMeetingView && !showChatView && <div className="zoom-controls" aria-label="Controles del mapa">
          <IconButton label="Acercar" disabled={zoom >= 4} onClick={() => setZoom(v => Math.min(4, Math.round(v * 1.25 * 100) / 100))}><Plus size={19} /></IconButton>
          <IconButton label="Alejar" disabled={zoom <= .36} onClick={() => setZoom(v => Math.max(.36, Math.round(v / 1.25 * 100) / 100))}><Minus size={19} /></IconButton>
          <span className="zoom-readout" aria-live="polite">{Math.round(zoom * 100)}%</span><span className="divider" />
          <IconButton label="Centrar vista" onClick={() => { setZoom(1.35); setResetViewKey(key => key + 1); }}><LocateFixed size={18} /></IconButton>
          <IconButton label={simplified ? 'Ver oficina completa' : 'Simplificar el mapa'} active={simplified} onClick={() => setSimplified(!simplified)}><Layers size={18} /></IconButton>
        </div>}
        {!showChatView && controlBar}
      </main>
    </div>
    {newChannel && <div className="modal-backdrop" onClick={() => setNewChannel(null)}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="channel-title" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (!newChannel.name.trim()) return; office.send({ type: 'channel:create', name: newChannel.name, topic: newChannel.topic }); setNewChannel(null); }}><IconButton label="Cerrar ventana" className="modal-close" onClick={() => setNewChannel(null)}><X size={19} /></IconButton><span className="dialog-icon"><Hash size={27} /></span><h2 id="channel-title">Crear un canal</h2><p>Los canales reúnen las conversaciones de un tema o equipo. Todos en la oficina pueden verlos.</p><label>Nombre<input autoFocus value={newChannel.name} maxLength={40} placeholder="p. ej. diseño" onChange={e => setNewChannel({ ...newChannel, name: e.target.value })} required /></label><label>Descripción (opcional)<input value={newChannel.topic} maxLength={160} placeholder="¿De qué trata este canal?" onChange={e => setNewChannel({ ...newChannel, topic: e.target.value })} /></label><button className="primary enter-button" type="submit" disabled={!online}>Crear canal</button></form></div>}
    {newDm && <div className="modal-backdrop" onClick={() => setNewDm(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dm-title" onClick={e => e.stopPropagation()}><IconButton label="Cerrar ventana" className="modal-close" onClick={() => setNewDm(false)}><X size={19} /></IconButton><span className="dialog-icon"><SquarePen size={27} /></span><h2 id="dm-title">Nuevo mensaje</h2><p>Elige con quién quieres hablar.</p><div className="dm-picker">{office.users.map(user => <button type="button" key={user.userId} onClick={() => { setConversation({ kind: 'dm', userId: user.userId }); setPanel('chat'); setNewDm(false); }}><span className="chat-avatar small" style={{ background: user.color }}>{user.name.charAt(0).toUpperCase()}<i className={`status-dot ${onlineUsers.has(user.userId) ? 'available' : 'away'}`} /></span><span>{user.name}{user.userId === office.userId ? ' (tú)' : ''}</span></button>)}</div></div></div>}
    {(notice || office.error) && <div className="toast" role="status"><span>{notice || office.error}</span><IconButton label="Cerrar aviso" onClick={() => { setNotice(''); office.setError(''); }}><X size={15} /></IconButton></div>}
    {!profile && <div className="modal-backdrop welcome-backdrop"><form className="modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onSubmit={join}><div className="welcome-art"><InvitePortraits /></div><span className="eyebrow">OPEN OFFICE</span><h1 id="welcome-title">Entrar a Vivo</h1><p>Tu equipo y tus conversaciones, en un mismo lugar.</p><label>Tu nombre<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="¿Cómo te llamas?" maxLength={40} required /></label><div className="color-picker" aria-label="Color del avatar">{COLORS.map(c => <button type="button" key={c} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} className={color === c ? 'selected' : ''} onClick={() => setColor(c)}>{color === c && <Check size={17} />}</button>)}</div><button className="primary enter-button" type="submit">Entrar a la oficina <ArrowRight size={18} /></button><span className="privacy-note"><MicOff size={13} /><VideoOff size={14} />Micrófono y cámara apagados al entrar</span></form></div>}
    {dialog && profile && <div className="modal-backdrop" onClick={() => setDialog(null)}><div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}><IconButton label="Cerrar ventana" className="modal-close" onClick={() => setDialog(null)}><X size={19} /></IconButton>
      {dialog === 'profile' ? <form onSubmit={saveProfile}><h2 id="dialog-title">Tu perfil</h2><p>Así te verá el resto de la oficina.</p><div className="profile-preview"><Avatar person={{ name: name || 'T', color }} size={70} /></div><label>Nombre<input value={name} onChange={e => setName(e.target.value)} required maxLength={40} /></label><div className="color-picker">{COLORS.map(c => <button type="button" key={c} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} className={color === c ? 'selected' : ''} onClick={() => setColor(c)}>{color === c && <Check size={17} />}</button>)}</div><label>Disponibilidad<select value={self?.status || 'available'} onChange={e => office.send({ type: 'profile', status: e.target.value })}>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="primary enter-button" type="submit">Guardar cambios</button></form>
        : dialog === 'invite' ? <><span className="dialog-icon"><Users size={27} /></span><h2 id="dialog-title">Invitar colaboradores</h2><p>Abre este enlace en otra pestaña de este computador para compartir la oficina.</p><label>Enlace de la oficina<input readOnly value={`${location.origin}/?room=${encodeURIComponent(room)}`} onFocus={e => e.target.select()} /></label><button className="primary enter-button" onClick={() => void copyLink()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Enlace copiado' : 'Copiar enlace'}</button><p className="footnote">Esta oficina se ejecuta en tu computador. El acceso desde otros equipos necesita configurar un servidor.</p></>
          : dialog === 'settings' ? <><span className="dialog-icon"><Settings2 size={27} /></span><h2 id="dialog-title">Apariencia</h2><p>Elige cómo se ve la interfaz de tu oficina.</p><label>Tema<select value={theme} onChange={e => setTheme(e.target.value as Theme)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><p className="footnote">La opción Sistema se adapta a la apariencia de tu computador.</p><button className="primary enter-button" onClick={() => setDialog(null)}>Listo</button></>
            : <><span className="dialog-icon"><CircleHelp size={27} /></span><h2 id="dialog-title">Controles de la oficina</h2><p>Acércate a tus compañeros para conversar.</p><div className="shortcuts"><div><span>Caminar</span><kbd>↑ ↓ ← → / WASD</kbd></div><div><span>Caminar más rápido</span><kbd>Shift + flechas</kbd></div><div><span>Ir a un lugar</span><kbd>Doble clic</kbd></div><div><span>Sentarse / levantarse</span><kbd>Clic en silla / E</kbd></div><div><span>Explorar el mapa</span><kbd>Arrastrar</kbd></div><div><span>Buscar personas</span><kbd>⌘ / Ctrl + K</kbd></div><div><span>Volver al área de trabajo</span><kbd>⌘ / Ctrl + D</kbd></div></div><button className="primary enter-button" onClick={() => setDialog(null)}>Entendido</button></>}
    </div></div>}
  </div>;
}
