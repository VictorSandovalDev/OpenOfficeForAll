import { AREAS, TILE } from '../shared/vivo-map.js';

/** Footsteps synthesised in the browser (no recordings): a sound per floor material, slightly varied every step. */
export type Material = 'wood' | 'carpet' | 'grass';
const BY_DEPTH = [...AREAS].filter(area => area.floor).sort((a, b) => b.depth - a.depth);
const STORAGE = 'office-footsteps';

export function floorMaterial(point: { x: number; y: number }): Material {
  const tx = Math.floor(point.x / TILE), ty = Math.floor(point.y / TILE);
  const area = BY_DEPTH.find(candidate => tx >= candidate.x && tx < candidate.x + candidate.w && ty >= candidate.y && ty < candidate.y + candidate.h);
  const floor = area?.floor ?? 'NewStyleGrass';
  return floor.startsWith('Carpet') ? 'carpet' : floor.includes('Grass') ? 'grass' : 'wood';
}

export const footstepsEnabled = () => { try { return localStorage.getItem(STORAGE) !== 'off'; } catch { return true; } };
export const setFootstepsEnabled = (on: boolean) => { try { localStorage.setItem(STORAGE, on ? 'on' : 'off'); } catch { /* storage unavailable */ } };

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let left = false;
function audio() {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  if (!noise) {
    noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.25), context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return context;
}

/** One footstep on the given material; running steps are a little louder and shorter. */
export function playStep(material: Material, running = false) {
  if (!footstepsEnabled()) return;
  const ctx = audio(); if (!ctx || !noise || ctx.state !== 'running') return;
  const now = ctx.currentTime, vary = 0.85 + Math.random() * 0.3;
  left = !left; // alternate feet: a touch higher and lower
  const pitch = vary * (left ? 1.04 : 0.96);
  const level = (running ? 1.25 : 1) * 0.5;
  const out = ctx.createGain(); out.gain.value = level; out.connect(ctx.destination);

  const burst = (filterType: BiquadFilterType, frequency: number, q: number, gain: number, attack: number, decay: number) => {
    const source = ctx.createBufferSource(); source.buffer = noise; source.playbackRate.value = pitch;
    const filter = ctx.createBiquadFilter(); filter.type = filterType; filter.frequency.value = frequency * pitch; filter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    source.connect(filter); filter.connect(envelope); envelope.connect(out);
    source.start(now, Math.random() * 0.1); source.stop(now + attack + decay + 0.02);
  };
  const thump = (frequency: number, gain: number, decay: number) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * pitch, now); osc.frequency.exponentialRampToValueAtTime(frequency * 0.6 * pitch, now + decay);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now); envelope.gain.exponentialRampToValueAtTime(gain, now + 0.004); envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(envelope); envelope.connect(out); osc.start(now); osc.stop(now + decay + 0.02);
  };

  if (material === 'wood') { // a dry knock on boards
    thump(170, 0.35, 0.07);
    burst('bandpass', 1800, 1.4, 0.22, 0.002, 0.05);
  } else if (material === 'carpet') { // soft and muffled
    thump(110, 0.18, 0.09);
    burst('lowpass', 520, 0.7, 0.14, 0.006, 0.08);
  } else { // grass: a short rustle of blades
    burst('highpass', 3200, 0.6, 0.12, 0.012, 0.11);
    burst('bandpass', 900, 0.8, 0.05, 0.01, 0.08);
  }
  setTimeout(() => out.disconnect(), 400);
}
