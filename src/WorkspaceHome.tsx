import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, LayoutGrid, MoreVertical, Plus, Search, Trash2, X } from 'lucide-react';
import { locale, t } from './i18n';
import { loadConfig, storedKey } from './config';
import { createWorkspace, fetchWorkspace, forgetWorkspace, knownWorkspaces, rememberWorkspace, visitedLabel, workspaceUrl, type KnownWorkspace, type Template } from './workspaces';

const THUMBNAIL: Record<Template, string> = { office: '/thumbnails/office.jpg', empty: '/thumbnails/empty.jpg' };

/** Start page, laid out like the reference dashboard: recent and created workspaces as map cards, and a create dialog. */
export default function WorkspaceHome() {
  const [list, setList] = useState(knownWorkspaces);
  const [tab, setTab] = useState<'recent' | 'created'>('recent');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(() => new URLSearchParams(location.search).has('new'));
  const [menu, setMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { document.title = t('Tus espacios de trabajo · Open Office'); }, []);
  // Learn the template (map thumbnail) and current name of spaces we only visited.
  useEffect(() => {
    for (const item of list.filter(entry => !entry.template)) void fetchWorkspace(item.slug).then(found => {
      if (!found) return;
      rememberWorkspaceQuietly(item, found.name, found.template);
      setList(knownWorkspaces());
    });
  }, []);
  useEffect(() => { const close = () => setMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, []);

  const shown = useMemo(() => list
    .filter(item => tab === 'recent' || item.createdAt)
    .filter(item => !query || `${item.name} ${item.slug}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => tab === 'created' ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : b.visitedAt - a.visitedAt), [list, tab, query]);

  async function copyLink(slug: string) {
    try { await navigator.clipboard.writeText(workspaceUrl(slug)); setCopied(slug); setTimeout(() => setCopied(null), 1600); } catch { /* clipboard unavailable */ }
  }

  return <div className="dashboard">
    <header className="dashboard-bar">
      <a className="dashboard-brand" href="/"><span className="workspace-logo"><LayoutGrid size={18} /></span><strong>{t('Open Office')}</strong></a>
      <button type="button" className="dashboard-create" onClick={() => setCreating(true)}><Plus size={17} />{t('Crear espacio')}</button>
    </header>
    <main className="dashboard-body">
      <div className="dashboard-toolbar">
        <div className="dashboard-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>{t('Visitados recientemente')}</button>
          <button role="tab" aria-selected={tab === 'created'} className={tab === 'created' ? 'active' : ''} onClick={() => setTab('created')}>{t('Creados por ti')}</button>
        </div>
        <label className="dashboard-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Buscar')} aria-label={t('Buscar espacios')} /></label>
      </div>
      {shown.length > 0 ? <div className="dashboard-grid">{shown.map(item => <article className="space-card" key={item.slug}>
        <a className="space-thumb" href={workspaceUrl(item.slug)} onClick={() => rememberWorkspace(item.slug, item.name)}><img src={THUMBNAIL[item.template ?? 'office']} alt="" loading="lazy" /></a>
        <div className="space-meta">
          <a href={workspaceUrl(item.slug)} onClick={() => rememberWorkspace(item.slug, item.name)}><strong>{item.name}</strong></a>
          <span>{tab === 'created' && item.createdAt ? visitedLabel(item.createdAt, locale()) : visitedLabel(item.visitedAt, locale())}</span>
          <div className="space-menu-wrap">
            <button type="button" className="space-menu-button" aria-label={t('Opciones de {name}', { name: item.name })} aria-expanded={menu === item.slug} onClick={e => { e.stopPropagation(); setMenu(menu === item.slug ? null : item.slug); }}><MoreVertical size={16} /></button>
            {menu === item.slug && <div className="space-menu" role="menu" onClick={e => e.stopPropagation()}>
              <button role="menuitem" onClick={() => void copyLink(item.slug)}>{copied === item.slug ? <Check size={14} /> : <Copy size={14} />}{copied === item.slug ? t('Enlace copiado') : t('Copiar enlace')}</button>
              <button role="menuitem" className="danger" onClick={() => { forgetWorkspace(item.slug); setList(knownWorkspaces()); setMenu(null); }}><Trash2 size={14} />{t('Quitar de esta lista')}</button>
            </div>}
          </div>
        </div>
      </article>)}</div>
        : <div className="dashboard-empty"><p>{tab === 'created' ? t('Aún no has creado ningún espacio.') : query ? t('No hay espacios con ese nombre.') : t('Todavía no has entrado a ningún espacio.')}</p><button type="button" className="dashboard-create" onClick={() => setCreating(true)}><Plus size={17} />{t('Crear espacio')}</button></div>}
    </main>
    {creating && <CreateDialog onClose={() => { setCreating(false); if (location.search.includes('new')) history.replaceState(null, '', '/'); }} />}
  </div>;
}

function rememberWorkspaceQuietly(item: KnownWorkspace, name: string, template: Template) {
  // Keep the visit time: only the name and the map type are refreshed.
  try {
    const all = knownWorkspaces().map(entry => entry.slug === item.slug ? { ...entry, name, template } : entry);
    localStorage.setItem('office-workspaces', JSON.stringify(all));
  } catch { /* storage unavailable */ }
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<Template>('office');
  const [key, setKey] = useState('');
  const [keyRequired, setKeyRequired] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); void loadConfig().then(config => setKeyRequired(config.accessRequired)); const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || name.trim().length < 2) return;
    setBusy(true); setError('');
    const result = await createWorkspace(name.trim(), template, key || storedKey('key', 'mi-oficina'));
    setBusy(false);
    if ('error' in result) { setError(result.error === 'access_denied' ? t('La clave de invitación no es válida.') : result.error === 'too_many_attempts' ? t('Demasiados intentos. Espera un momento.') : result.error === 'invalid_name' ? t('El nombre necesita entre 2 y 60 caracteres.') : t('No se pudo crear el espacio. Inténtalo de nuevo.')); return; }
    rememberWorkspace(result.slug, result.name, { created: true, template });
    location.href = workspaceUrl(result.slug) + (key ? `&key=${encodeURIComponent(key)}` : '');
  }

  return <div className="dashboard-backdrop" onClick={onClose}>
    <form className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" onSubmit={submit} onClick={e => e.stopPropagation()}>
      <button type="button" className="dashboard-dialog-close" aria-label={t('Cerrar ventana')} onClick={onClose}><X size={18} /></button>
      <h2 id="create-title">{t('Crear un espacio de trabajo')}</h2>
      <p className="dashboard-dialog-lead">{t('Cada espacio tiene su propio mapa, sus personas, su chat y su calendario.')}</p>
      <span className="dashboard-label">{t('Elige un mapa')}</span>
      <div className="template-grid">
        {(['office', 'empty'] as const).map(option => <button type="button" key={option} className={`template-card${template === option ? ' selected' : ''}`} aria-pressed={template === option} onClick={() => setTemplate(option)}>
          <img src={THUMBNAIL[option]} alt="" />
          <strong>{option === 'office' ? t('Oficina completa') : t('Oficina vacía')}</strong>
          <small>{option === 'office' ? t('Salas de reunión, escritorios, cocina y jardín, ya amueblados.') : t('Las mismas salas sin muebles, para decorarla a tu gusto.')}</small>
          {template === option && <span className="template-check"><Check size={14} /></span>}
        </button>)}
      </div>
      <label className="dashboard-label">{t('Nombre del espacio')}<input ref={input} value={name} onChange={e => setName(e.target.value)} placeholder={t('p. ej. Equipo de diseño')} minLength={2} maxLength={60} required /></label>
      {keyRequired && <label className="dashboard-label">{t('Clave de invitación')}<input type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" maxLength={200} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dashboard-dialog-actions"><button type="button" className="dashboard-secondary" onClick={onClose}>{t('Cancelar')}</button><button className="dashboard-create" type="submit" disabled={busy || name.trim().length < 2}>{busy ? t('Creando…') : t('Crear espacio')}</button></div>
    </form>
  </div>;
}
