// Мини-игры комнаты (0.2.2): правила без интерфейса и без сети.
// Ведущий (телефон того, кто крутил колесо) держит полное состояние: раз в ~100 мс зовёт tickGame,
// ходы игроков приходят в inputGame, ушедшие с экрана — leaveGame. Остальным уходит pubGame(state) —
// без скрытого: когда бахнет тыква, что выбрали в «Камень, ножницы, бумага» до «раз!».
// Время — часы ведущего, мс. Модуль без импортов: его гоняют автотесты (node --test tools/test).

export type GameId = 'pumpkin' | 'stars' | 'reaction' | 'rps';
export const GAME_IDS: GameId[] = ['pumpkin', 'stars', 'reaction', 'rps'];

export type Hand = 'rock' | 'paper' | 'scissors';
export const HANDS: Hand[] = ['rock', 'paper', 'scissors'];
export const BEATS: Record<Hand, Hand> = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export type Action =
  | { k: 'pass'; to: string } // тыква — соседу
  | { k: 'catch'; i: number } // поймал звезду i
  | { k: 'zap'; i: number } // попал под тучку i
  | { k: 'tap'; r: number; ms: number | null } // реакция: время в раунде r, null — фальстарт
  | { k: 'pick'; r: number; h: Hand }; // выбор в раунде r

// ---------- Случайность по зерну: у всех одинаковая ----------
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);
const pickOne = <T,>(r: () => number, list: T[]): T => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
const without = (list: string[], m: string) => list.filter((x) => x !== m);
const round3 = (v: number) => Math.round(v * 1000) / 1000;

type Common = {
  players: string[]; // все участники по порядку сервера
  bots: string[];
  out: string[]; // выбывшие по порядку: первый выбыл раньше всех
  done: boolean;
};
type Hidden = { r: () => number };

// ---------- Горячая тыква ----------
export const PUMPKIN = { FUSE_MIN: 8000, FUSE_MAX: 20000, BOOM_MS: 2600, BOT_MIN: 1000, BOT_MAX: 2500, PASS_GAP: 350 };

export type PumpkinPub = Common & {
  g: 'pumpkin';
  alive: string[];
  holder: string | null;
  from: string | null; // откуда прилетела (для анимации), null — появилась
  passAt: number;
  round: number;
  phase: 'hold' | 'boom' | 'done';
  boomed: string | null; // кто выбыл последним
  boomAt: number;
  nextAt: number; // конец паузы после взрыва
};
type PumpkinState = PumpkinPub & Hidden & { fuseAt: number; botAt: number };

function pumpkinRound(s: PumpkinState, now: number): PumpkinState {
  const holder = pickOne(s.r, s.alive);
  return {
    ...s,
    round: s.round + 1,
    phase: 'hold',
    holder,
    from: null,
    passAt: now,
    fuseAt: now + Math.round(between(s.r, PUMPKIN.FUSE_MIN, PUMPKIN.FUSE_MAX)),
    botAt: s.bots.includes(holder) ? now + Math.round(between(s.r, PUMPKIN.BOT_MIN, PUMPKIN.BOT_MAX)) : 0,
  };
}

function pumpkinPass(s: PumpkinState, to: string, now: number): PumpkinState {
  return {
    ...s,
    holder: to,
    from: s.holder,
    passAt: now,
    botAt: s.bots.includes(to) ? now + Math.round(between(s.r, PUMPKIN.BOT_MIN, PUMPKIN.BOT_MAX)) : 0,
  };
}

