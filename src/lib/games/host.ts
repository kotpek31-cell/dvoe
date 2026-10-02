// Ведущий мини-игры — телефон того, кто крутил колесо.
// Колесо → все бегут на арену → отсчёт → игра → итог на сервер → пьедестал. Состояние для всех (GameSnap)
// уходит через закрытый канал комнаты при каждом изменении и раз в 2,5 с (для тех, кто зашёл позже).
// Время в снимке — часы ведущего; у остальных его переводит toLocal (сдвиг по времени получения).
// Правила приходят снаружи (rules.ts) — так ведущего можно гонять автотестами без React и сети.
import type { Action, GameId, GamePub, GameState, Star } from './rules';

type Rules = typeof import('./rules');

export const WHEEL_MS = 4200; // крутится колесо
export const INTRO_MS = 1300; // название выпавшей игры
export const COUNT_MS = 2400; // 3-2-1
export const PLAY_DELAY = WHEEL_MS + INTRO_MS + COUNT_MS;
export const END_MS = 1900; // игра кончилась — досмотреть последний момент, потом пьедестал
export const LEAVE_GRACE = 2500; // столько можно «пропасть» из сети, не выбыв
const BEAT_MS = 2500;
const EMIT_GAP = 90;
const BOT_SEE = 520; // бот замечает звезду не сразу
const BOT_THINK: [number, number] = [380, 900]; // и думает между перебежками — иначе людям не угнаться
const BOT_LAZY = 0.22; // иногда ленится и стоит
const BOT_CLAIM = 150; // заявляет поимку чуть позже людей — у них задержка связи

// Сервер не примет итог раньше: столько длится партия с момента старта колеса
export const MIN_GAME_MS: Record<GameId, number> = { stars: 30_000, pumpkin: 10_000, reaction: 10_000, rps: 6_000 };

export type GamePhase = 'wheel' | 'play' | 'end' | 'podium' | 'aborted';

export type GameResult = {
  places: string[];
  best: Record<string, number>;
  saved: boolean | null; // null — ещё сохраняем
  counted: boolean; // рекорды и награды считались (людей ≥ 2)
  records: { member: string; best: number }[];
  rewards: { user_id: string; item_id: string }[];
  message?: string;
};

export type GameSnap = {
  id: string;
  game: GameId;
  seed: number;
  host: string; // участник-ведущий
  players: string[];
  bots: string[];
  cx: number; // центр арены — доля ширины мира
  half: number; // полуширина арены
  spots: Record<string, [number, number]>; // где стоять на арене
  phase: GamePhase;
  t0: number; // начало колеса (часы ведущего)
  playAt: number;
  st: GamePub | null;
  result: GameResult | null;
  reason?: string;
  v: number;
  now: number; // часы ведущего в момент отправки
};

export type FinishReply =
  | { ok: true; counted: boolean; records: { member: string; best: number }[]; rewards: { user_id: string; item_id: string }[] }
  | { ok: false; error: string; message: string };

export type StarBots = {
  pos: (m: string) => { x: number; y: number } | null;
  move: (m: string, x: number, y: number) => void;
  spot: (st: Star) => { x: number; y: number };
  rx: number;
  ry: number;
};

type Opts = {
  rules: Rules;
  clock: () => number;
  emit: (s: GameSnap) => void;
  finish: (places: string[], best: Record<string, number>) => Promise<FinishReply>;
  starBots?: StarBots;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
};

export type GameInit = Pick<GameSnap, 'id' | 'game' | 'seed' | 'host' | 'players' | 'bots' | 'cx' | 'half' | 'spots'>;

export class GameHost {
  snap: GameSnap;
  private o: Opts;
  private state: GameState | null = null;
  private gone = new Set<string>();
  private missing = new Map<string, number>();
  private lastEmit = 0;
  private dirty = false;
  private endAt = 0;
  private sched: Star[] = [];
  private landed = new Set<number>();
  private botGoal = new Map<string, number>();
  private botNext = new Map<string, number>();
  private saving: Promise<void> | null = null;
  private stopped = false;

