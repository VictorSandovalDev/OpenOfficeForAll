/** Workspaces this browser knows about (created or visited), newest first. Each one is a room with its own map. */
export type KnownWorkspace = { slug: string; name: string; visitedAt: number; createdAt?: number; template?: 'office' | 'empty' };
const STORAGE = 'office-workspaces';

export function knownWorkspaces(): KnownWorkspace[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    if (Array.isArray(list)) return list.filter(item => item && typeof item.slug === 'string' && typeof item.name === 'string').sort((a, b) => b.visitedAt - a.visitedAt);
  } catch { /* storage unavailable */ }
  // Before workspaces existed everyone entered the original office; keep it in the list.
  return [{ slug: 'mi-oficina', name: 'Vivo', visitedAt: 0 }];
}
export function rememberWorkspace(slug: string, name: string, extra: { created?: boolean; template?: 'office' | 'empty' } = {}) {
  const all = knownWorkspaces(), previous = all.find(item => item.slug === slug);
  const list = all.filter(item => item.slug !== slug);
  list.unshift({ ...previous, slug, name, visitedAt: Date.now(), ...(extra.created ? { createdAt: Date.now() } : {}), ...(extra.template ? { template: extra.template } : {}) });
  try { localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, 30))); } catch { /* storage unavailable */ }
}
export function forgetWorkspace(slug: string) {
  try { localStorage.setItem(STORAGE, JSON.stringify(knownWorkspaces().filter(item => item.slug !== slug))); } catch { /* storage unavailable */ }
}
export const workspaceUrl = (slug: string) => `${location.origin}/?room=${encodeURIComponent(slug)}`;

export type Template = 'office' | 'empty';
export async function createWorkspace(name: string, template: Template, key = ''): Promise<{ slug: string; name: string } | { error: string }> {
  try {
    const response = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, template, key }) });
    const body = await response.json().catch(() => ({}));
    return response.ok ? body : { error: body.error ?? 'workspace_failed' };
  } catch { return { error: 'offline' }; }
}
export async function fetchWorkspace(slug: string): Promise<{ name: string; template: 'office' | 'empty' } | null> {
  try { const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}`); if (!response.ok) return null; const body = await response.json(); return { name: body.name, template: body.template === 'empty' ? 'empty' : 'office' }; } catch { return null; }
}
export async function fetchWorkspaceName(slug: string): Promise<string | null> { return (await fetchWorkspace(slug))?.name ?? null; }
/** "Today", "Yesterday", "3 days ago"… in the interface language. */
export function visitedLabel(time: number, locale: string) {
  if (!time) return '';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(time).setHours(0, 0, 0, 0)) / 86_400_000);
  const text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
