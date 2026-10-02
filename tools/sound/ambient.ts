// Фоновые звуки локаций (0.2.1), сгенерированные кодом — лицензии не нужны.
// Запуск: node tools/sound/ambient.ts → assets/sounds/amb_<место>.mp3 (нужен ffmpeg с libmp3lame).
// Каждая петля — LOOP секунд, бесшовная: хвост сведён с началом. В файле после петли ещё TAIL секунд
// её же начала: веб крутит отрезок [LOOP_START, LOOP_START + LOOP] — шов попадает точно в период,
// даже если декодер mp3 добавил тишину в начале. Телефон крутит файл целиком (края мягко притушены).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const RATE = 22050;
export const LOOP = 24;
const TAIL = 1;
const XF = 2; // секунды сведения хвоста с началом
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../assets/sounds');
const N = LOOP * RATE;

let seed = 777;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};
const rand = () => (noise() + 1) / 2;

// ---------- фильтры ----------
const lowpass = (fc: number) => {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / RATE);
  let y = 0;
  return (x: number) => (y += a * (x - y));
};
const highpass = (fc: number) => {
  const lp = lowpass(fc);
  return (x: number) => x - lp(x);
};
function resonator(freq: number, bw: number) {
  const r = Math.exp((-Math.PI * bw) / RATE);
  const c = 2 * r * Math.cos((2 * Math.PI * freq) / RATE);
  let y1 = 0;
  let y2 = 0;
  return (x: number) => {
    const y = (1 - r) * x + c * y1 - r * r * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
}
// Коричневый шум — глубокий ветер и гул
const brown = () => {
  let y = 0;
  return () => (y = Math.max(-1, Math.min(1, y * 0.996 + noise() * 0.04)));
};
// Простая «комната»: две обратные задержки
function reverb(d: Float32Array, mix = 0.3, times = [0.137, 0.211, 0.293], fb = 0.55) {
  const lines = times.map((t) => ({ buf: new Float32Array(Math.round(t * RATE)), i: 0 }));
  const lp = lowpass(3000);
  for (let n = 0; n < d.length; n++) {
    let wet = 0;
    for (const l of lines) {
      const v = l.buf[l.i];
      wet += v;
      l.buf[l.i] = d[n] + v * fb;
      l.i = (l.i + 1) % l.buf.length;
    }
    d[n] += lp(wet / lines.length) * mix;
  }
  return d;
}

const raw = () => new Float32Array(N + XF * RATE);
const T = (n: number) => n / RATE;
// медленная волна с периодом, кратным петле
const lfo = (n: number, cycles: number, phase = 0) => 0.5 + 0.5 * Math.sin((2 * Math.PI * cycles * n) / N + phase);

// ---------- события ----------
function addAt(d: Float32Array, start: number, part: Float32Array, gain = 1) {
  const a = Math.round(start * RATE);
  for (let i = 0; i < part.length && a + i < d.length; i++) if (a + i >= 0) d[a + i] += part[i] * gain;
}
function tone(dur: number, f: (t: number) => number, env: (t: number) => number, harm: [number, number][] = [[1, 1]]) {
  const d = new Float32Array(Math.round(dur * RATE));
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / RATE;
    ph += f(t) / RATE;
    let v = 0;
    for (const [k, a] of harm) v += Math.sin(2 * Math.PI * ph * k) * a;
    d[i] = v * env(t);
  }
  return d;
}
const chirp = (base: number) =>
  tone(0.16, (t) => base + 1800 * Math.sin(t * 40), (t) => Math.sin(Math.PI * Math.min(1, t / 0.16)) ** 2);
function birdSong(d: Float32Array, at: number, base: number) {
  const n = 2 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) addAt(d, at + i * (0.18 + rand() * 0.1), chirp(base + rand() * 600), 0.12);
}
// Струна (Карплус — Стронг): кото, гитара, перезвон
function pluck(freq: number, dur: number, damp = 0.996) {
  const d = new Float32Array(Math.round(dur * RATE));
  const p = Math.max(2, Math.round(RATE / freq));
  const buf = Float32Array.from({ length: p }, () => noise());
  for (let i = 0; i < d.length; i++) {
    const j = i % p;
    const v = buf[j];
    buf[j] = damp * 0.5 * (v + buf[(j + 1) % p]);
    d[i] = v;
  }
  return d;
}
const bell = (f: number, dur = 2.5, decay = 2.2) =>
  tone(dur, () => f, (t) => Math.min(1, t * 300) * Math.exp(-t * decay), [[1, 1], [2.76, 0.35], [5.4, 0.15]]);
