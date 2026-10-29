/** Which art draws the office: the pixel-exact transcription of the reference ("reference", the default), or the
    project's own art ("original": PixelLab-generated furniture and code-drawn floors) that can be redistributed freely. */
export type ArtPack = 'reference' | 'original';
let current: ArtPack = (() => { try { return localStorage.getItem('office-art') === 'original' ? 'original' : 'reference'; } catch { return 'reference'; } })();
const listeners = new Set<() => void>();
export const artPack = () => current;
export function setArtPack(next: ArtPack) { current = next; try { localStorage.setItem('office-art', next); } catch { /* storage unavailable */ } listeners.forEach(listener => listener()); }
export const onArtPackChange = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
