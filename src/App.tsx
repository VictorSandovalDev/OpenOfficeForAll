import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Armchair, ArrowDownLeft, RotateCw, Trash2, ArrowRight, Bell, Calendar, Check, ChevronDown, ChevronsLeft, CircleHelp, Coffee, Copy, DoorOpen, Gift, AtSign, CheckCheck, Hand, Hash, Info, SmilePlus, Redo2, Undo2, Pencil as PencilIcon, Smile as SmileIcon, UserPen, LayoutGrid, Layers, Radio, SquarePen, Leaf, Link2, Lock, LocateFixed, LockOpen, LogOut, Map, MessageCircle, Mic, MicOff, Minus, Monitor, MoreHorizontal, Pencil, Plus, Search, Send, Settings2, Sparkles, Sun, Users, Video, VideoOff, X } from 'lucide-react';
import VivoScene from './VivoScene';
import MeetingView, { type MeetingPanel } from './MeetingView';
import ChatView, { conversationKey, messageKey, type Conversation } from './chat/ChatView';
import MiniOffice from './MiniOffice';
import CalendarView, { timeRange } from './calendar/CalendarView';
import { activityItems, type ActivityItem } from './activity';
import { MEETING_ROOMS } from '../shared/office-meetings.js';
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
import AvatarEditor, { AvatarPortrait } from './AvatarEditor';
import { useEditHistory } from './useEditHistory';
import { sanitizeLook, type AvatarLook } from './avatarLook';
import { artPack, onArtPackChange, setArtPack, type ArtPack } from './sprites/artPack';
import { currentAccount, loadConfig, rememberKeysFromUrl, sessionToken, signIn, signOut, storedKey, storeKey, type Account, type OfficeConfig } from './config';
import { language, LANGUAGES, locale, onLanguageChange, setLanguage, t, type Language } from './i18n';