const drip = (f: number) => tone(0.35, (t) => f * (1 + 0.6 * Math.exp(-t * 30)), (t) => Math.min(1, t * 2000) * Math.exp(-t * 14), [[1, 1], [2.1, 0.2]]);

// ---------- 12 мест ----------
function wind(d: Float32Array, gain: number, cutoff = 400, cycles = 3) {
  const b = brown();
  const lp = lowpass(cutoff);
  for (let n = 0; n < d.length; n++) d[n] += lp(b()) * gain * (0.45 + 0.55 * lfo(n, cycles) * lfo(n, cycles * 2 + 1, 1.3));
}
function waves(d: Float32Array, gain: number, count = 4) {
  const lp = lowpass(900);
  const hp = highpass(120);
  for (let n = 0; n < d.length; n++) {
    const ph = ((n / N) * count) % 1;
    const sw = Math.pow(Math.sin(Math.PI * ph), 3) * (0.6 + 0.4 * lfo(n, 1));
    d[n] += hp(lp(noise())) * gain * (0.15 + sw);
  }
}

const PLACES: Record<string, () => Float32Array> = {
  meadow() {
    const d = raw();
    wind(d, 1.2, 300, 2);
    waves(d, 0.08, 6);
    for (let t = 0.5; t < LOOP + XF - 1; t += 2.5 + rand() * 3) birdSong(d, t, 2600 + rand() * 900);
    return d;
  },
  aurora() {
    const d = raw();
    wind(d, 1.6, 500, 2);
    const chord = [220, 277.2, 329.6, 440];
    for (let n = 0; n < d.length; n++) {
      let v = 0;
      chord.forEach((f, i) => (v += Math.sin((2 * Math.PI * f * n) / RATE + i) * lfo(n, 1 + i, i * 1.7)));
      d[n] += v * 0.018;
    }
    for (let t = 1; t < LOOP; t += 3 + rand() * 3) addAt(d, t, bell(1318.5 * (rand() < 0.5 ? 1 : 1.5), 3, 1.4), 0.05);
    return reverb(d, 0.4);
  },
  roof() {
    const d = raw();
    const b = brown();
    const lp = lowpass(160);
    for (let n = 0; n < d.length; n++) d[n] += lp(b()) * 1.4;
    wind(d, 0.8, 600, 3);
    // проезжающие машины — шорох нарастает и спадает
    for (let t = 1; t < LOOP; t += 4 + rand() * 4) {
      const len = 3;
      const part = new Float32Array(len * RATE);
      const bp = resonator(500 + rand() * 300, 600);
      for (let i = 0; i < part.length; i++) part[i] = bp(noise()) * Math.sin((Math.PI * i) / part.length) ** 2;
      addAt(d, t, part, 0.5);
    }
    return d;
  },
  beach() {
    const d = raw();
    waves(d, 0.5, 4);
    wind(d, 0.6, 400, 2);
    for (let t = 3; t < LOOP; t += 7 + rand() * 4) {
      for (let k = 0; k < 2; k++)
        addAt(d, t + k * 0.35, tone(0.3, (x) => 1400 - x * 1500, (x) => Math.sin(Math.PI * x / 0.3), [[1, 1], [2, 0.3]]), 0.05);
    }
    return d;
  },
  forest() {
    const d = raw();
    wind(d, 0.7, 350, 2);
    // треск костра: щелчки и хлопки
    const hp = highpass(800);
    for (let n = 0; n < d.length; n++) {
      if (rand() < 0.0009) {
        const len = 40 + Math.floor(rand() * 200);
        const g = 0.2 + rand() * 0.6;
        for (let i = 0; i < len && n + i < d.length; i++) d[n + i] += hp(noise()) * g * Math.exp(-i / (len / 4));
      }
    }
    const roar = lowpass(220);
    for (let n = 0; n < d.length; n++) d[n] += roar(noise()) * 0.5 * (0.7 + 0.3 * lfo(n, 5));
    // сова вдалеке
    for (const t of [6, 17]) {
      addAt(d, t, tone(0.5, () => 390, (x) => Math.sin(Math.PI * x / 0.5)), 0.05);
      addAt(d, t + 0.75, tone(0.9, (x) => 380 - x * 20, (x) => Math.sin(Math.PI * x / 0.9)), 0.05);
    }
    return reverb(d, 0.2);
  },
  snow() {
    const d = raw();
    wind(d, 1.3, 450, 3);
    const notes = [1568, 1760, 2093, 2349, 2637];
    for (let t = 1.5; t < LOOP; t += 5 + rand() * 3) {
      for (let k = 0; k < 6; k++) addAt(d, t + k * 0.09, bell(notes[Math.floor(rand() * notes.length)] * 2, 0.8, 6), 0.03);
    }
    return reverb(d, 0.35);
  },
  cafe() {
    const d = raw();
    // мягкие аккорды электропиано: 4 аккорда по 6 с
    const chords = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2]];
    chords.forEach((ch, ci) => {
      ch.forEach((f, k) => addAt(d, ci * 6 + k * 0.04, tone(6.8, () => f, (t) => Math.min(1, t * 40) * Math.exp(-t * 0.45), [[1, 1], [2, 0.25], [3, 0.08]]), 0.05));
      addAt(d, ci * 6 + 3, tone(2.5, () => ch[3] * 2, (t) => Math.min(1, t * 60) * Math.exp(-t * 1.5), [[1, 1], [2, 0.2]]), 0.03);
    });
    // гул голосов: полосы шума со «слогами»
    for (let v = 0; v < 4; v++) {
      const f1 = resonator(500 + v * 180, 220);
      const f2 = resonator(1200 + v * 260, 300);
      let env = 0;
      let target = 0;
      for (let n = 0; n < d.length; n++) {
        if (n % 2200 === 0) target = rand() < 0.55 ? rand() : 0;
        env += (target - env) * 0.002;
        d[n] += (f1(noise()) + f2(noise()) * 0.5) * env * 0.35;
      }
    }
    // звон чашек
    for (let t = 2; t < LOOP; t += 4 + rand() * 4) addAt(d, t, bell(2800 + rand() * 800, 0.6, 9), 0.04);
    return reverb(d, 0.25);
  },
  moon() {
    const d = raw();
    const pad = [110, 164.8, 220, 277.2, 329.6];
    for (let n = 0; n < d.length; n++) {
      let v = 0;
      pad.forEach((f, i) => (v += (Math.sin((2 * Math.PI * f * n) / RATE) + Math.sin((2 * Math.PI * f * 1.003 * n) / RATE)) * lfo(n, i % 3 + 1, i)));
      d[n] += v * 0.02;
    }
    wind(d, 0.25, 200, 1);
    for (let t = 0.8; t < LOOP; t += 1.6 + rand() * 2.5) {
      const f = [1046.5, 1318.5, 1568, 1975.5, 2349][Math.floor(rand() * 5)];
      addAt(d, t, tone(0.6, () => f, (x) => Math.min(1, x * 200) * Math.exp(-x * 7)), 0.03);
    }
    return reverb(d, 0.5, [0.21, 0.33, 0.47], 0.65);
  },
  sakura() {
    const d = raw();
    wind(d, 0.6, 300, 2);
    // ручей
    const bp = resonator(1400, 1500);
    for (let n = 0; n < d.length; n++) d[n] += bp(noise()) * 0.18 * (0.6 + 0.4 * lfo(n, 7) * lfo(n, 11, 2));
    // кото: пентатоника
    const scale = [293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
    for (let t = 0.5; t < LOOP; t += 1.2 + rand() * 2.2) addAt(d, t, pluck(scale[Math.floor(rand() * scale.length)], 2.5, 0.997), 0.12);
    return reverb(d, 0.3);
  },
  rain() {
    const d = raw();
    const hp = highpass(1200);
    const lp = lowpass(5000);
    for (let n = 0; n < d.length; n++) {
      d[n] += lp(hp(noise())) * 0.35 * (0.85 + 0.15 * lfo(n, 4));
      if (rand() < 0.004) {
        const g = 0.1 + rand() * 0.3;
        for (let i = 0; i < 60 && n + i < d.length; i++) d[n + i] += noise() * g * Math.exp(-i / 12);
      }
    }
    const b = brown();
    const rum = lowpass(90);
    for (let n = 0; n < d.length; n++) d[n] += rum(b()) * 1.2;
    // гром вдалеке
    const th = new Float32Array(4 * RATE);
    const tb = brown();
    const tl = lowpass(140);
    for (let i = 0; i < th.length; i++) th[i] = tl(tb()) * Math.min(1, i / (0.3 * RATE)) * Math.exp(-i / (1.2 * RATE));
    addAt(d, 11, th, 3);
    return d;
  },
  mountains() {
    const d = raw();
    wind(d, 2, 650, 3);
    for (const t of [5, 15.5]) addAt(d, t, tone(1.2, (x) => 1900 - x * 700, (x) => Math.sin(Math.PI * x / 1.2) * (0.7 + 0.3 * Math.sin(x * 60)), [[1, 1], [2, 0.2]]), 0.035);
    for (const t of [2, 9, 20]) addAt(d, t, bell(560, 2, 2.5), 0.025);
    return reverb(d, 0.35, [0.31, 0.43, 0.61], 0.5);
  },
  cave() {
    const d = raw();
    const b = brown();
    const lp = lowpass(120);
    for (let n = 0; n < d.length; n++) d[n] += lp(b()) * 1.1 * (0.7 + 0.3 * lfo(n, 2));
    for (let t = 0.4; t < LOOP; t += 0.9 + rand() * 2) addAt(d, t, drip(700 + rand() * 900), 0.12);
    for (let t = 2; t < LOOP; t += 5 + rand() * 3) addAt(d, t, bell(1760 + rand() * 600, 2.5, 1.6), 0.02);
    return reverb(d, 0.55, [0.23, 0.37, 0.53], 0.7);
  },
};