const pumpkin = {
  init(players: string[], bots: string[], seed: number, now: number): PumpkinState {
    const s: PumpkinState = {
      g: 'pumpkin',
      players,
      bots,
      out: [],
      done: false,
      alive: [...players],
      holder: null,
      from: null,
      passAt: now,
      round: 0,
      phase: 'hold',
      boomed: null,
      boomAt: 0,
      nextAt: 0,
      fuseAt: 0,
      botAt: 0,
      r: rng(seed),
    };
    return pumpkinRound(s, now);
  },
  input(s: PumpkinState, from: string, a: Action, now: number): PumpkinState {
    if (a.k !== 'pass' || s.phase !== 'hold' || s.holder !== from) return s;
    if (a.to === from || !s.alive.includes(a.to) || now - s.passAt < PUMPKIN.PASS_GAP) return s;
    return pumpkinPass(s, a.to, now);
  },
  tick(s: PumpkinState, now: number): PumpkinState {
    if (s.phase === 'hold' && s.holder) {
      if (now >= s.fuseAt) {
        const alive = without(s.alive, s.holder);
        const next: PumpkinState = { ...s, alive, out: [...s.out, s.holder], boomed: s.holder, boomAt: now, holder: null, from: null, botAt: 0 };
        if (alive.length <= 1) return { ...next, phase: 'done', done: true };
        return { ...next, phase: 'boom', nextAt: now + PUMPKIN.BOOM_MS };
      }
      if (s.botAt && now >= s.botAt && s.bots.includes(s.holder)) {
        return pumpkinPass(s, pickOne(s.r, without(s.alive, s.holder)), now);
      }
      return s;
    }
    if (s.phase === 'boom' && now >= s.nextAt) return pumpkinRound(s, now);
    return s;
  },
  leave(s: PumpkinState, m: string, now: number): PumpkinState {
    if (s.done || !s.alive.includes(m)) return s;
    const alive = without(s.alive, m);
    let next: PumpkinState = { ...s, alive, out: [...s.out, m] };
    if (alive.length <= 1) return { ...next, holder: null, botAt: 0, phase: 'done', done: true };
    if (s.holder === m) {
      // ушёл с тыквой — она достаётся другому, фитиль горит дальше
      const to = pickOne(s.r, alive);
      next = { ...pumpkinPass(next, to, now), from: null };
    }
    return next;
  },
  pub(s: PumpkinState): PumpkinPub {
    const { r: _r, fuseAt: _f, botAt: _b, ...pub } = s;
    return pub;
  },
  places: (s: PumpkinState) => [...s.alive, ...[...s.out].reverse()],
  best: (_s: PumpkinState): Record<string, number> => ({}),
};

// ---------- Звездопад ----------
export const STARS = { DURATION: 30000, FALL: 1600, GOLD: 3, STUN: 1000, EARLY: 350, LATE: 1200 };
export type StarKind = 'star' | 'gold' | 'cloud';
// at — когда появляется в небе (мс от начала игры), падает FALL мс; u — доля ширины арены, v — глубина земли
export type Star = { i: number; at: number; u: number; v: number; kind: StarKind };

export function starSchedule(seed: number): Star[] {
  const r = rng((seed ^ 0x5f3759df) >>> 0);
  const list: Star[] = [];
  let t = 700;
  while (t <= STARS.DURATION - STARS.FALL - 300) {
    const x = r();
    const kind: StarKind = list.length < 2 ? 'star' : x < 0.14 ? 'cloud' : x < 0.27 ? 'gold' : 'star';
    list.push({ i: list.length, at: Math.round(t), u: round3(between(r, 0.06, 0.94)), v: round3(between(r, 0.08, 0.92)), kind });
    t += between(r, 520, 860);
  }
  return list;
}
export const starLand = (start: number, st: Star) => start + st.at + STARS.FALL;

export type StarsPub = Common & {
  g: 'stars';
  start: number;
  end: number;
  scores: Record<string, number>;
  scoreAt: Record<string, number>; // когда набрал свой счёт (при равенстве выше тот, кто раньше)
  taken: Record<number, string>; // звезда — кто поймал
  zaps: Record<number, string[]>; // тучка — кого оглушила
  stun: Record<string, number>; // оглушён до
};
type StarsState = StarsPub & { sched: Star[] };