  constructor(init: GameInit, o: Opts) {
    this.o = o;
    const now = o.clock();
    this.snap = { ...init, phase: 'wheel', t0: now, playAt: now + PLAY_DELAY, st: null, result: null, v: 1, now };
    if (init.game === 'stars') this.sched = o.rules.starSchedule(init.seed);
    this.flush(true);
  }

  get done() {
    return this.snap.phase === 'podium' || this.snap.phase === 'aborted';
  }

  private set(p: Partial<GameSnap>) {
    this.snap = { ...this.snap, ...p, v: this.snap.v + 1 };
    this.dirty = true;
  }

  // Отправить снимок (не чаще EMIT_GAP; force — сразу)
  flush(force = false) {
    const now = this.o.clock();
    if (!force && (!this.dirty || now - this.lastEmit < EMIT_GAP)) return;
    this.dirty = false;
    this.lastEmit = now;
    this.snap = { ...this.snap, now };
    this.o.emit(this.snap);
  }

  private apply(next: GameState) {
    if (next === this.state) return;
    this.state = next;
    this.set({ st: this.o.rules.pubGame(next) });
  }

  input(from: string, a: Action) {
    if (this.snap.phase !== 'play' || !this.state || !this.snap.players.includes(from) || this.gone.has(from)) return;
    this.apply(this.o.rules.inputGame(this.state, from, a, this.o.clock()));
    this.flush();
  }

  // Кто из людей сейчас на экране комнаты (ведущий — всегда). Пропал дольше LEAVE_GRACE — выбыл.
  present(onScreen: Set<string>, inRoom: Set<string>) {
    if (this.done) return;
    const now = this.o.clock();
    for (const m of this.snap.players) {
      if (m === this.snap.host || this.gone.has(m)) continue;
      const bot = this.snap.bots.includes(m);
      const here = inRoom.has(m) && (bot || onScreen.has(m));
      if (here) {
        this.missing.delete(m);
        continue;
      }
      const since = this.missing.get(m) ?? now;
      this.missing.set(m, since);
      if (!inRoom.has(m) || now - since >= LEAVE_GRACE) this.leave(m);
    }
  }

  private leave(m: string) {
    this.gone.add(m);
    this.missing.delete(m);
    if (this.state && this.snap.phase === 'play') {
      this.apply(this.o.rules.leaveGame(this.state, m, this.o.clock()));
    }
  }

  abort(reason: string) {
    if (this.done) return;
    this.stopped = true;
    this.set({ phase: 'aborted', reason });
    this.flush(true);
  }

  tick() {
    if (this.stopped) return;
    const now = this.o.clock();
    const s = this.snap;
    if (s.phase === 'wheel' && now >= s.playAt) {
      let st = this.o.rules.initGame(s.game, s.players, s.bots, s.seed, s.playAt);
      // ушли ещё до старта
      this.gone.forEach((m) => (st = this.o.rules.leaveGame(st, m, now)));
      this.state = st;
      this.set({ phase: 'play', st: this.o.rules.pubGame(st) });
    }
    if (this.snap.phase === 'play' && this.state) {
      this.apply(this.o.rules.tickGame(this.state, now));
      if (this.snap.game === 'stars') this.stars(now);
      if (this.state.done) {
        this.endAt = now + END_MS;
        this.set({ phase: 'end' });
        this.save();
      }
    }
    if (this.snap.phase === 'end' && now >= this.endAt) {
      const st = this.state!;
      this.set({
        phase: 'podium',
        result: this.snap.result ?? { places: this.o.rules.placesOf(st), best: this.o.rules.bestOf(st), saved: null, counted: false, records: [], rewards: [] },
      });
    }
    if (now - this.lastEmit >= BEAT_MS && !this.done) this.dirty = true;
    this.flush();
  }