// Сведение хвоста с началом (равная мощность) → период LOOP; затем ещё TAIL секунд того же начала
function makeLoop(rawD: Float32Array): Float32Array {
  const xf = XF * RATE;
  const loop = new Float32Array(N);
  for (let i = 0; i < N; i++) loop[i] = rawD[i];
  for (let i = 0; i < xf; i++) {
    const a = i / xf;
    loop[i] = rawD[i] * Math.sqrt(a) + rawD[i + N] * Math.sqrt(1 - a);
  }
  // громкость: по средней мощности, без перегруза
  let sum = 0;
  for (const v of loop) sum += v * v;
  const rms = Math.sqrt(sum / N) || 1;
  let gain = 0.16 / rms;
  let peak = 0;
  for (const v of loop) peak = Math.max(peak, Math.abs(v));
  gain = Math.min(gain, 0.85 / peak);
  const out = new Float32Array(N + TAIL * RATE);
  for (let i = 0; i < out.length; i++) out[i] = loop[i % N] * gain;
  // края файла мягко притушены — для телефона, который крутит файл целиком (вебу они не нужны)
  const edge = Math.round(0.25 * RATE);
  for (let i = 0; i < edge; i++) {
    out[i] *= i / edge;
    out[out.length - 1 - i] *= i / edge;
  }
  return out;
}

function wav(path: string, data: Float32Array) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  writeFileSync(path, buf);
}

mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
for (const [id, make] of Object.entries(PLACES)) {
  if (only && id !== only) continue;
  seed = 777 + id.length * 31 + id.charCodeAt(0);
  const tmp = join(tmpdir(), `amb_${id}.wav`);
  wav(tmp, makeLoop(make()));
  const mp3 = join(OUT, `amb_${id}.mp3`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', String(RATE), '-codec:a', 'libmp3lame', '-b:a', '48k', mp3]);
  rmSync(tmp);
  console.log(id, 'ок');
}