const stars = {
  init(players: string[], bots: string[], seed: number, now: number): StarsState {
    const scores: Record<string, number> = {};
    players.forEach((m) => (scores[m] = 0));
    return { g: 'stars', players, bots, out: [], done: false, start: now, end: now + STARS.DURATION, scores, scoreAt: {}, taken: {}, zaps: {}, stun: {}, sched: starSchedule(seed) };
  },
  input(s: StarsState, from: string, a: Action, now: number): StarsState {
    if (s.done || (a.k !== 'catch' && a.k !== 'zap') || !s.players.includes(from) || s.out.includes(from)) return s;
    const st = s.sched[a.i];
    if (!st) return s;
    const land = starLand(s.start, st);
    if (now < land - STARS.EARLY || now > land + STARS.LATE) return s;
    if (a.k === 'catch') {
      if (st.kind === 'cloud' || s.taken[st.i] !== undefined || (s.stun[from] ?? 0) > land) return s;
      return {
        ...s,
        taken: { ...s.taken, [st.i]: from },
        scores: { ...s.scores, [from]: (s.scores[from] ?? 0) + (st.kind === 'gold' ? STARS.GOLD : 1) },
        scoreAt: { ...s.scoreAt, [from]: now },
      };
    }
    if (st.kind !== 'cloud' || (s.zaps[st.i] ?? []).includes(from)) return s;
    return {
      ...s,
      zaps: { ...s.zaps, [st.i]: [...(s.zaps[st.i] ?? []), from] },
      stun: { ...s.stun, [from]: Math.max(s.stun[from] ?? 0, Math.max(now, land) + STARS.STUN) },
    };
  },
  tick: (s: StarsState, now: number): StarsState => (!s.done && now >= s.end ? { ...s, done: true } : s),
  leave(s: StarsState, m: string): StarsState {
    if (s.done || !s.players.includes(m) || s.out.includes(m)) return s;
    const out = [...s.out, m];
    return { ...s, out, done: s.players.length - out.length <= 0 };
  },
  pub(s: StarsState): StarsPub {
    const { sched: _s, ...pub } = s;
    return pub;
  },
  places(s: StarsState) {
    const active = s.players.filter((m) => !s.out.includes(m));
    const idx = (m: string) => s.players.indexOf(m);
    active.sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0) || (s.scoreAt[a] ?? Infinity) - (s.scoreAt[b] ?? Infinity) || idx(a) - idx(b));
    return [...active, ...[...s.out].reverse()];
  },
  best(s: StarsState) {
    const best: Record<string, number> = {};
    s.players.filter((m) => !s.out.includes(m)).forEach((m) => (best[m] = s.scores[m] ?? 0));
    return best;
  },
};

// ---------- Реакция ----------
export const REACTION = { ROUNDS: 5, MIN_WAIT: 2000, MAX_WAIT: 6000, ANSWER_MS: 2500, GRACE: 400, RESULT_MS: 2200, BOT_MIN: 250, BOT_MAX: 450, MIN_MS: 80 };
export type Answer = number | 'fs';

export type ReactionPub = Common & {
  g: 'reaction';
  alive: string[];
  round: number;
  phase: 'wait' | 'result' | 'done';
  greenAt: number;
  nextAt: number;
  answers: Record<string, Answer>; // ответы этого раунда
  winner: string | null; // кто взял раунд
  points: Record<string, number>;
  bestMs: Record<string, number>;
};
type ReactionState = ReactionPub & Hidden & { botMs: Record<string, number> };

function reactionRound(s: ReactionState, now: number): ReactionState {
  const botMs: Record<string, number> = {};
  s.alive.filter((m) => s.bots.includes(m)).forEach((m) => (botMs[m] = Math.round(between(s.r, REACTION.BOT_MIN, REACTION.BOT_MAX))));
  return { ...s, round: s.round + 1, phase: 'wait', greenAt: now + Math.round(between(s.r, REACTION.MIN_WAIT, REACTION.MAX_WAIT)), answers: {}, winner: null, botMs };
}

function reactionResolve(s: ReactionState, now: number): ReactionState {
  let winner: string | null = null;
  let min = Infinity;
  const bestMs = { ...s.bestMs };
  s.alive.forEach((m) => {
    const a = s.answers[m];
    if (typeof a !== 'number') return;
    if (a < min) {
      min = a;
      winner = m;
    }
    bestMs[m] = Math.min(bestMs[m] ?? Infinity, a);
  });
  const points = { ...s.points };
  if (winner) points[winner] = (points[winner] ?? 0) + 1;
  return { ...s, phase: 'result', nextAt: now + REACTION.RESULT_MS, winner, points, bestMs };
}