  // Итог — на сервер; рано нельзя (сервер проверяет, что партия была правдоподобно долгой)
  private save() {
    if (this.saving || !this.state) return;
    const st = this.state;
    const places = this.o.rules.placesOf(st);
    const best = this.o.rules.bestOf(st);
    const wait = this.o.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    this.saving = (async () => {
      const minAt = this.snap.t0 + MIN_GAME_MS[this.snap.game] + 1200;
      let reply: FinishReply = { ok: false, error: 'net', message: 'Нет связи — итог не сохранился' };
      for (let attempt = 0; attempt < 3; attempt++) {
        const left = minAt - this.o.clock();
        if (left > 0) await wait(left);
        try {
          reply = await this.o.finish(places, best);
        } catch (e) {
          reply = { ok: false, error: 'net', message: e instanceof Error ? e.message : 'Нет связи — итог не сохранился' };
        }
        if (reply.ok || reply.error !== 'too_fast') break;
        await wait(2000);
      }
      const result: GameResult = reply.ok
        ? { places, best, saved: true, counted: reply.counted, records: reply.records, rewards: reply.rewards }
        : { places, best, saved: false, counted: false, records: [], rewards: [], message: reply.message };
      if (this.snap.phase === 'aborted') return;
      this.set({ result });
      this.flush(true);
    })();
  }

  private claimedByOther(m: string, i: number) {
    for (const [b, g] of this.botGoal) if (b !== m && g === i) return true;
    return false;
  }

  // Боты в «Звездопаде»: бегут к ближайшей тени (заметив её не сразу), ловят то, под чем стоят
  private stars(now: number) {
    const b = this.o.starBots;
    if (!b || this.state?.g !== 'stars') return;
    const S = () => this.state as Extract<GameState, { g: 'stars' }>; // свежее состояние после поимок
    const start = S().start;
    const land = (x: Star) => this.o.rules.starLand(start, x);
    const live = (m: string) => this.snap.bots.includes(m) && !S().out.includes(m) && !this.gone.has(m);
    // поимки на земле
    for (const x of this.sched) {
      if (this.landed.has(x.i) || now < land(x) + BOT_CLAIM) continue;
      this.landed.add(x.i);
      const spot = b.spot(x);
      for (const m of this.snap.bots) {
        if (!live(m)) continue;
        const p = b.pos(m);
        if (p && this.o.rules.near(p, spot, b.rx, b.ry)) this.input(m, { k: x.kind === 'cloud' ? 'zap' : 'catch', i: x.i });
      }
    }
    // куда бежать
    for (const m of this.snap.bots) {
      if (!live(m) || (S().stun[m] ?? 0) > now) continue;
      const goal = this.botGoal.get(m);
      const cur = goal !== undefined ? this.sched[goal] : undefined;
      // стоит под своей звездой, пока поимку не засчитали
      if (cur && now < land(cur) + BOT_CLAIM + 60 && S().taken[cur.i] === undefined) continue;
      if (now < (this.botNext.get(m) ?? 0)) continue;
      const rand = this.o.random ?? Math.random;
      this.botNext.set(m, now + BOT_THINK[0] + rand() * (BOT_THINK[1] - BOT_THINK[0]));
      if (rand() < BOT_LAZY) {
        this.botGoal.delete(m);
        continue;
      }
      const p = b.pos(m);
      if (!p) continue;
      let bestI = -1;
      let bestD = Infinity;
      for (const x of this.sched) {
        if (x.kind === 'cloud' || S().taken[x.i] !== undefined || this.claimedByOther(m, x.i)) continue;
        const seen = start + x.at + BOT_SEE;
        if (now < seen || now >= land(x)) continue;
        const sp = b.spot(x);
        const d = Math.hypot((sp.x - p.x) / b.rx, (sp.y - p.y) / b.ry);
        if (d < bestD) {
          bestD = d;
          bestI = x.i;
        }
      }
      if (bestI < 0) {
        this.botGoal.delete(m);
        continue;
      }
      if (bestI === goal) continue;
      this.botGoal.set(m, bestI);
      const sp = b.spot(this.sched[bestI]);
      b.move(m, sp.x, sp.y);
    }
  }
}
