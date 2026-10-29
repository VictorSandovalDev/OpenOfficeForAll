import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, LayoutGrid, Plus, Square, X } from 'lucide-react';
import { t } from './i18n';
import { loadConfig, storedKey } from './config';
import { createWorkspace, forgetWorkspace, knownWorkspaces, rememberWorkspace, workspaceUrl, type Template } from './workspaces';

/** Start page: your workspaces and a form to create a new one, each with its own map. */
export default function WorkspaceHome() {
  const [list, setList] = useState(knownWorkspaces);
  const [creating, setCreating] = useState(() => new URLSearchParams(location.search).has('new') || list.length === 0);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<Template>('office');
  const [key, setKey] = useState('');
  const [keyRequired, setKeyRequired] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = t('Tus espacios de trabajo · Open Office'); void loadConfig().then(config => setKeyRequired(config.accessRequired)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || name.trim().length < 2) return;
    setBusy(true); setError('');
    const result = await createWorkspace(name.trim(), template, key || storedKey('key', 'mi-oficina'));
    setBusy(false);
    if ('error' in result) { setError(result.error === 'access_denied' ? t('La clave de invitación no es válida.') : result.error === 'too_many_attempts' ? t('Demasiados intentos. Espera un momento.') : result.error === 'invalid_name' ? t('El nombre necesita entre 2 y 60 caracteres.') : t('No se pudo crear el espacio. Inténtalo de nuevo.')); return; }
    rememberWorkspace(result.slug, result.name);
    location.href = workspaceUrl(result.slug) + (key ? `&key=${encodeURIComponent(key)}` : '');
  }

  return <main className="workspace-home">
    <header><span className="workspace-logo"><LayoutGrid size={20} /></span><strong>{t('Open Office')}</strong></header>
    <section className="workspace-panel">
      <h1>{t('Tus espacios de trabajo')}</h1>
      <p className="muted">{t('Cada espacio tiene su propio mapa, sus personas, su chat y su calendario.')}</p>
      {list.length > 0 && <ul className="workspace-list">{list.map(item => <li key={item.slug}>
        <a href={workspaceUrl(item.slug)} onClick={() => rememberWorkspace(item.slug, item.name)}><span className="workspace-badge">{item.name.trim()[0]?.toUpperCase() ?? '?'}</span><span><strong>{item.name}</strong><small>/{item.slug}</small></span><ArrowRight size={16} /></a>
        <button type="button" className="workspace-forget" aria-label={t('Quitar {name} de esta lista', { name: item.name })} title={t('Quitar de esta lista')} onClick={() => { forgetWorkspace(item.slug); setList(knownWorkspaces()); }}><X size={14} /></button>
      </li>)}</ul>}
      {!creating ? <button type="button" className="primary workspace-new" onClick={() => setCreating(true)}><Plus size={16} />{t('Crear un espacio de trabajo')}</button>
        : <form className="workspace-form" onSubmit={submit}>
          <h2>{t('Nuevo espacio de trabajo')}</h2>
          <label>{t('Nombre del espacio')}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t('p. ej. Equipo de diseño')} minLength={2} maxLength={60} required /></label>
          <fieldset><legend>{t('Mapa')}</legend>
            <label className={`template${template === 'office' ? ' selected' : ''}`}><input type="radio" name="template" checked={template === 'office'} onChange={() => setTemplate('office')} /><Building2 size={22} /><span><strong>{t('Oficina completa')}</strong><small>{t('Salas de reunión, escritorios, cocina y jardín, ya amueblados.')}</small></span></label>
            <label className={`template${template === 'empty' ? ' selected' : ''}`}><input type="radio" name="template" checked={template === 'empty'} onChange={() => setTemplate('empty')} /><Square size={22} /><span><strong>{t('Oficina vacía')}</strong><small>{t('Las mismas salas sin muebles, para decorarla a tu gusto.')}</small></span></label>
          </fieldset>
          {keyRequired && <label>{t('Clave de invitación')}<input type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" maxLength={200} /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="workspace-actions">{list.length > 0 && <button type="button" className="secondary" onClick={() => setCreating(false)}>{t('Cancelar')}</button>}<button className="primary" type="submit" disabled={busy || name.trim().length < 2}>{busy ? t('Creando…') : t('Crear espacio')}</button></div>
        </form>}
    </section>
  </main>;
}