/** Looks are remembered per browser and name, so two people sharing a browser keep their own avatars. */
const lookStorageKey = (name: string) => `office-look-${name.trim().toLowerCase() || 'invitado'}`;
function readLook(name: string): AvatarLook { try { return sanitizeLook(JSON.parse(localStorage.getItem(lookStorageKey(name)) || 'null')); } catch { return sanitizeLook(null); } }
const COLORS = ['#7869df', '#e89e57', '#4d9e8b', '#d97797', '#609bd2', '#9d805e'];
const STATUS_SOURCE: Record<Status, string> = { available: 'Activo', busy: 'Ocupado', away: 'Ausente', focus: 'Concentrado' };
/** Status labels, translated each time they are read so a language change applies at once. */
const STATUS = Object.defineProperties({} as Record<Status, string>, Object.fromEntries(Object.entries(STATUS_SOURCE).map(([key, value]) => [key, { enumerable: true, get: () => t(value) }])));
const room = new URLSearchParams(location.search).get('room')?.replace(/[^a-z0-9_-]/g, '').slice(0, 64) || 'mi-oficina';
rememberKeysFromUrl(room);
const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
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
  const [profile, setProfile] = useState<{ name: string; color: string; avatar: AvatarLook; accessKey: string; adminKey: string; sessionToken: string } | null>(null);
  const [config, setConfig] = useState<OfficeConfig>({ accessRequired: false, editPolicy: 'everyone', iceServers: [], accounts: 'off' });
  const [account, setAccount] = useState<Account | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  useEffect(() => { void currentAccount().then(found => { if (found) { setAccount(found); setName(found.name); } }); }, []);
  const [accessKey, setAccessKey] = useState(() => storedKey('key', room));
  useEffect(() => { void loadConfig().then(setConfig); }, []);
  const [look, setLook] = useState<AvatarLook>(() => readLook(localStorage.getItem('office-name') || ''));
  const [lookEditor, setLookEditor] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [colorPicker, setColorPicker] = useState(false);
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
  const [reactionMenu, setReactionMenu] = useState(false);
  const [meetingView, setMeetingView] = useState(false);
  const [meetingPanel, setMeetingPanel] = useState<MeetingPanel>('chat');
  const [conversation, setConversation] = useState<Conversation>({ kind: 'channel', id: 'general' });
  const [chatQuery, setChatQuery] = useState('');
  const [sections, setSections] = useState({ channels: true, dms: true });
  const [newChannel, setNewChannel] = useState<{ name: string; topic: string } | null>(null);
  const [newDm, setNewDm] = useState(false);
  const [calendarTab, setCalendarTab] = useState<'scheduled' | 'notes'>('scheduled');
  const [eventQuery, setEventQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState<{ title: string; date: string; start: string; end: string; areaId: string; description: string } | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('office-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });
  const [notice, setNotice] = useState('');
  const [lang, setLang] = useState<Language>(language);
  useEffect(() => onLanguageChange(() => setLang(language())), []);
  const [art, setArt] = useState<ArtPack>(artPack);
  useEffect(() => onArtPackChange(() => setArt(artPack())), []);
  const searchRef = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const office = useOffice(room, profile);
  const canEdit = config.editPolicy === 'everyone' || office.role === 'admin';
  useEffect(() => { if (office.loginRequired) { setProfile(null); setAccount(null); void signOut(); setAuthError('login_required'); } }, [office.loginRequired]);
  useEffect(() => { if (office.accessDenied) { setProfile(null); storeKey('key', room, ''); setAccessKey(''); } }, [office.accessDenied]);
  const store = (key: string) => `office-${key}-${office.userId}`;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lastRead, setLastRead] = useState<Record<string, string>>({});
  const [activityRead, setActivityRead] = useState<Record<string, true>>({});
  useEffect(() => { try { setDrafts(JSON.parse(localStorage.getItem(store('drafts')) || '{}')); setLastRead(JSON.parse(localStorage.getItem(store('read')) || '{}')); setActivityRead(JSON.parse(localStorage.getItem(store('activity')) || '{}')); } catch { /* fresh browser */ } }, [office.userId]);
  useEffect(() => { try { localStorage.setItem(store('drafts'), JSON.stringify(drafts)); } catch { /* storage unavailable */ } }, [drafts]);
  useEffect(() => { try { localStorage.setItem(store('read'), JSON.stringify(lastRead)); } catch { /* storage unavailable */ } }, [lastRead]);
  useEffect(() => { try { localStorage.setItem(store('activity'), JSON.stringify(activityRead)); } catch { /* storage unavailable */ } }, [activityRead]);
  const showError = useCallback((message: string) => setNotice(message), []);
  const media = useMedia({ selfId: office.selfId, participants: office.participants, send: office.send, subscribeSignal: office.subscribeSignal, onError: showError });
  const self = office.participants.find(p => p.id === office.selfId);
  const selectedPerson = office.participants.find(p => p.id === selected);
  const visiblePeople = office.participants.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const online = office.connection === 'online';
  const nearby = office.participants.filter(p => self && canHearEachOther(self, p));
  const meetingArea = self ? meetingRoomOf(self) : null;
  const meeting = meetingArea ? office.meetings[meetingArea.id] : undefined;
  const roomLabel = (areaId: string) => office.areaNames[areaId] ?? meetingRoom(areaId)?.name ?? t('Sala');
  const chatMessages = office.messages.filter(message => message.channel === channel && (channel !== 'meeting' || message.areaId === meetingArea?.id));
  const cardArea = areaCard ? meetingRoom(areaCard) : null;
  const cardMeeting = areaCard ? office.meetings[areaCard] : undefined;
  /** Walk to the free chair nearest the room's table, as the reference does when a meeting starts. */
  const joinMeeting = useCallback((areaId: string) => {
    const area = meetingRoom(areaId);
    if (!area) return;
    if (office.meetings[areaId]?.locked) { setNotice(t('Esta reunión está bloqueada.')); return; }
    const taken = new Set(office.participants.map(person => person.seatId));
    const seat = roomSeats(area, getOfficeSeats(office.objects, office.overrides)).find(candidate => !taken.has(candidate.id));
    if (!seat) { setNotice(t('No quedan sillas libres en esta sala.')); return; }
    setAreaCard(null); setPanel(panel => panel === 'build' ? 'people' : panel); setEditItem(null); setSelectedObject(null);
    setSeatTarget({ seatId: seat.id, nonce: Date.now() });
  }, [office.meetings, office.participants, office.objects, office.overrides]);
  const meetingLink = (areaId: string) => `${location.origin}/?room=${encodeURIComponent(room)}&meeting=${encodeURIComponent(areaId)}`;
  async function copyMeetingLink(areaId: string) {
    try { await navigator.clipboard.writeText(meetingLink(areaId)); setNotice(t('Enlace de la reunión copiado al portapapeles')); }
    catch { setNotice(meetingLink(areaId)); }
  }
  const previousLocked = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const locked = meeting?.locked;
    if (meetingArea && previousLocked.current !== undefined && previousLocked.current !== locked) setNotice(locked ? t('Bloqueada: esta reunión ahora es privada') : t('Desbloqueada: otras personas pueden unirse'));
    previousLocked.current = meetingArea ? !!locked : undefined;
  }, [meetingArea?.id, meeting?.locked]);
  useEffect(() => { if (!meetingArea && (panel === 'meeting' || channel === 'meeting')) { setChannel('office'); if (panel === 'meeting') setPanel('people'); } if (!meetingArea) setMeetingView(false); }, [meetingArea?.id]);
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
  const showCalendarView = panel === 'calendar' && !showMeetingView;
  const showActivityView = panel === 'activity' && !showMeetingView;
  const pageView = showChatView || showCalendarView || showActivityView;
  const activity = activityItems({ messages: office.messages, channels: office.channels, events: office.events, selfUserId: office.userId, selfName: self?.name ?? name, now: clock });
  const activityUnread = activity.filter(item => !activityRead[item.id]).length;
  const visibleActivity = unreadOnly ? activity.filter(item => !activityRead[item.id]) : activity;
  const openActivity = (item: ActivityItem) => {
    setActivityRead(read => ({ ...read, [item.id]: true }));
    if (item.target.type === 'channel') { setConversation({ kind: 'channel', id: item.target.id }); setPanel('chat'); }
    else if (item.target.type === 'dm') { setConversation({ kind: 'dm', userId: item.target.userId }); setPanel('chat'); }
    else if (item.target.type === 'event') { setSelectedEvent(item.target.id); setPanel('calendar'); }
  };
  const openNewEvent = (start: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const end = new Date(start.getTime() + 30 * 60_000);
    setNewEvent({ title: '', date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`, start: `${pad(start.getHours())}:${pad(start.getMinutes())}`, end: `${pad(end.getHours())}:${pad(end.getMinutes())}`, areaId: MEETING_ROOMS[0]?.id ?? '', description: '' });
  };
  const todayEvents = office.events.filter(event => new Date(event.start).toDateString() === new Date(clock).toDateString() && (!eventQuery || event.title.toLowerCase().includes(eventQuery.toLowerCase()))).sort((a, b) => a.start.localeCompare(b.start));
  const upcomingEvents = office.events.filter(event => Date.parse(event.start) > new Date(new Date(clock).toDateString()).getTime() + 86_400_000 && (!eventQuery || event.title.toLowerCase().includes(eventQuery.toLowerCase()))).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8);
  const whereAmI = self ? (meetingArea ? roomLabel(meetingArea.id) : areaOf(self)?.name ?? t('Oficina')) : t('Oficina');
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
    if (!statusMenu) return;
    function close(event: PointerEvent) { if (event.target instanceof Element && !event.target.closest('.status-menu, .self-button')) setStatusMenu(false); }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [statusMenu]);
  useEffect(() => {
    if (!moreOpen) return;
    function close(event: PointerEvent) { if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setMoreOpen(false); }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [moreOpen]);

  const move = useCallback((x: number, y: number) => setNavigationTarget({ x, y, nonce: Date.now() }), []);
  function leaveMeeting() { setNavigationTarget({ x: SPAWN.x, y: SPAWN.y, nonce: Date.now() }); setAreaCard(null); }
  const publishMove = useCallback((x: number, y: number) => office.send({ type: 'move', x, y }), [office.send]);
  const editHistory = useEditHistory({ objects: office.objects, overrides: office.overrides, send: office.send });
  const place = useCallback((x: number, y: number) => { if (editItem) { editHistory.record.add({ ...editItem, x, y }); office.send({ type: 'object:add', ...editItem, x, y }); } }, [editItem, office.send, editHistory.record]);
  const rotateSelected = useCallback(() => { if (selectedObject) { editHistory.record.update(selectedObject); office.send({ type: 'object:update', id: selectedObject, rotate: true }); } }, [selectedObject, office.send, editHistory.record]);
  const rotateEditItem = useCallback(() => setEditItem(item => { if (!item) return item; const facing = nextFacing({ id: 'x', ...item, x: 0, y: 0 }); return facing ? { ...item, facing } : item; }), []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('[role="dialog"]'))) return;
      if (e.key.toLowerCase() === 'r' && (editItem || selectedObject)) { e.preventDefault(); if (editItem) rotateEditItem(); else rotateSelected(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) { e.preventDefault(); editHistory.record.remove(selectedObject); office.send({ type: 'object:remove', id: selectedObject }); setSelectedObject(null); }
      if (panel === 'build' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) editHistory.redo(); else editHistory.undo(); setSelectedObject(null); }
      if (panel === 'build' && e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'y') { e.preventDefault(); editHistory.redo(); setSelectedObject(null); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [editItem, selectedObject, rotateEditItem, rotateSelected, office.send, editHistory, panel]);
  const remove = useCallback((id: string) => { editHistory.record.remove(id); office.send({ type: 'object:remove', id }); }, [office.send, editHistory.record]);
  const moveObject = useCallback((id: string, x: number, y: number) => { editHistory.record.update(id); office.send({ type: 'object:update', id, x, y }); }, [office.send, editHistory.record]);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (config.accounts !== 'off' && !account && authMode !== 'guest') {
      setAuthError('');
      const result = await signIn(authMode, { email, password, name });
      if (!result.account) { setAuthError(result.error ?? 'error'); return; }
      setAccount(result.account); setPassword('');
      return enter(result.account.name);
    }
    if (!name.trim()) return;
    enter(name.trim());
  }
  function enter(chosen: string) {
    setName(chosen);
    const name = chosen;
    const saved = readLook(name); setLook(saved);
    localStorage.setItem('office-name', name.trim()); localStorage.setItem('office-color', color); storeKey('key', room, accessKey.trim());
    setProfile({ name: name.trim(), color, avatar: saved, accessKey: accessKey.trim(), adminKey: storedKey('admin', room), sessionToken: sessionToken() });
  }
  function openPanel(value: Panel) { setPanel(old => old === value ? null : value); if (value !== 'build') { setEditItem(null); setSelectedObject(null); } setMoreOpen(false); }
  function saveProfile(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return;
    if (profile) setProfile({ ...profile, name: name.trim(), color, avatar: look }); office.send({ type: 'profile', name: name.trim(), color, avatar: look });
    try { localStorage.setItem(lookStorageKey(name), JSON.stringify(look)); } catch { /* storage unavailable */ }
    localStorage.setItem('office-name', name.trim()); localStorage.setItem('office-color', color); setDialog(null);
  }
  function sendConversation(value: string) {
    if (conversation.kind === 'channel') office.send({ type: 'chat', channel: 'channel', channelId: conversation.id, text: value });
    else if (conversation.kind === 'dm') office.send({ type: 'chat', channel: 'dm', to: conversation.userId, text: value });
    else office.send({ type: 'chat', channel: 'nearby', text: value });
  }
  const inviteLink = () => `${location.origin}/?room=${encodeURIComponent(room)}${profile?.accessKey ? `&key=${encodeURIComponent(profile.accessKey)}` : ''}`;
  function showInvite() { setCopied(false); setDialog('invite'); }
  function searchPeople() { setPanel('people'); setEditItem(null); requestAnimationFrame(() => searchRef.current?.focus()); }
  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink()); setCopied(true); }
    catch { setNotice(t('Selecciona el enlace y cópialo para abrir otra sesión.')); }
  }
  function leave() { media.stop(); setProfile(null); setSelected(null); setMoreOpen(false); }

  const controlBar = (
        <div className="controlbar" aria-label={t('Controles de presencia, audio y vídeo')}>
          {statusMenu && self && <div className="status-menu" role="dialog" aria-label={t('Tu perfil y disponibilidad')}>
            <div className="status-menu-head"><div><strong>{self.name}</strong><span>{self.statusText || STATUS[self.status]}</span></div><button type="button" title={t('Editar perfil')} aria-label={t('Editar perfil')} onClick={() => { setStatusMenu(false); setDialog('profile'); }}><UserPen size={16} /></button></div>
            {account && <button type="button" className="status-menu-signout" onClick={() => { void signOut(); setAccount(null); setStatusMenu(false); leave(); }}>{t('Cerrar sesión')}</button>}
            <div className="status-menu-options">{(['available', 'busy', 'away'] as const).map(status => <button type="button" key={status} className={self.status === status ? `is-active ${status}` : status} aria-pressed={self.status === status} onClick={() => office.send({ type: 'profile', status })}><i className={`status-dot ${status}`} />{STATUS[status]}</button>)}</div>
            <form className="status-menu-text" onSubmit={e => { e.preventDefault(); office.send({ type: 'profile', statusText: statusDraft }); setStatusMenu(false); }}><SmileIcon size={15} /><input value={statusDraft} maxLength={60} placeholder={t('Actualiza tu estado')} aria-label={t('Actualiza tu estado')} onChange={e => setStatusDraft(e.target.value)} />{self.statusText && <button type="button" aria-label={t('Borrar estado')} title={t('Borrar estado')} onClick={() => { office.send({ type: 'profile', statusText: '' }); setStatusDraft(''); }}><X size={14} /></button>}</form>
          </div>}
          <button className="self-button" disabled={!profile} title={t('Tu perfil y disponibilidad')} aria-label={t('Tu perfil y disponibilidad')} aria-expanded={statusMenu} onClick={() => { setStatusDraft(self?.statusText ?? ''); setStatusMenu(open => !open); }}><span className="avatar-wrap"><Avatar person={self || { name: name || 'T', color }} size={32} /><i className={`status-dot ${self?.status || 'away'}`} /></span><ChevronDown size={12} /></button>
          <span className="control-separator" />
          <button className={`media-control ${media.mic ? 'enabled' : 'muted'}`} disabled={!online} onClick={() => void media.toggleMic()} title={media.mic ? t('Silenciar micrófono') : t('Activar micrófono')} aria-label={media.mic ? t('Silenciar micrófono') : t('Activar micrófono')} aria-pressed={media.mic}>{media.mic ? <Mic size={21} /> : <MicOff size={21} />}</button>
          <button className={`media-control ${media.camera ? 'enabled' : 'muted'}`} disabled={!online || media.screen} onClick={() => void media.toggleCamera()} title={media.camera ? t('Apagar cámara') : t('Activar cámara')} aria-label={media.camera ? t('Apagar cámara') : t('Activar cámara')} aria-pressed={media.camera}>{media.camera ? <Video size={22} /> : <VideoOff size={22} />}</button>
          <IconButton label={media.screen ? t('Dejar de compartir') : t('Compartir pantalla')} active={media.screen} disabled={!online} onClick={() => void media.toggleScreen()}><Monitor size={21} /></IconButton>
          <div className="reaction-wrap"><IconButton label={t('Enviar una reacción')} active={reactionMenu} disabled={!online} onClick={() => setReactionMenu(open => !open)}><SmilePlus size={21} /></IconButton>
            {reactionMenu && <div className="reaction-menu" role="menu">{['👍', '❤️', '😂', '🎉', '👏', '😮', '🙌', '🔥'].map(emoji => <button type="button" role="menuitem" key={emoji} onClick={() => { office.send({ type: 'react', emoji }); setReactionMenu(false); }}>{emoji}</button>)}</div>}</div>
          <IconButton label={handRaised ? t('Bajar la mano') : t('Levantar la mano')} active={handRaised} disabled={!online} onClick={() => { const next = !handRaised; setHandRaised(next); office.send({ type: 'profile', handRaised: next }); }}><Hand size={21} /></IconButton>
          {meetingArea && <IconButton label={t('Volver a mi escritorio · ⌘ D')} className="leave-meeting" onClick={leaveMeeting}><LogOut size={20} /></IconButton>}
          <div className="control-more" ref={moreRef}><button className={`icon-button ${moreOpen ? 'is-active' : ''}`} type="button" title={t('Más opciones')} aria-label={t('Más opciones')} aria-expanded={moreOpen} aria-controls="call-options" onClick={() => setMoreOpen(open => !open)}><MoreHorizontal size={22} /></button>
            {moreOpen && <div className="control-menu" id="call-options">
              <div className="nearby-status"><i />{nearby.length ? (nearby.length === 1 ? t('1 persona cerca') : t('{n} personas cerca', { n: nearby.length })) : t('No hay personas cerca')}</div>
              <button disabled={!online} onClick={() => { setPanel('chat'); setConversation({ kind: 'nearby' }); setEditItem(null); setMoreOpen(false); }}><MessageCircle size={17} />{t('Chat cercano')}</button>
              <button disabled={!online} onClick={() => { move(SPAWN.x, SPAWN.y); setMoreOpen(false); }}><ArrowDownLeft size={17} />{t('Volver al lobby')}</button>
              <button onClick={() => { setDialog('help'); setMoreOpen(false); }}><CircleHelp size={17} />{t('Controles y atajos')}</button>
              <button className="leave" disabled={!profile} onClick={leave}><DoorOpen size={17} />{t('Salir de la oficina')}</button>
            </div>}
          </div>
        </div>
  );

  return <div className="app-shell">
    <nav className="rail" aria-label={t('Navegación principal')}>
      <button className="brand" aria-label={t('Open Office — abrir oficina')} title={t('Open Office')} onClick={() => { setPanel('people'); setDialog(null); setEditItem(null); }}><span /><span /><span /><span /></button>
      <button className="rail-search" aria-label={t('Buscar personas')} title={t('Buscar personas · ⌘ / Ctrl K')} onClick={searchPeople}><Search size={20} /><span>⌘ K</span></button>
      <div className="rail-main">
        <button className={`nav-item ${!showMeetingView && (panel === 'people' || panel === null) ? 'current' : ''}`} aria-label={t('Oficina')} aria-pressed={!showMeetingView && panel === 'people'} title={t('Oficina')} onClick={() => { setPanel('people'); setEditItem(null); setMeetingView(false); }}><Map size={22} /></button>
        <button className={`nav-item ${showChatView ? 'current' : ''}`} aria-label={totalUnread ? t('Chat, {n} sin leer', { n: totalUnread }) : t('Chat')} aria-pressed={showChatView} title={t('Chat')} onClick={() => { setMeetingView(false); setPanel(old => old === 'chat' ? 'people' : 'chat'); setEditItem(null); setSelectedObject(null); }}><MessageCircle size={22} />{totalUnread > 0 && <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}</button>
        <button className={`nav-item ${showCalendarView ? 'current' : ''}`} aria-label={t('Calendario')} aria-pressed={showCalendarView} title={t('Calendario')} onClick={() => { setMeetingView(false); setPanel(old => old === 'calendar' ? 'people' : 'calendar'); setEditItem(null); setSelectedObject(null); }}><Calendar size={22} /></button>
        <button className={`nav-item ${showActivityView ? 'current' : ''}`} aria-label={activityUnread ? t('Actividad, {n} sin leer', { n: activityUnread }) : t('Actividad')} aria-pressed={showActivityView} title={t('Actividad')} onClick={() => { setMeetingView(false); setPanel(old => old === 'activity' ? 'people' : 'activity'); setEditItem(null); setSelectedObject(null); }}><Bell size={22} />{activityUnread > 0 && <span className="nav-badge">{activityUnread > 99 ? '99+' : activityUnread}</span>}</button>
        {canEdit && <button className={`nav-item ${panel === 'build' ? 'current' : ''}`} aria-label={t('Decorar')} aria-pressed={panel === 'build'} title={t('Decorar')} onClick={() => openPanel('build')}><Armchair size={22} /></button>}
        {meetingArea && <button className={`nav-item nav-meeting ${showMeetingView ? 'current' : ''}`} aria-label={t('Reunión')} aria-pressed={showMeetingView} title={t('Vista de reunión')} onClick={() => { setMeetingView(true); setMeetingPanel(panel => panel ?? 'chat'); }}><Video size={22} /><span>{t('Reunión')}</span></button>}
      </div>
      <div className="rail-bottom">
        <IconButton label={t('Invitar a la oficina')} onClick={showInvite}><Gift size={21} /></IconButton>
        <IconButton label={t('Ayuda y controles')} onClick={() => setDialog('help')}><CircleHelp size={21} /></IconButton>
        <IconButton label={t('Ajustes')} onClick={() => setDialog('settings')}><Settings2 size={21} /></IconButton>
      </div>
    </nav>
    <div className="workspace">
      {panel && !showMeetingView && <aside className={`side-panel panel-${panel}`} aria-label={panel === 'people' ? t('Personas de la oficina') : panel === 'chat' ? t('Chat') : panel === 'calendar' ? t('Calendario') : panel === 'activity' ? t('Actividad') : panel === 'meeting' ? t('Reunión') : t('Decorador')}>
        <div className="panel-heading"><h1>{panel === 'people' ? t('Vivo') : panel === 'chat' ? t('Chat') : panel === 'calendar' ? t('Calendario') : panel === 'activity' ? t('Actividad') : panel === 'meeting' ? t('Chat de la reunión') : t('Decorador')}</h1>{panel === 'activity' ? <div className="panel-heading-tools activity-tools"><label className="switch"><span>{t('No leídos')}</span><input type="checkbox" role="switch" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /><i /></label><IconButton label={t('Marcar todo como leído')} onClick={() => setActivityRead(read => Object.fromEntries([...Object.keys(read), ...activity.map(item => item.id)].map(id => [id, true as const])))}><CheckCheck size={16} /></IconButton></div> : panel === 'chat' ? <div className="panel-heading-tools"><IconButton label={t('Nuevo mensaje')} onClick={() => setNewDm(true)}><SquarePen size={17} /></IconButton><IconButton label={t('Acerca del chat')} onClick={() => setNotice(t('Los canales y mensajes directos se guardan en esta oficina. «Cerca de ti» no se guarda.'))}><Info size={17} /></IconButton></div> : <IconButton label={t('Contraer panel')} onClick={() => { setPanel(null); setEditItem(null); }}><ChevronsLeft size={18} /></IconButton>}</div>
        {panel === 'people' && <>
          <div className="floor-selector"><Layers size={15} /><span>{t('Piso 1')}</span><ChevronDown size={14} /></div>
          <div className="invite-card"><strong>{t('Comparte tu oficina')}</strong><p>{t('Invita a tus compañeros a trabajar juntos.')}</p><InvitePortraits /><button onClick={showInvite}><Users size={13} />{t('Invitar colaboradores')}</button></div>
          <div className="panel-search"><Search size={16} /><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Buscar personas')} aria-label={t('Buscar personas en la oficina')} /><kbd>⌘ K</kbd></div>
          <div className="section-label"><ChevronDown size={13} />{t('En línea')} <span>({office.participants.length})</span></div>
          <div className="people-list">{visiblePeople.map(p => <button className={`person-row ${selected === p.id ? 'selected' : ''}`} key={p.id} onClick={() => setSelected(p.id)}><span className="avatar-wrap"><Avatar person={p} /><i className={`status-dot ${p.status}`} /></span><div><strong>{p.name}{p.id === office.selfId && <span className="you"> {t('(tú)')}</span>}</strong><span>{p.statusText || STATUS[p.status]}</span></div>{p.mic && <Mic size={14} />}</button>)}{!office.participants.length && <p className="empty-small">{t('Entra para ver quién está en la oficina.')}</p>}{office.participants.length > 0 && !visiblePeople.length && <p className="empty-small">{t('No hay personas con ese nombre.')}</p>}</div>
          <details className="office-places"><summary><Layers size={15} />{t('Explorar la oficina')}<ChevronDown size={13} /></summary>
            <button className="area-row" disabled={!online} onClick={() => move(1008, 848)}><Monitor size={16} /><span>{t('Team')}</span><ArrowRight size={14} /></button>
            <button className="area-row" disabled={!online} onClick={() => move(1104, 1200)}><Users size={16} /><span>{t('Media room')}</span><ArrowRight size={14} /></button>
            <button className="area-row" disabled={!online} onClick={() => move(SPAWN.x, SPAWN.y)}><Coffee size={16} /><span>{t('Lobby')}</span><ArrowRight size={14} /></button>
          </details>
          <div className="sidebar-foot"><span className={`connection ${online ? 'connected' : ''}`}><i />{online ? t('Conectado') : profile ? t('Conectando…') : t('Sin conexión')}</span><span>{t('Open Office')}</span></div>
        </>}
        {panel === 'meeting' && meetingArea && <>
          <div className="meeting-summary"><span className="meeting-pill"><Users size={14} />{roomLabel(meetingArea.id)}</span><span className="muted">{meeting?.locked ? <><Lock size={12} /> {t('Privada')}</> : <><LockOpen size={12} /> {t('Abierta: otras personas pueden unirse')}</>}</span></div>
          <div className="chat-history">{meetingMessages.map(message => message.system ? <div className="message-system" key={message.id}><strong>{message.name}</strong> {t(message.text)}</div> : <div className={`message ${message.participantId === office.selfId ? 'own' : ''}`} key={message.id}><div><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></div>)}<div ref={messageEnd} /></div>
          <form className="chat-compose" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; office.send({ type: 'chat', channel: 'meeting', text: text.trim() }); setText(''); }}><input aria-label={t('Mensaje a {name}', { name: roomLabel(meetingArea.id) })} value={text} onChange={e => setText(e.target.value)} placeholder={t('Mensaje a {name}', { name: roomLabel(meetingArea.id) })} maxLength={1000} disabled={!online} /><button className="icon-button" type="submit" title={t('Enviar mensaje')} aria-label={t('Enviar mensaje')} disabled={!online || !text.trim()}><Send size={18} /></button></form>
        </>}
        {panel === 'chat' && <div className="chat-sidebar">
          <div className="invite-card"><strong>{t('Comparte tu oficina')}</strong><p>{t('Invita a tus compañeros a trabajar juntos.')}</p><InvitePortraits /><button onClick={showInvite}><Users size={13} />{t('Invitar colaboradores')}</button></div>
          <div className="panel-search"><Search size={16} /><input value={chatQuery} onChange={e => setChatQuery(e.target.value)} placeholder={t('Buscar o navegar…')} aria-label={t('Buscar canales y personas')} /><kbd>⌘ F</kbd></div>
          <button type="button" className={`chat-nav-row${conversation.kind === 'nearby' ? ' is-active' : ''}`} onClick={() => setConversation({ kind: 'nearby' })}><Radio size={16} /><span>{t('Cerca de ti')}</span>{unread('nearby') > 0 && <b className="chat-unread">{unread('nearby')}</b>}</button>
          <button type="button" className="chat-nav-row" onClick={() => { const key = Object.keys(drafts).find(candidate => drafts[candidate]?.trim()); if (!key) { setNotice(t('No tienes borradores.')); return; } if (key.startsWith('channel:')) setConversation({ kind: 'channel', id: key.slice(8) }); else if (key.startsWith('dm:')) setConversation({ kind: 'dm', userId: key.split(':').slice(1).find(id => id !== office.userId) ?? office.userId }); else setConversation({ kind: 'nearby' }); }}><Send size={16} /><span>{t('Borradores')}</span>{Object.values(drafts).filter(value => value.trim()).length > 0 && <em>{Object.values(drafts).filter(value => value.trim()).length}</em>}</button>
          <div className="chat-section"><button type="button" className="chat-section-toggle" aria-expanded={sections.channels} onClick={() => setSections(value => ({ ...value, channels: !value.channels }))}>{t('Canales')}<ChevronDown size={13} /></button><button type="button" className="chat-section-add" aria-label={t('Crear canal')} title={t('Crear canal')} onClick={() => setNewChannel({ name: '', topic: '' })}><Plus size={14} /></button></div>
          {sections.channels && office.channels.filter(channel => !chatQuery || channel.name.includes(chatQuery.toLowerCase())).map(channel => { const key = `channel:${channel.id}`; const count = unread(key); const mention = office.messages.some(message => messageKey(message) === key && message.userId !== office.userId && message.createdAt > (lastRead[key] ?? '') && mentionsMe(message)); return <button type="button" key={channel.id} className={`chat-nav-row${activeKey === key ? ' is-active' : ''}${count ? ' is-unread' : ''}`} onClick={() => setConversation({ kind: 'channel', id: channel.id })}><Hash size={16} /><span>{channel.name}</span>{drafts[key]?.trim() && activeKey !== key && <Send size={12} className="chat-draft-mark" />}{count > 0 && <b className={`chat-unread${mention ? ' is-mention' : ''}`}>{mention ? '@' : count}</b>}</button>; })}
          <div className="chat-section"><button type="button" className="chat-section-toggle" aria-expanded={sections.dms} onClick={() => setSections(value => ({ ...value, dms: !value.dms }))}>{t('Mensajes directos')}<ChevronDown size={13} /></button><button type="button" className="chat-section-add" aria-label={t('Nuevo mensaje directo')} title={t('Nuevo mensaje directo')} onClick={() => setNewDm(true)}><Plus size={14} /></button></div>
          {sections.dms && [...office.users].sort((a, b) => (a.userId === office.userId ? -1 : b.userId === office.userId ? 1 : a.name.localeCompare(b.name))).filter(user => !chatQuery || user.name.toLowerCase().includes(chatQuery.toLowerCase())).map(user => { const key = `dm:${[office.userId, user.userId].sort().join(':')}`; const count = unread(key); return <button type="button" key={user.userId} className={`chat-nav-row dm${activeKey === key ? ' is-active' : ''}${count ? ' is-unread' : ''}`} onClick={() => setConversation({ kind: 'dm', userId: user.userId })}><span className="chat-avatar small" style={{ background: user.color }}>{user.name.charAt(0).toUpperCase()}<i className={`status-dot ${onlineUsers.has(user.userId) ? 'available' : 'away'}`} /></span><span>{user.name}{user.userId === office.userId && <span className="you"> {t('(tú)')}</span>}</span>{count > 0 && <b className="chat-unread">{count}</b>}</button>; })}
        </div>}
        {panel === 'calendar' && <div className="chat-sidebar">
          <div className="invite-card"><strong>{t('Comparte tu oficina')}</strong><p>{t('Invita a tus compañeros a trabajar juntos.')}</p><InvitePortraits /><button onClick={showInvite}><Users size={13} />{t('Invitar colaboradores')}</button></div>
          <div className="panel-search"><Search size={16} /><input value={eventQuery} onChange={e => setEventQuery(e.target.value)} placeholder={t('Buscar reuniones')} aria-label={t('Buscar reuniones')} /><kbd>⌘ F</kbd></div>
          <div className="calendar-tabs" role="tablist"><button role="tab" aria-selected={calendarTab === 'scheduled'} className={calendarTab === 'scheduled' ? 'is-active' : ''} onClick={() => setCalendarTab('scheduled')}>{t('Programadas')}</button><button role="tab" aria-selected={calendarTab === 'notes'} className={calendarTab === 'notes' ? 'is-active' : ''} onClick={() => setCalendarTab('notes')}>{t('Notas de reunión')}</button></div>
          {calendarTab === 'scheduled' ? <>
            <span className="calendar-list-label">{t('Hoy')}</span>
            <div className="calendar-list">{todayEvents.map((event, index) => <div key={event.id}>{index === todayEvents.findIndex(item => Date.parse(item.end) > clock) && <i className="calendar-list-now" />}<button type="button" className={`calendar-card${Date.parse(event.end) < clock ? ' is-past' : ''}`} onClick={() => setSelectedEvent(event.id)}><strong>{event.title}</strong><span>{timeRange(event)}{event.areaId ? ` · ${roomLabel(event.areaId)}` : ''}</span></button></div>)}{todayEvents.length > 0 && todayEvents.every(item => Date.parse(item.end) <= clock) && <i className="calendar-list-now" />}{!todayEvents.length && <p className="empty-small">{t('No hay reuniones hoy.')}</p>}</div>
            {upcomingEvents.length > 0 && <><span className="calendar-list-label">{t('Próximas')}</span><div className="calendar-list">{upcomingEvents.map(event => <button type="button" key={event.id} className="calendar-card" onClick={() => setSelectedEvent(event.id)}><strong>{event.title}</strong><span>{new Date(event.start).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric' })} · {timeRange(event)}</span></button>)}</div></>}
          </> : <p className="empty-small">{t('Las notas de reunión aparecerán aquí cuando se graben reuniones. La grabación todavía no está disponible.')}</p>}
        </div>}
        {panel === 'activity' && <div className="chat-sidebar">
          <div className="invite-card"><strong>{t('Comparte tu oficina')}</strong><p>{t('Invita a tus compañeros a trabajar juntos.')}</p><InvitePortraits /><button onClick={showInvite}><Users size={13} />{t('Invitar colaboradores')}</button></div>
          <div className="activity-list">{visibleActivity.map(item => <button type="button" key={item.id} className="activity-item" onClick={() => openActivity(item)}><span className={`activity-icon ${item.kind}`}>{item.kind === 'mention' ? <AtSign size={20} /> : item.kind === 'dm' ? <MessageCircle size={20} /> : item.kind === 'tip' ? <Bell size={20} /> : <Calendar size={20} />}</span><span className="activity-text"><strong>{item.title}</strong><span>{item.body}</span></span>{!activityRead[item.id] && <i className="activity-dot" />}</button>)}{!visibleActivity.length && <p className="empty-small">{t('Estás al día.')}</p>}</div>
        </div>}
        {panel === 'build' && <>
          <div className="panel-search"><Search size={16} /><input value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} placeholder={t('Buscar una decoración')} aria-label={t('Buscar en el catálogo')} /></div>
          <div className="history-buttons"><button type="button" className="secondary" disabled={!editHistory.canUndo} title={t('Deshacer (⌘ Z)')} onClick={() => { editHistory.undo(); setSelectedObject(null); }}><Undo2 size={15} />{t('Deshacer')}</button><button type="button" className="secondary" disabled={!editHistory.canRedo} title={t('Rehacer (⌘ ⇧ Z)')} onClick={() => { editHistory.redo(); setSelectedObject(null); }}><Redo2 size={15} />{t('Rehacer')}</button></div>
          <p className="panel-description">{editItem ? t('Clic en la oficina para colocar · R gira · Esc termina') : selectedObject ? t('Arrastra para mover · R gira · Suprimir elimina · Esc deselecciona') : t('Elige un objeto del catálogo, o haz clic en uno del mapa para moverlo, girarlo o eliminarlo. Mientras editas no puedes caminar.')}</p>
          {editItem && <div className="edit-toolbar"><ObjectThumb item={editItem} size={44} /><div><strong>{editItem.kind.replace(/-/g, ' ')}</strong><span>{editItem.color} · {editItem.facing}</span></div><IconButton label={t('Girar (R)')} onClick={rotateEditItem}><RotateCw size={16} /></IconButton><IconButton label={t('Terminar')} onClick={() => setEditItem(null)}><X size={16} /></IconButton></div>}
          {selectedObject && !editItem && <div className="edit-toolbar"><div><strong>{t('Objeto seleccionado')}</strong><span>{(office.objects.find(o => o.id === selectedObject)?.kind ?? baseObject(selectedObject)?.kind ?? '').replace(/-/g, ' ')}</span></div><IconButton label={t('Girar (R)')} onClick={rotateSelected}><RotateCw size={16} /></IconButton><IconButton label={t('Eliminar')} onClick={() => { remove(selectedObject); setSelectedObject(null); }}><Trash2 size={16} /></IconButton></div>}
          <div className="catalog-list">{Object.entries(Object.values(CATALOG).filter(entry => !catalogQuery || `${entry.family} ${entry.kind} ${entry.color}`.toLowerCase().includes(catalogQuery.toLowerCase())).reduce<Record<string, typeof CATALOG[string][]>>((groups, entry) => { (groups[entry.family] ??= []).push(entry); return groups; }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([family, entries]) => <section key={family}><h3>{family}</h3><div className="catalog-grid">{entries.map(entry => { const facing = Object.keys(entry.facings)[0]; const active = editItem?.kind === entry.kind && editItem.color === entry.color; return <button key={`${entry.kind}/${entry.color}`} disabled={!online} className={active ? 'selected' : ''} aria-pressed={active} title={`${entry.kind.replace(/-/g, ' ')} · ${entry.color}`} onClick={() => { setSelectedObject(null); setEditItem(active ? null : { kind: entry.kind, color: entry.color, facing }); }}><ObjectThumb item={{ kind: entry.kind, color: entry.color, facing }} size={48} /><span>{entry.kind.replace(/-/g, ' ')}</span></button>; })}</div></section>)}</div>
          <div className="section-label">{t('Objetos colocados')} <span>({office.objects.length})</span></div>
          <p className="save-hint"><Check size={14} /> {t('Los cambios se guardan en esta oficina.')}</p>
          <button className="primary exit-edit-button" type="button" onClick={() => { setEditItem(null); setSelectedObject(null); setPanel('people'); }}><DoorOpen size={16} />{t('Salir del modo edición')}</button>
        </>}
        {pageView && <MiniOffice label={whereAmI} participants={office.participants} selfId={office.selfId} onOpen={() => setPanel('people')}>{controlBar}</MiniOffice>}
      </aside>}
      <main className={`map-area${showMeetingView ? ' is-meeting-view' : ''}${pageView ? ' is-chat-view' : ''}`} aria-label={showMeetingView ? t('Vista de reunión') : t('Oficina Vivo')}>
        <VivoScene participants={office.participants} selfId={office.selfId} objects={office.objects} overrides={office.overrides} editorOpen={panel === 'build'} zoom={zoom} simplified={simplified} editItem={editItem} selectedObject={selectedObject} navigationTarget={navigationTarget} resetViewKey={resetViewKey} onMove={publishMove} onPlace={place} onSelect={setSelected} onSelectObject={setSelectedObject} onMoveObject={moveObject} onRemove={remove} onSit={id => office.send({ type: 'seat:sit', seatId: id })} onStand={() => office.send({ type: 'seat:stand' })} meetings={office.meetings} areaNames={office.areaNames} reactions={office.reactions} seatTarget={seatTarget} onAreaClick={id => { setAreaCard(id); setRenaming(null); setSelected(null); }} />
        {meetingArea && <div className="meeting-bar" aria-label={t('Reunión en curso')}>
          <div className="meeting-bar-left"><span className="meeting-pill"><Users size={15} />{roomLabel(meetingArea.id)}</span><button type="button" className={`meeting-lock ${meeting?.locked ? 'is-locked' : ''}`} title={meeting?.locked ? t('Desbloquear reunión') : t('Bloquear reunión')} aria-label={meeting?.locked ? t('Desbloquear reunión') : t('Bloquear reunión')} aria-pressed={!!meeting?.locked} onClick={() => office.send({ type: 'meeting:lock', areaId: meetingArea.id, locked: !meeting?.locked })}>{meeting?.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button></div>
          <div className="meeting-bar-right"><button type="button" className="meeting-tool" title={t('Copiar enlace de la reunión')} aria-label={t('Copiar enlace de la reunión')} onClick={() => void copyMeetingLink(meetingArea.id)}><Link2 size={15} /></button><div className="meeting-view-toggle" role="group" aria-label="Vista"><button type="button" className={!showMeetingView ? 'is-active' : ''} aria-pressed={!showMeetingView} title={t('Vista de oficina')} aria-label={t('Vista de oficina')} onClick={() => setMeetingView(false)}><Map size={14} /></button><button type="button" className={showMeetingView ? 'is-active' : ''} aria-pressed={showMeetingView} title={t('Vista de reunión')} aria-label={t('Vista de reunión')} onClick={() => { setMeetingView(true); setMeetingPanel(panel => panel ?? 'chat'); }}><LayoutGrid size={14} /></button></div></div>
        </div>}
        {showMeetingView && meetingArea && <MeetingView reactions={office.reactions} roomName={roomLabel(meetingArea.id)} meeting={meeting} people={meetingPeople} selfId={office.selfId} localStream={media.localStream} remoteStreams={media.remoteStreams} messages={meetingMessages} panel={meetingPanel} online={online} onPanel={setMeetingPanel} onSend={value => office.send({ type: 'chat', text: value, channel: 'meeting' })} onCopyLink={() => void copyMeetingLink(meetingArea.id)} />}
        {showCalendarView && <CalendarView events={office.events} roomName={roomLabel} selfUserId={office.userId} selected={selectedEvent} online={online} onSelect={setSelectedEvent} onNew={openNewEvent} onJoin={areaId => { setSelectedEvent(null); setPanel('people'); joinMeeting(areaId); }} onDelete={id => { office.send({ type: 'event:delete', id }); setSelectedEvent(null); }} />}
        {showActivityView && <section className="activity-view" aria-label={t('Actividad')}><div><svg viewBox="0 0 22 16" width="76" height="56" shapeRendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="22" height="16" fill="#8a96a8" /><rect x="1" y="1" width="20" height="14" fill="#d79a68" /><rect x="2" y="2" width="4" height="5" fill="#f1f3f6" /><rect x="7" y="2" width="3" height="3" fill="#59b06a" /><rect x="11" y="3" width="3" height="3" fill="#4b8fd9" /><rect x="15" y="2" width="5" height="4" fill="#f1f3f6" /><rect x="15" y="3" width="5" height="1" fill="#4b8fd9" /><rect x="3" y="9" width="5" height="4" fill="#f1f3f6" /><rect x="10" y="8" width="3" height="3" fill="#e8607a" /><rect x="14" y="9" width="4" height="4" fill="#f5d56d" /></svg><p>{t('Tu centro de actividad de la oficina')}</p></div></section>}
        {showChatView && <ChatView conversation={conversation} channels={office.channels} users={office.users} participants={office.participants} selfUserId={office.userId} messages={conversationMessages} online={online} draft={drafts[activeKey] ?? ''} onDraft={value => setDrafts(old => ({ ...old, [activeKey]: value }))} onSend={sendConversation} onTopic={(channelId, topic) => office.send({ type: 'channel:update', channelId, topic })} />}
        {cardArea && !showMeetingView && !pageView && <div className="area-card" role="dialog" aria-label={t('Sala {name}', { name: roomLabel(cardArea.id) })}>
          <div className="area-card-head"><span className="area-card-icon"><Users size={14} /></span><div>{renaming === cardArea.id ? <form className="area-rename" onSubmit={e => { e.preventDefault(); if (roomName.trim()) office.send({ type: 'area:rename', areaId: cardArea.id, name: roomName.trim() }); setRenaming(null); }}><input autoFocus value={roomName} maxLength={40} aria-label={t('Nombre de la sala')} onChange={e => setRoomName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} /><button className="primary" type="submit">{t('Guardar')}</button></form> : <><strong>{roomLabel(cardArea.id)}</strong><span>{t('Sala de reunión')}{cardMeeting?.active ? t(' · {n} en reunión', { n: cardMeeting.participants }) : ''}{cardMeeting?.locked ? t(' · privada') : ''}</span></>}</div><IconButton label={t('Cerrar')} className="area-card-close" onClick={() => { setAreaCard(null); setRenaming(null); }}><X size={15} /></IconButton></div>
          <div className="area-card-actions"><button className="primary area-card-go" disabled={!online || !!cardMeeting?.locked} onClick={() => joinMeeting(cardArea.id)}><Video size={15} />{cardMeeting?.locked ? t('Reunión privada') : cardMeeting?.active ? t('Unirse a la reunión') : t('Iniciar reunión')}</button><button type="button" className="area-card-tool" title={t('Copiar enlace de la reunión')} aria-label={t('Copiar enlace de la reunión')} onClick={() => void copyMeetingLink(cardArea.id)}><Link2 size={15} /></button><button type="button" className="area-card-tool" title={t('Cambiar el nombre de la sala')} aria-label={t('Cambiar el nombre de la sala')} onClick={() => { setRoomName(roomLabel(cardArea.id)); setRenaming(cardArea.id); }}><Pencil size={15} /></button></div>
        </div>}
        {!online && profile && <div className="connection-banner" role="status">{t('Reconectando a la oficina…')}</div>}
        {panel === 'build' && <div className="edit-banner"><Sparkles size={16} /><span>{editItem ? t('Clic para colocar · R gira · Esc termina') : t('Modo edición · arrastra para mover · R gira · Suprimir elimina')}</span><button type="button" className="edit-exit" disabled={!editHistory.canUndo} aria-label={t('Deshacer (⌘ Z)')} title={t('Deshacer (⌘ Z)')} onClick={() => { editHistory.undo(); setSelectedObject(null); }}><Undo2 size={14} /></button><button type="button" className="edit-exit" disabled={!editHistory.canRedo} aria-label={t('Rehacer (⌘ ⇧ Z)')} title={t('Rehacer (⌘ ⇧ Z)')} onClick={() => { editHistory.redo(); setSelectedObject(null); }}><Redo2 size={14} /></button><button type="button" className="edit-exit" onClick={() => { setEditItem(null); setSelectedObject(null); setPanel('people'); }}><DoorOpen size={14} />{t('Salir de edición')}</button></div>}
        {selectedPerson && <div className="person-popover"><IconButton label={t('Cerrar perfil')} className="close-profile" onClick={() => setSelected(null)}><X size={15} /></IconButton><Avatar person={selectedPerson} size={54} /><h2>{selectedPerson.name}</h2><span className="muted">{STATUS[selectedPerson.status]}</span><div>{selectedPerson.id === office.selfId ? <button className="secondary" onClick={() => { setDialog('profile'); setSelected(null); }}>{t('Editar perfil')}</button> : <button className="primary" onClick={() => { move(selectedPerson.x - 32, selectedPerson.y); setSelected(null); }}>Acercarme <ArrowRight size={15} /></button>}</div></div>}
        {!showMeetingView && (media.localStream || Object.keys(media.remoteStreams).length > 0) && <div className="video-strip">{media.localStream && <div className="video-tile"><StreamVideo stream={media.localStream} muted /><span>{self?.name} · Tú</span></div>}{Object.entries(media.remoteStreams).map(([id, stream]) => <div className="video-tile" key={id}><StreamVideo stream={stream} /><span>{office.participants.find(p => p.id === id)?.name || t('Participante')}</span></div>)}</div>}
        {!showMeetingView && !pageView && <div className="zoom-controls" aria-label={t('Controles del mapa')}>
          <IconButton label="Acercar" disabled={zoom >= 4} onClick={() => setZoom(v => Math.min(4, Math.round(v * 1.25 * 100) / 100))}><Plus size={19} /></IconButton>
          <IconButton label="Alejar" disabled={zoom <= .36} onClick={() => setZoom(v => Math.max(.36, Math.round(v / 1.25 * 100) / 100))}><Minus size={19} /></IconButton>
          <span className="zoom-readout" aria-live="polite">{Math.round(zoom * 100)}%</span><span className="divider" />
          <IconButton label={t('Centrar vista')} onClick={() => { setZoom(1.35); setResetViewKey(key => key + 1); }}><LocateFixed size={18} /></IconButton>
          <IconButton label={simplified ? t('Ver oficina completa') : t('Simplificar el mapa')} active={simplified} onClick={() => setSimplified(!simplified)}><Layers size={18} /></IconButton>
        </div>}
        {!pageView && controlBar}
      </main>
    </div>
    {newChannel && <div className="modal-backdrop" onClick={() => setNewChannel(null)}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="channel-title" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (!newChannel.name.trim()) return; office.send({ type: 'channel:create', name: newChannel.name, topic: newChannel.topic }); setNewChannel(null); }}><IconButton label={t('Cerrar ventana')} className="modal-close" onClick={() => setNewChannel(null)}><X size={19} /></IconButton><span className="dialog-icon"><Hash size={27} /></span><h2 id="channel-title">{t('Crear un canal')}</h2><p>{t('Los canales reúnen las conversaciones de un tema o equipo. Todos en la oficina pueden verlos.')}</p><label>{t('Nombre')}<input autoFocus value={newChannel.name} maxLength={40} placeholder={t('p. ej. diseño')} onChange={e => setNewChannel({ ...newChannel, name: e.target.value })} required /></label><label>{t('Descripción (opcional)')}<input value={newChannel.topic} maxLength={160} placeholder={t('¿De qué trata este canal?')} onChange={e => setNewChannel({ ...newChannel, topic: e.target.value })} /></label><button className="primary enter-button" type="submit" disabled={!online}>{t('Crear canal')}</button></form></div>}
    {newEvent && <div className="modal-backdrop" onClick={() => setNewEvent(null)}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); const start = new Date(`${newEvent.date}T${newEvent.start}`), end = new Date(`${newEvent.date}T${newEvent.end}`); if (end <= start) { setNotice(t('La reunión debe terminar después de empezar.')); return; } office.send({ type: 'event:create', title: newEvent.title, description: newEvent.description, start: start.toISOString(), end: end.toISOString(), areaId: newEvent.areaId || null }); setNewEvent(null); }}><IconButton label={t('Cerrar ventana')} className="modal-close" onClick={() => setNewEvent(null)}><X size={19} /></IconButton><span className="dialog-icon"><Calendar size={27} /></span><h2 id="event-title">{t('Nueva reunión')}</h2><p>{t('Todos en la oficina verán la reunión en su calendario.')}</p><label>{t('Título')}<input autoFocus required maxLength={120} value={newEvent.title} placeholder={t('p. ej. Planeación semanal')} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} /></label><div className="field-row"><label>{t('Fecha')}<input type="date" required value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} /></label><label>{t('Inicio')}<input type="time" required value={newEvent.start} onChange={e => setNewEvent({ ...newEvent, start: e.target.value })} /></label><label>{t('Fin')}<input type="time" required value={newEvent.end} onChange={e => setNewEvent({ ...newEvent, end: e.target.value })} /></label></div><label>{t('Sala')}<select value={newEvent.areaId} onChange={e => setNewEvent({ ...newEvent, areaId: e.target.value })}>{MEETING_ROOMS.map(area => <option key={area.id} value={area.id}>{roomLabel(area.id)}</option>)}<option value="">{t('Sin sala')}</option></select></label><label>{t('Descripción (opcional)')}<input maxLength={1000} value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} /></label><button className="primary enter-button" type="submit" disabled={!online}>{t('Programar reunión')}</button></form></div>}
    {newDm && <div className="modal-backdrop" onClick={() => setNewDm(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dm-title" onClick={e => e.stopPropagation()}><IconButton label={t('Cerrar ventana')} className="modal-close" onClick={() => setNewDm(false)}><X size={19} /></IconButton><span className="dialog-icon"><SquarePen size={27} /></span><h2 id="dm-title">{t('Nuevo mensaje')}</h2><p>{t('Elige con quién quieres hablar.')}</p><div className="dm-picker">{office.users.map(user => <button type="button" key={user.userId} onClick={() => { setConversation({ kind: 'dm', userId: user.userId }); setPanel('chat'); setNewDm(false); }}><span className="chat-avatar small" style={{ background: user.color }}>{user.name.charAt(0).toUpperCase()}<i className={`status-dot ${onlineUsers.has(user.userId) ? 'available' : 'away'}`} /></span><span>{user.name}{user.userId === office.userId ? t(' (tú)') : ''}</span></button>)}</div></div></div>}
    {lookEditor && <AvatarEditor initial={look} name={name} onCancel={() => setLookEditor(false)} onDone={value => { setLook(value); setLookEditor(false); try { localStorage.setItem(lookStorageKey(name), JSON.stringify(value)); } catch { /* storage unavailable */ } if (profile) { setProfile({ ...profile, avatar: value }); office.send({ type: 'profile', avatar: value }); } }} />}
    {(notice || office.error) && <div className="toast" role="status"><span>{notice || office.error}</span><IconButton label={t('Cerrar aviso')} onClick={() => { setNotice(''); office.setError(''); }}><X size={15} /></IconButton></div>}
    {!profile && <div className="modal-backdrop welcome-backdrop"><form className="modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onSubmit={join}><div className="welcome-art"><InvitePortraits /></div><span className="eyebrow">{t('OPEN OFFICE')}</span><h1 id="welcome-title">{t('Entrar a Vivo')}</h1><p>{t('Tu equipo y tus conversaciones, en un mismo lugar.')}</p>{config.accounts !== 'off' && !account && <div className="segmented auth-tabs">{(['login', 'register'] as const).map(mode => <button type="button" key={mode} className={authMode === mode ? 'active' : ''} onClick={() => { setAuthMode(mode); setAuthError(''); }}>{mode === 'login' ? t('Iniciar sesión') : t('Crear cuenta')}</button>)}{config.accounts === 'optional' && <button type="button" className={authMode === 'guest' ? 'active' : ''} onClick={() => { setAuthMode('guest'); setAuthError(''); }}>{t('Invitado')}</button>}</div>}
{account ? <p className="auth-signed">{t('Sesión iniciada como {email}', { email: account.email })} · <button type="button" className="link-button" onClick={() => { void signOut(); setAccount(null); }}>{t('Cerrar sesión')}</button></p>
  : config.accounts !== 'off' && authMode !== 'guest' ? <>{authMode === 'register' && <label>{t('Tu nombre')}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('¿Cómo te llamas?')} maxLength={40} required /></label>}<label>{t('Correo electrónico')}<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoFocus={authMode === 'login'} /></label><label>{t('Contraseña')}<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={200} /></label></>
  : <label>{t('Tu nombre')}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('¿Cómo te llamas?')} maxLength={40} required /></label>}
{authError && <p className="form-error" role="alert">{authError === 'invalid_credentials' ? t('El correo o la contraseña no son correctos.') : authError === 'email_taken' ? t('Ya existe una cuenta con ese correo.') : authError === 'weak_password' ? t('La contraseña debe tener al menos 8 caracteres.') : authError === 'invalid_email' ? t('Escribe un correo válido.') : authError === 'too_many_attempts' ? t('Demasiados intentos. Espera un momento.') : authError === 'login_required' ? t('Esta oficina pide iniciar sesión.') : t('No se pudo iniciar sesión.')}</p>}{(config.accessRequired || office.accessDenied) && <label>{t('Clave de invitación')}<input type="password" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder={t('La recibiste con el enlace de la oficina')} maxLength={200} required autoComplete="off" /></label>}{office.accessDenied && <p className="form-error" role="alert">{t('La clave de invitación no es válida.')}</p>}<div className="color-picker" aria-label={t('Color del avatar')}>{COLORS.map(c => <button type="button" key={c} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} className={color === c ? 'selected' : ''} onClick={() => setColor(c)}>{color === c && <Check size={17} />}</button>)}</div><button className="primary enter-button" type="submit">{config.accounts !== 'off' && !account && authMode !== 'guest' ? (authMode === 'login' ? t('Iniciar sesión y entrar') : t('Crear cuenta y entrar')) : account ? t('Continuar como {name}', { name: account.name }) : t('Entrar a la oficina')} <ArrowRight size={18} /></button><span className="privacy-note"><MicOff size={13} /><VideoOff size={14} />{t('Micrófono y cámara apagados al entrar')}</span></form></div>}
    {dialog && profile && <div className="modal-backdrop" onClick={() => setDialog(null)}><div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}><IconButton label={t('Cerrar ventana')} className="modal-close" onClick={() => setDialog(null)}><X size={19} /></IconButton>
      {dialog === 'profile' ? <form onSubmit={saveProfile} className="profile-form"><h2 id="dialog-title">{t('Editar perfil')}</h2>
        <div className="profile-pictures">
          <div><span>{t('Foto de perfil')}</span><button type="button" className="profile-picture" aria-label={t('Cambiar el color de la foto de perfil')} onClick={() => setColorPicker(open => !open)}><Avatar person={{ name: name || 'T', color }} size={88} /><i><PencilIcon size={14} /></i></button></div>
          <div><span>{t('Avatar')}</span><button type="button" className="profile-picture" aria-label={t('Editar avatar')} onClick={() => setLookEditor(true)}><AvatarPortrait look={look} size={88} /><i><PencilIcon size={14} /></i></button></div>
        </div>
        {colorPicker && <div className="color-picker">{COLORS.map(c => <button type="button" key={c} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} className={color === c ? 'selected' : ''} onClick={() => setColor(c)}>{color === c && <Check size={17} />}</button>)}</div>}
        <label>{t('Nombre completo')}<span className="required">*</span><input value={name} onChange={e => setName(e.target.value)} required maxLength={40} placeholder={t('p. ej. Ana Pérez')} /></label>
        <div className="profile-actions"><button className="primary" type="submit">{t('Guardar')}</button></div></form>
        : dialog === 'invite' ? <><span className="dialog-icon"><Users size={27} /></span><h2 id="dialog-title">{t('Invitar colaboradores')}</h2><p>{isLocalHost ? t('Abre este enlace en otra pestaña de este computador para compartir la oficina.') : t('Comparte este enlace con tu equipo para que entre a la oficina.')}</p><label>{t('Enlace de la oficina')}<input readOnly value={inviteLink()} onFocus={e => e.target.select()} /></label><button className="primary enter-button" onClick={() => void copyLink()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? t('Enlace copiado') : t('Copiar enlace')}</button>{isLocalHost ? <p className="footnote">{t('Esta oficina se ejecuta en tu computador. El acceso desde otros equipos necesita configurar un servidor.')}</p> : config.accessRequired ? <p className="footnote">{t('El enlace incluye la clave de invitación: compártelo solo con tu equipo.')}</p> : null}</>
          : dialog === 'settings' ? <><span className="dialog-icon"><Settings2 size={27} /></span><h2 id="dialog-title">{t('Apariencia')}</h2><p>{t('Elige cómo se ve la interfaz de tu oficina.')}</p><label>{t('Tema')}<select value={theme} onChange={e => setTheme(e.target.value as Theme)}><option value="system">{t('Sistema')}</option><option value="light">{t('Claro')}</option><option value="dark">{t('Oscuro')}</option></select></label><label>{t('Idioma')}<select value={lang} onChange={e => setLanguage(e.target.value as Language)}>{LANGUAGES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>{t('Arte del mapa')}<select value={art} onChange={e => setArtPack(e.target.value as ArtPack)}><option value="reference">{t('Referencia (idéntico a Gather)')}</option><option value="original">{t('Original (libre para redistribuir)')}</option></select></label><p className="footnote">{t('La opción Sistema se adapta a la apariencia de tu computador.')}</p><button className="primary enter-button" onClick={() => setDialog(null)}>{t('Listo')}</button></>
            : <><span className="dialog-icon"><CircleHelp size={27} /></span><h2 id="dialog-title">{t('Controles de la oficina')}</h2><p>{t('Acércate a tus compañeros para conversar.')}</p><div className="shortcuts"><div><span>{t('Caminar')}</span><kbd>↑ ↓ ← → / WASD</kbd></div><div><span>{t('Caminar más rápido')}</span><kbd>{t('Shift + flechas')}</kbd></div><div><span>{t('Ir a un lugar')}</span><kbd>{t('Doble clic')}</kbd></div><div><span>{t('Sentarse / levantarse')}</span><kbd>{t('Clic en silla / E')}</kbd></div><div><span>{t('Explorar el mapa')}</span><kbd>Arrastrar</kbd></div><div><span>{t('Buscar personas')}</span><kbd>⌘ / Ctrl + K</kbd></div><div><span>{t('Volver al área de trabajo')}</span><kbd>⌘ / Ctrl + D</kbd></div></div><button className="primary enter-button" onClick={() => setDialog(null)}>{t('Entendido')}</button></>}
    </div></div>}
  </div>;
}