const reaction = {
  init(players: string[], bots: string[], seed: number, now: number): ReactionState {
    const points: Record<string, number> = {};
    players.forEach((m) => (points[m] = 0));
    const s: ReactionState = { g: 'reaction', players, bots, out: [], done: false, alive: [...players], round: 0, phase: 'wait', greenAt: 0, nextAt: 0, answers: {}, winner: null, points, bestMs: {}, botMs: {}, r: rng(seed) };
    return reactionRound(s, now);
  },
  input(s: ReactionState, from: string, a: Action, now: number): ReactionState {
    if (a.k !== 'tap' || s.phase !== 'wait' || a.r !== s.round || !s.alive.includes(from) || s.answers[from] !== undefined) return s;
    let ans: Answer;
    if (a.ms === null || !Number.isFinite(a.ms) || a.ms < REACTION.MIN_MS) ans = 'fs';
    else if (a.ms > REACTION.ANSWER_MS) return s;
    else ans = Math.round(a.ms);
    const next = { ...s, answers: { ...s.answers, [from]: ans } };
    return next.alive.every((m) => next.answers[m] !== undefined) ? reactionResolve(next, now) : next;
  },
  tick(s: ReactionState, now: number): ReactionState {
    if (s.phase === 'wait') {
      let next = s;
      Object.entries(s.botMs).forEach(([m, ms]) => {
        if (next.answers[m] === undefined && next.alive.includes(m) && now >= s.greenAt + ms) next = { ...next, answers: { ...next.answers, [m]: ms } };
      });
      if (next.alive.every((m) => next.answers[m] !== undefined) || now >= s.greenAt + REACTION.ANSWER_MS + REACTION.GRACE) return reactionResolve(next, now);
      return next;
    }
    if (s.phase === 'result' && now >= s.nextAt) {
      return s.round >= REACTION.ROUNDS ? { ...s, phase: 'done', done: true } : reactionRound(s, now);
    }
    return s;
  },
  leave(s: ReactionState, m: string, now: number): ReactionState {
    if (s.done || !s.alive.includes(m)) return s;
    const alive = without(s.alive, m);
    const next: ReactionState = { ...s, alive, out: [...s.out, m] };
    if (alive.length <= 1) return { ...next, phase: 'done', done: true };
    if (next.phase === 'wait' && alive.every((x) => next.answers[x] !== undefined)) return reactionResolve(next, now);
    return next;
  },
  pub(s: ReactionState): ReactionPub {
    const { r: _r, botMs: _b, ...pub } = s;
    return pub;
  },
  places(s: ReactionState) {
    const idx = (m: string) => s.players.indexOf(m);
    const alive = [...s.alive].sort(
      (a, b) => (s.points[b] ?? 0) - (s.points[a] ?? 0) || (s.bestMs[a] ?? Infinity) - (s.bestMs[b] ?? Infinity) || idx(a) - idx(b),
    );
    return [...alive, ...[...s.out].reverse()];
  },
  best(s: ReactionState) {
    const best: Record<string, number> = {};
    s.alive.forEach((m) => {
      if (Number.isFinite(s.bestMs[m])) best[m] = s.bestMs[m];
    });
    return best;
  },
};

// ---------- Камень, ножницы, бумага ----------
export const RPS = { CHOOSE_MS: 5000, CHANT_MS: 2400, REVEAL_MS: 2800, BOT_MIN: 600, BOT_MAX: 3200, MAX_ROUNDS: 20 };

export type RpsPub = Common & {
  g: 'rps';
  alive: string[];
  round: number;
  phase: 'choose' | 'chant' | 'reveal' | 'done';
  chooseEnd: number;
  chantEnd: number;
  revealEnd: number;
  picked: string[]; // кто уже выбрал (что — не видно до «раз!»)
  shown: Record<string, Hand> | null; // руки после «раз!»
  auto: string[]; // не успели — выбрано случайно
  result: Hand | 'draw' | null; // какая рука победила
  lost: string[]; // выбыли в этом раунде
};
type RpsState = RpsPub & Hidden & { picks: Record<string, Hand>; botAt: Record<string, number> };

