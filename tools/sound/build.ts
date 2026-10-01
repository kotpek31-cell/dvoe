// Звуки способностей, сгенерированные кодом (лицензии не нужны): node tools/sound/build.ts
// Пишет assets/sounds/*.wav — моно, 22 050 Гц, 16 бит.
// mog.wav — временная синтетическая заглушка «мог-мог-мог», пока нет записи голоса:
// запись положить в assets/sounds/mog.wav (или поменять путь в src/lib/sound.ts) и больше этот файл не генерировать.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../assets/sounds');

// Детерминированный шум: одинаковые файлы при каждой сборке
let seed = 12345;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

function wav(name: string, data: Float32Array) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.89 / peak : 1;
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
  data.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2));
  writeFileSync(join(OUT, `${name}.wav`), buf);
  console.log(name, (buf.length / 1024).toFixed(0), 'КБ');
}

const len = (s: number) => new Float32Array(Math.round(s * RATE));
// мягкие края, чтобы не щёлкало
const fade = (d: Float32Array, inS = 0.01, outS = 0.05) => {
  const a = Math.round(inS * RATE);
  const b = Math.round(outS * RATE);
  for (let i = 0; i < a; i++) d[i] *= i / a;
  for (let i = 0; i < b; i++) d[d.length - 1 - i] *= i / b;
  return d;
};

// Резонатор (двухполюсный фильтр) — для формант голоса и гула
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

// Напряжённый звук: низкий гул, растущий шум и учащающееся сердцебиение (2,4 с)
function tension() {
  const d = len(2.4);
  const lowA = resonator(110, 60);
  const lowB = resonator(165, 70);
  const air = resonator(900, 600);
  let phase = 0;
  const beats = [0.0, 0.62, 1.16, 1.62, 2.0, 2.3];
  for (let i = 0; i < d.length; i++) {
    const t = i / RATE;
    const p = t / 2.4;
    const f = 55 * (1 + p * 0.5);
    phase += f / RATE;
    const saw = 2 * (phase % 1) - 1;
    const tremolo = 0.75 + 0.25 * Math.sin(2 * Math.PI * (4 + p * 6) * t);
    let v = (lowA(saw) + lowB(saw)) * 2.2 * tremolo * (0.35 + p * 0.65);
    v += air(noise()) * 0.6 * p * p;
    for (const b of beats) {
      const dt = t - b;
      if (dt >= 0 && dt < 0.3) {
        const env = Math.exp(-dt * 22);
        v += Math.sin(2 * Math.PI * (62 - dt * 60) * dt) * env * 0.9;
        const dt2 = dt - 0.14;
        if (dt2 >= 0) v += Math.sin(2 * Math.PI * 54 * dt2) * Math.exp(-dt2 * 26) * 0.55;
      }
    }
    d[i] = v;
  }
  return fade(d, 0.05, 0.12);
}

// Удар: низкий «бум» с падающей высотой + хлопок шума (0,8 с)
function hit() {
  const d = len(0.8);
  const body = resonator(180, 300);
  let phase = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / RATE;
    const f = 40 + 110 * Math.exp(-t * 18);
    phase += f / RATE;
    let v = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 6.5) * 1.1;
    v += body(noise()) * 6 * Math.exp(-t * 30);
    v += noise() * 0.5 * Math.exp(-t * 70);
    d[i] = Math.tanh(v * 1.6);
  }
  return fade(d, 0.001, 0.1);
}

// Тихий перезвон: три колокольчика вверх (1,6 с)
function chime() {
  const d = len(1.6);
  const notes = [
    [0.0, 1046.5],
    [0.12, 1318.5],
    [0.24, 1568.0],
    [0.42, 2093.0],
  ];
  for (let i = 0; i < d.length; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [start, f] of notes) {
      const dt = t - start;
      if (dt < 0) continue;
      const env = Math.min(1, dt * 400) * Math.exp(-dt * 3.2);
      v += (Math.sin(2 * Math.PI * f * dt) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * dt) * Math.exp(-dt * 6) + 0.18 * Math.sin(2 * Math.PI * f * 5.4 * dt) * Math.exp(-dt * 10)) * env;
    }
    d[i] = v * 0.5;
  }
  return fade(d, 0.002, 0.2);
}

// Заглушка голоса: три слога «мог» низким мультяшным голосом (2,2 с)
function mogVoice() {
  const d = len(2.2);
  const starts = [0.05, 0.75, 1.45];
  const syl = 0.52;
  for (const s0 of starts) {
    const f1 = resonator(480, 90);
    const f2 = resonator(860, 120);
    const nasal = resonator(250, 80);
    const burst = resonator(1800, 900);
    let phase = 0;
    const a = Math.round(s0 * RATE);
    const n = Math.round(syl * RATE);
    for (let j = 0; j < n && a + j < d.length; j++) {
      const t = j / RATE;
      const f0 = 118 - t * 40;
      phase += f0 / RATE;
      const pulse = phase % 1 < 0.08 ? 1 : 0; // голосовые связки
      let v = 0;
      if (t < 0.09) {
        v = nasal(pulse) * 3 * Math.min(1, t * 60); // «м» — с закрытым ртом
      } else if (t < 0.42) {
        const k = Math.min(1, (t - 0.09) * 25) * (t > 0.36 ? Math.max(0, (0.42 - t) / 0.06) : 1);
        v = (f1(pulse) * 2.4 + f2(pulse) * 1.3 + nasal(pulse) * 0.6) * k; // «о»
      } else if (t > 0.44 && t < 0.5) {
        v = burst(noise()) * 1.6 * Math.exp(-(t - 0.44) * 80) + nasal(pulse) * 0.5; // «г»
      }
      d[a + j] += v;
    }
  }
  return fade(d, 0.005, 0.05);
}

mkdirSync(OUT, { recursive: true });
wav('tension', tension());
wav('hit', hit());
wav('chime', chime());
if (!existsSync(join(OUT, 'mog.wav')) || process.argv.includes('--mog')) wav('mog', mogVoice());
