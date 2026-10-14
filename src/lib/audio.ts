/**
 * Page-turn audio.
 *
 * Plays recorded CC0 page-turn samples (see docs/LICENSES.md) with slight
 * random pitch and volume variation so no two flips sound identical. Until
 * the samples have decoded, a short synthesized rustle fills in.
 *
 * Browsers block audio until a user gesture. unlockAudio() must be called
 * from a pointer or key handler; playFlip() then waits for the context to be
 * running before scheduling anything, since resume() is async.
 *
 * All state lives on globalThis so that a Vite hot reload of this module
 * cannot leave old closures (inside an already-built book) pointing at a
 * module instance whose context was never created.
 */

const SAMPLE_URLS = [
  '/sounds/flip-1.mp3',
  '/sounds/flip-2.mp3',
  '/sounds/flip-3.mp3',
  '/sounds/flip-4.mp3',
  '/sounds/flip-5.mp3',
  '/sounds/flip-6.mp3',
];

interface AudioState {
  ctx: AudioContext | null;
  master: GainNode | null;
  samples: AudioBuffer[];
  loading: Promise<void> | null;
  lastPlayed: number;
  lastIndex: number;
}

const g = globalThis as unknown as { __markdownBookAudio?: AudioState };
const state: AudioState = (g.__markdownBookAudio ??= {
  ctx: null,
  master: null,
  samples: [],
  loading: null,
  lastPlayed: 0,
  lastIndex: -1,
});

/**
 * Download and decode the samples. Safe to call at app start: fetching needs
 * no gesture, and decoding through an OfflineAudioContext needs none either.
 * The resulting AudioBuffers can be played by any later AudioContext.
 */
export function prefetchSamples(): void {
  if (state.loading) return;
  state.loading = (async () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const decoder = new OfflineAudioContext(1, 1, 44100);
    const results = await Promise.allSettled(
      SAMPLE_URLS.map(async (url) => {
        const res = await fetch(base + url);
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return decoder.decodeAudioData(await res.arrayBuffer());
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') state.samples.push(normalize(r.value));
      else console.warn('[audio] sample failed', r.reason);
    }
  })();
}

/** Scale a decoded sample in place so its peak sits at TARGET_PEAK. */
const TARGET_PEAK = 0.85;
function normalize(buf: AudioBuffer): AudioBuffer {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
    }
  }
  if (peak < 0.001) return buf;
  const k = Math.min(12, TARGET_PEAK / peak);
  if (Math.abs(k - 1) < 0.02) return buf;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

export function unlockAudio(): void {
  if (!state.ctx) {
    const ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(comp).connect(ctx.destination);
    state.ctx = ctx;
    state.master = master;
  }
  if (state.ctx.state === 'suspended') void state.ctx.resume();
  prefetchSamples();
}

export function audioReady(): boolean {
  return !!state.ctx && state.ctx.state === 'running';
}

export function samplesReady(): boolean {
  return state.samples.length > 0;
}

/** Ring buffer of recent decisions, readable as globalThis.__markdownBookAudio.log. */
function log(msg: string): void {
  const l = (state as AudioState & { log?: string[] }).log ??= [];
  l.push(`${Math.round(performance.now())} ${msg}`);
  if (l.length > 50) l.shift();
}

export function playFlip(): void {
  const ctx = state.ctx;
  if (!ctx) {
    log('playFlip: no context yet');
    return;
  }
  const now = performance.now();
  if (now - state.lastPlayed < 250) {
    log('playFlip: debounced');
    return; // engine may report one flip twice
  }
  state.lastPlayed = now;
  if (ctx.state === 'running') {
    play(ctx);
  } else {
    log(`playFlip: context ${ctx.state}, resuming`);
    void ctx.resume().then(() => {
      if (ctx.state === 'running') play(ctx);
      else log(`playFlip: still ${ctx.state} after resume`);
    });
  }
}

function play(ctx: AudioContext): void {
  const out = state.master!;
  if (state.samples.length === 0) {
    log('play: samples not ready, synth fallback');
    synthRustle(ctx, out);
    return;
  }
  log('play: sample');
  // Pick a sample, avoiding an immediate repeat.
  let i = Math.floor(Math.random() * state.samples.length);
  if (state.samples.length > 1 && i === state.lastIndex) i = (i + 1) % state.samples.length;
  state.lastIndex = i;

  const src = ctx.createBufferSource();
  src.buffer = state.samples[i];
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  const gain = ctx.createGain();
  gain.gain.value = 0.85 + Math.random() * 0.15;
  src.connect(gain).connect(out);
  src.start();
}

/** Fallback used only before the samples have decoded. */
function synthRustle(ac: AudioContext, out: GainNode): void {
  const t0 = ac.currentTime + 0.005;
  const dur = 0.35;
  const sr = ac.sampleRate;
  const buf = ac.createBuffer(1, Math.ceil(sr * dur), sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(900, t0);
  bp.frequency.exponentialRampToValueAtTime(3000, t0 + dur * 0.5);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(env).connect(out);
  src.start(t0);
  src.stop(t0 + dur);
}