function rpsRound(s: RpsState, now: number): RpsState {
  const botAt: Record<string, number> = {};
  s.alive.filter((m) => s.bots.includes(m)).forEach((m) => (botAt[m] = now + Math.round(between(s.r, RPS.BOT_MIN, RPS.BOT_MAX))));
  return { ...s, round: s.round + 1, phase: 'choose', chooseEnd: now + RPS.CHOOSE_MS, chantEnd: 0, revealEnd: 0, picks: {}, picked: [], shown: null, auto: [], result: null, lost: [], botAt };
}

// Кто проиграл: две разные руки — проиграла та, которую бьют; одна или все три — ничья
export function rpsOutcome(hands: Record<string, Hand>): { result: Hand | 'draw'; lost: string[] } {
  const set = [...new Set(Object.values(hands))];
  if (set.length !== 2) return { result: 'draw', lost: [] };
  const win = BEATS[set[0]] === set[1] ? set[0] : set[1];
  return { result: win, lost: Object.keys(hands).filter((m) => hands[m] !== win) };
}

const rps = {
  init(players: string[], bots: string[], seed: number, now: number): RpsState {
    const s: RpsState = {
      g: 'rps',
      players,
      bots,
      out: [],
      done: false,
      alive: [...players],
      round: 0,
      phase: 'choose',
      chooseEnd: 0,
      chantEnd: 0,
      revealEnd: 0,
      picked: [],
      shown: null,
      auto: [],
      result: null,
      lost: [],
      picks: {},
      botAt: {},
      r: rng(seed),
    };
    return rpsRound(s, now);
  },
  input(s: RpsState, from: string, a: Action): RpsState {
    if (a.k !== 'pick' || s.phase !== 'choose' || a.r !== s.round || !s.alive.includes(from) || !HANDS.includes(a.h)) return s;
    const picks = { ...s.picks, [from]: a.h };
    return { ...s, picks, picked: s.alive.filter((m) => picks[m]) };
  },
  tick(s: RpsState, now: number): RpsState {
    if (s.phase === 'choose') {
      let next = s;
      Object.entries(s.botAt).forEach(([m, at]) => {
        if (!next.picks[m] && next.alive.includes(m) && now >= at) {
          const picks = { ...next.picks, [m]: pickOne(s.r, HANDS) };
          next = { ...next, picks, picked: next.alive.filter((x) => picks[x]) };
        }
      });
      const all = next.alive.every((m) => next.picks[m]);
      if (!all && now < next.chooseEnd) return next;
      // не успел выбрать — выбор случайный
      const picks = { ...next.picks };
      const auto: string[] = [];
      next.alive.forEach((m) => {
        if (!picks[m]) {
          picks[m] = pickOne(s.r, HANDS);
          auto.push(m);
        }
      });
      return { ...next, picks, auto, picked: [...next.alive], phase: 'chant', chantEnd: now + RPS.CHANT_MS };
    }
    if (s.phase === 'chant' && now >= s.chantEnd) {
      const shown: Record<string, Hand> = {};
      s.alive.forEach((m) => (shown[m] = s.picks[m] ?? pickOne(s.r, HANDS)));
      let { result, lost } = rpsOutcome(shown);
      if (result === 'draw' && s.round >= RPS.MAX_ROUNDS) {
        // слишком долго ничья — остаётся один случайный
        const keep = pickOne(s.r, s.alive);
        lost = without(s.alive, keep);
        result = shown[keep];
      }
      const alive = s.alive.filter((m) => !lost.includes(m));
      return { ...s, shown, result, lost, alive, out: [...s.out, ...lost], phase: 'reveal', revealEnd: now + RPS.REVEAL_MS };
    }
    if (s.phase === 'reveal' && now >= s.revealEnd) {
      return s.alive.length <= 1 ? { ...s, phase: 'done', done: true } : rpsRound(s, now);
    }
    return s;
  },
  leave(s: RpsState, m: string): RpsState {
    if (s.done || !s.alive.includes(m)) return s;
    const alive = without(s.alive, m);
    const { [m]: _gone, ...picks } = s.picks;
    const next: RpsState = { ...s, alive, picks, picked: s.picked.filter((x) => x !== m), out: [...s.out, m] };
    // на «раз!» уже показали руки — дождёмся конца раунда; иначе один остался — победил
    if (alive.length <= 1 && s.phase !== 'reveal') return { ...next, phase: 'done', done: true };
    return next;
  },
  pub(s: RpsState): RpsPub {
    const { r: _r, picks: _p, botAt: _b, ...pub } = s;
    return pub;
  },
  places: (s: RpsState) => [...s.alive, ...[...s.out].reverse()],
  best: (_s: RpsState): Record<string, number> => ({}),
};

