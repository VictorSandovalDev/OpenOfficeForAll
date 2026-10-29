/** Runtime configuration from the server (/config): invite requirement, edit policy and STUN/TURN servers.
    Keys arrive once in the URL (?key=, ?admin=), are kept per office in this browser and removed from the address bar. */
export type OfficeConfig = { accessRequired: boolean; editPolicy: 'everyone' | 'admins'; iceServers: RTCIceServer[] };
let current: OfficeConfig = { accessRequired: false, editPolicy: 'everyone', iceServers: [] };
export const officeConfig = () => current;
export async function loadConfig(): Promise<OfficeConfig> {
  try { const response = await fetch('/config', { cache: 'no-store' }); if (response.ok) current = { ...current, ...(await response.json()) }; } catch { /* development without the server: defaults */ }
  return current;
}
const storageKey = (kind: 'key' | 'admin', room: string) => `office-${kind}-${room}`;
export function rememberKeysFromUrl(room: string) {
  const url = new URL(location.href);
  let changed = false;
  for (const [param, kind] of [['key', 'key'], ['admin', 'admin']] as const) {
    const value = url.searchParams.get(param);
    if (value) { try { localStorage.setItem(storageKey(kind, room), value.slice(0, 200)); } catch { /* storage unavailable */ } url.searchParams.delete(param); changed = true; }
  }
  if (changed) history.replaceState(null, '', url);
}
export const storedKey = (kind: 'key' | 'admin', room: string) => { try { return localStorage.getItem(storageKey(kind, room)) ?? ''; } catch { return ''; } };
export const storeKey = (kind: 'key' | 'admin', room: string, value: string) => { try { if (value) localStorage.setItem(storageKey(kind, room), value); else localStorage.removeItem(storageKey(kind, room)); } catch { /* storage unavailable */ } };
