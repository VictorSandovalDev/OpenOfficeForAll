import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AtSign, Info, Link2, MessageCircle, MicOff, Paperclip, Send, Smile, UserPlus, Users, X } from 'lucide-react';
import type { ChatMessage, MeetingState, Participant } from './types';

export type MeetingPanel = 'chat' | 'people' | 'details' | null;

type Props = {
  roomName: string;
  meeting: MeetingState | undefined;
  people: Participant[];
  selfId: string | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  messages: ChatMessage[];
  panel: MeetingPanel;
  online: boolean;
  onPanel: (panel: MeetingPanel) => void;
  onSend: (text: string) => void;
  onCopyLink: () => void;
};

function StreamVideo({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); } }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/** Relative start time as the reference shows it ("Started Just now", "Started 5 min ago"). */
function startedLabel(startedAt: number | undefined, now: number) {
  if (!startedAt) return 'Iniciada hace un momento';
  const minutes = Math.floor((now - startedAt) / 60_000);
  if (minutes < 1) return 'Iniciada hace un momento';
  if (minutes < 60) return `Iniciada hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Iniciada hace ${hours} h ${minutes % 60} min`;
}

/** One participant tile: their camera, or their initial on a coloured disc when the camera is off. */
function Tile({ person, stream, self }: { person: Participant; stream?: MediaStream; self: boolean }) {
  // Peers always negotiate a video transceiver; only a participant with the camera (or a screen) on has a picture.
  const video = !!stream && (person.camera || person.screen) && stream.getVideoTracks().some(track => track.readyState === 'live');
  return <div className={`meeting-tile${video ? ' has-video' : ''}`}>
    {video ? <StreamVideo stream={stream!} muted={self} /> : <span className="meeting-tile-avatar" style={{ background: person.color }}><span>{initial(person.name)}</span></span>}
    <span className="meeting-tile-name">{!person.mic && <MicOff size={12} />}{person.name}</span>
  </div>;
}

/** The reference's full-screen meeting view: participant mosaic, side panel (chat, people, details) and the meeting tools. */
export default function MeetingView({ roomName, meeting, people, selfId, localStream, remoteStreams, messages, panel, online, onPanel, onSend, onCopyLink }: Props) {
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length, panel]);
  const columns = Math.ceil(Math.sqrt(Math.max(1, people.length)));
  const rows = Math.ceil(Math.max(1, people.length) / columns);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; onSend(text.trim()); setText(''); };

  return <div className={`meeting-view${panel ? ' with-panel' : ''}`}>
    <div className={`meeting-stage${people.length > 1 ? ' is-grid' : ''}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {people.map(person => <Tile key={person.id} person={person} self={person.id === selfId} stream={person.id === selfId ? localStream ?? undefined : remoteStreams[person.id]} />)}
    </div>
    {panel && <aside className="meeting-panel" aria-label={panel === 'chat' ? 'Chat de la reunión' : panel === 'people' ? 'Personas' : 'Detalles de la reunión'}>
      <header><p>{panel === 'chat' ? 'Chat de la reunión' : panel === 'people' ? 'Personas' : 'Detalles de la reunión'}</p><button type="button" className="meeting-panel-close" aria-label="Cerrar panel" title="Cerrar panel" onClick={() => onPanel(null)}><X size={16} /></button></header>
      {panel === 'chat' && <>
        <div className="meeting-chat-history">
          <div className="meeting-chat-spacer" />
          {messages.map(message => message.system
            ? <div className="meeting-chat-system" key={message.id}><span className="meeting-chat-dot" style={{ background: people.find(person => person.id === message.participantId)?.color }}>{initial(message.name)}</span><strong>{message.name}</strong> {message.text}</div>
            : <div className={`meeting-chat-message${message.participantId === selfId ? ' own' : ''}`} key={message.id}><div><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></div>)}
          <div ref={end} />
        </div>
        <form className="meeting-composer" onSubmit={submit}>
          <input value={text} onChange={event => setText(event.target.value)} placeholder={`Mensaje a ${roomName}`} aria-label={`Mensaje a ${roomName}`} maxLength={1000} disabled={!online} />
          <div><button type="button" aria-label="Adjuntar archivo" title="Adjuntar archivo" disabled><Paperclip size={16} /></button><button type="button" aria-label="Mencionar" title="Mencionar" onClick={() => setText(value => `${value}@`)}><AtSign size={16} /></button><button type="button" aria-label="Emoji" title="Emoji" onClick={() => setText(value => `${value}🙂`)}><Smile size={16} /></button><button type="submit" className="meeting-send" aria-label="Enviar mensaje" title="Enviar mensaje" disabled={!online || !text.trim()}><Send size={15} /></button></div>
        </form>
      </>}
      {panel === 'people' && <div className="meeting-panel-body">
        <div className="meeting-panel-actions"><button type="button" className="primary" onClick={onCopyLink}><UserPlus size={15} />Añadir personas</button><button type="button" className="meeting-secondary" onClick={onCopyLink}><Link2 size={15} />Enlace de la reunión</button></div>
        <div className="meeting-people-heading"><span>Aquí ahora</span><span className="meeting-count">{people.length}</span></div>
        <ul className="meeting-people">{people.map(person => <li key={person.id}><span className="meeting-person-avatar" style={{ background: person.color }}>{initial(person.name)}<i className={`status-dot ${person.status}`} /></span><span>{person.name}{person.id === selfId ? ' (tú)' : ''}</span>{!person.mic && <MicOff size={14} />}</li>)}</ul>
      </div>}
      {panel === 'details' && <div className="meeting-panel-body">
        <button type="button" className="meeting-secondary wide" onClick={onCopyLink}><Link2 size={15} />Enlace de la reunión</button>
        <dl className="meeting-details"><div><dt>Inicio</dt><dd>{startedLabel(meeting?.startedAt, now)}</dd></div><div><dt>Sala</dt><dd>{roomName}</dd></div><div><dt>Personas</dt><dd>{people.length} {people.length === 1 ? 'aquí' : 'aquí'}</dd></div><div><dt>Acceso</dt><dd>{meeting?.locked ? 'Privada: nadie más puede entrar' : 'Abierta: otras personas pueden unirse'}</dd></div></dl>
      </div>}
    </aside>}
    <div className="meeting-corner" aria-label="Paneles de la reunión">
      <button type="button" className={panel === 'details' ? 'is-active' : ''} aria-label="Detalles de la reunión" title="Detalles de la reunión" aria-pressed={panel === 'details'} onClick={() => onPanel(panel === 'details' ? null : 'details')}><Info size={18} /></button>
      <button type="button" className={panel === 'people' ? 'is-active' : ''} aria-label="Personas" title="Personas" aria-pressed={panel === 'people'} onClick={() => onPanel(panel === 'people' ? null : 'people')}><Users size={18} /><span className="meeting-badge">{people.length}</span></button>
      <button type="button" className={panel === 'chat' ? 'is-active' : ''} aria-label="Chat de la reunión" title="Chat de la reunión" aria-pressed={panel === 'chat'} onClick={() => onPanel(panel === 'chat' ? null : 'chat')}><MessageCircle size={18} /></button>
    </div>
  </div>;
}