// ---------- Общий вход ----------
export type GameState = PumpkinState | StarsState | ReactionState | RpsState;
export type GamePub = PumpkinPub | StarsPub | ReactionPub | RpsPub;

export function initGame(game: GameId, players: string[], bots: string[], seed: number, now: number): GameState {
  if (game === 'pumpkin') return pumpkin.init(players, bots, seed, now);
  if (game === 'stars') return stars.init(players, bots, seed, now);
  if (game === 'reaction') return reaction.init(players, bots, seed, now);
  return rps.init(players, bots, seed, now);
}

export function inputGame(s: GameState, from: string, a: Action, now: number): GameState {
  if (s.done) return s;
  if (s.g === 'pumpkin') return pumpkin.input(s, from, a, now);
  if (s.g === 'stars') return stars.input(s, from, a, now);
  if (s.g === 'reaction') return reaction.input(s, from, a, now);
  return rps.input(s, from, a);
}

export function tickGame(s: GameState, now: number): GameState {
  if (s.done) return s;
  if (s.g === 'pumpkin') return pumpkin.tick(s, now);
  if (s.g === 'stars') return stars.tick(s, now);
  if (s.g === 'reaction') return reaction.tick(s, now);
  return rps.tick(s, now);
}

// Ушёл с экрана — выбыл
export function leaveGame(s: GameState, m: string, now: number): GameState {
  if (s.g === 'pumpkin') return pumpkin.leave(s, m, now);
  if (s.g === 'stars') return stars.leave(s, m);
  if (s.g === 'reaction') return reaction.leave(s, m, now);
  return rps.leave(s, m);
}

export function pubGame(s: GameState): GamePub {
  if (s.g === 'pumpkin') return pumpkin.pub(s);
  if (s.g === 'stars') return stars.pub(s);
  if (s.g === 'reaction') return reaction.pub(s);
  return rps.pub(s);
}

// Места от первого до последнего — все участники, без повторов (так требует сервер)
export function placesOf(s: GameState | GamePub): string[] {
  if (s.g === 'pumpkin') return pumpkin.places(s as PumpkinState);
  if (s.g === 'stars') return stars.places(s as StarsState);
  if (s.g === 'reaction') return reaction.places(s as ReactionState);
  return rps.places(s as RpsState);
}

// Лучший результат для рекордов: звездопад — очки, реакция — мс; остальным не нужен
export function bestOf(s: GameState | GamePub): Record<string, number> {
  if (s.g === 'stars') return stars.best(s as StarsState);
  if (s.g === 'reaction') return reaction.best(s as ReactionState);
  return {};
}

// Звезда на площадке: x — доля ширины мира (арена — cx ± half), y — глубина земли
export const starSpot = (cx: number, half: number, st: { u: number; v: number }) => ({ x: cx + (st.u - 0.5) * 2 * half, y: st.v });
export const near = (a: { x: number; y: number }, b: { x: number; y: number }, rx: number, ry: number) =>
  ((a.x - b.x) / rx) ** 2 + ((a.y - b.y) / ry) ** 2 <= 1;
