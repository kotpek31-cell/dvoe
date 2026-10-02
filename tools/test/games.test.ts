// Автотесты правил мини-игр комнаты: node --test tools/test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bestOf,
  GAME_IDS,
  HANDS,
  initGame,
  inputGame,
  leaveGame,
  near,
  placesOf,
  pubGame,
  PUMPKIN,
  REACTION,
  rng,
  RPS,
  rpsOutcome,
  starLand,
  starSchedule,
  STARS,
  tickGame,
  type GameId,
  type GameState,
  type Hand,
} from '../../src/lib/games/rules.ts';

const P3 = ['a', 'b', 'c'];
// крутим часы шагом step, пока не выполнится условие (или не выйдет время)
function run(s: GameState, from: number, until: (s: GameState, t: number) => boolean, step = 50, max = 600_000): [GameState, number] {
  let t = from;
  while (!until(s, t) && t - from < max) {
    t += step;
    s = tickGame(s, t);
  }
  return [s, t];
}
const isPerm = (places: string[], players: string[]) => places.length === players.length && new Set(places).size === players.length && players.every((m) => places.includes(m));

describe('случайность по зерну', () => {
  it('одинаковое зерно — одинаковые числа', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
  });
  it('числа в [0, 1)', () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1);
    }
  });
});

describe('Горячая тыква', () => {
  it('тыква у случайного игрока, фитиль 8–20 с и скрыт от остальных', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = initGame('pumpkin', P3, [], seed, 0);
      assert.equal(s.g, 'pumpkin');
      if (s.g !== 'pumpkin') return;
      assert.ok(P3.includes(s.holder!));
      const fuse = (s as unknown as { fuseAt: number }).fuseAt;
      assert.ok(fuse >= PUMPKIN.FUSE_MIN && fuse <= PUMPKIN.FUSE_MAX, `фитиль ${fuse}`);
      const pub = pubGame(s) as unknown as Record<string, unknown>;
      assert.equal(pub.fuseAt, undefined);
      assert.equal(pub.botAt, undefined);
      assert.equal(pub.r, undefined);
    }
  });

  it('передать может только тот, у кого тыква, и не себе', () => {
    let s = initGame('pumpkin', P3, [], 3, 0);
    if (s.g !== 'pumpkin') return;
    const holder = s.holder!;
    const other = P3.find((m) => m !== holder)!;
    const third = P3.find((m) => m !== holder && m !== other)!;
    assert.equal(inputGame(s, other, { k: 'pass', to: third }, 1000), s, 'чужой не передаёт');
    assert.equal(inputGame(s, holder, { k: 'pass', to: holder }, 1000), s, 'себе нельзя');
    assert.equal(inputGame(s, holder, { k: 'pass', to: 'zzz' }, 1000), s, 'не игроку нельзя');
    s = inputGame(s, holder, { k: 'pass', to: other }, 1000);
    if (s.g !== 'pumpkin') return;
    assert.equal(s.holder, other);
    assert.equal(s.from, holder);
    // сразу обратно — слишком быстро (двойное нажатие)
    assert.equal(inputGame(s, other, { k: 'pass', to: holder }, 1100), s);
    const back = inputGame(s, other, { k: 'pass', to: holder }, 1000 + PUMPKIN.PASS_GAP);
    assert.equal(back.g === 'pumpkin' && back.holder, holder);
  });

  it('бахнуло — держащий выбыл, пауза, новый раунд; последний оставшийся — победитель', () => {
    let s = initGame('pumpkin', P3, [], 11, 0);
    const first = s.g === 'pumpkin' ? s.holder : null;
    [s] = run(s, 0, (x) => x.g === 'pumpkin' && x.phase === 'boom');
    if (s.g !== 'pumpkin') return;
    assert.equal(s.boomed, first);
    assert.deepEqual(s.out, [first]);
    assert.equal(s.alive.length, 2);
    assert.equal(s.holder, null);
    const boomAt = s.boomAt;
    let t: number;
    [s, t] = run(s, boomAt, (x) => x.g === 'pumpkin' && x.phase === 'hold');
    assert.ok(t - boomAt >= PUMPKIN.BOOM_MS);
    if (s.g !== 'pumpkin') return;
    assert.equal(s.round, 2);
    assert.ok(s.alive.includes(s.holder!));
    [s] = run(s, t, (x) => x.done);
    if (s.g !== 'pumpkin') return;
    assert.equal(s.alive.length, 1);
    const places = placesOf(s);
    assert.ok(isPerm(places, P3));
    assert.equal(places[0], s.alive[0]);
    assert.equal(places[2], first, 'первый выбывший — последний');
  });

  it('бот передаёт тыкву сам через 1–2,5 с', () => {
    const bots = ['b'];
    let checked = 0;
    for (let seed = 1; seed < 40; seed++) {
      let s = initGame('pumpkin', ['a', 'b'], bots, seed, 0);
      if (s.g !== 'pumpkin') continue;
      if (s.holder !== 'b') {
        s = inputGame(s, 'a', { k: 'pass', to: 'b' }, 500);
      }
      if (s.g !== 'pumpkin' || s.holder !== 'b') continue;
      const got = s.passAt;
      const fuseAt = (s as unknown as { fuseAt: number }).fuseAt;
      let t: number;
      [s, t] = run(s, got, (x) => x.g !== 'pumpkin' || x.holder !== 'b' || x.done, 10);
      if (fuseAt - got < PUMPKIN.BOT_MAX) continue; // бахнуло раньше
      assert.equal(s.g === 'pumpkin' && s.holder, 'a');
      assert.ok(t - got >= PUMPKIN.BOT_MIN - 10 && t - got <= PUMPKIN.BOT_MAX + 10, `бот думал ${t - got} мс`);
      checked++;
    }
    assert.ok(checked > 10, `проверено ${checked}`);
  });

  it('ушёл с тыквой — она достаётся другому, ушедший внизу', () => {
    let s = initGame('pumpkin', P3, [], 5, 0);
    if (s.g !== 'pumpkin') return;
    const holder = s.holder!;
    s = leaveGame(s, holder, 2000);
    if (s.g !== 'pumpkin') return;
    assert.ok(!s.alive.includes(holder));
    assert.ok(s.alive.includes(s.holder!));
    assert.equal(s.done, false);
    assert.deepEqual(s.out, [holder]);
    s = leaveGame(s, s.alive[0], 2500);
    assert.equal(s.done, true, 'остался один — конец');
    assert.ok(isPerm(placesOf(s), P3));
    assert.equal(placesOf(s)[2], holder);
  });
});

describe('Звездопад', () => {
  it('расписание одинаковое у всех, в пределах 30 с и арены', () => {
    const a = starSchedule(99);
    assert.deepEqual(a, starSchedule(99));
    assert.notDeepEqual(a, starSchedule(100));
    assert.ok(a.length >= 25 && a.length <= 60, `звёзд ${a.length}`);
    a.forEach((st) => {
      assert.ok(st.at + STARS.FALL <= STARS.DURATION);
      assert.ok(st.u > 0 && st.u < 1 && st.v > 0 && st.v < 1);
    });
    assert.ok(a.some((st) => st.kind === 'gold') && a.some((st) => st.kind === 'cloud'));
    assert.equal(a[0].kind, 'star');
  });

  it('поймать можно только в момент падения и только один раз; золотая — 3 очка', () => {
    const seed = 21;
    let s = initGame('stars', P3, [], seed, 1000);
    const sched = starSchedule(seed);
    const st = sched[0];
    const land = starLand(1000, st);
    assert.equal(inputGame(s, 'a', { k: 'catch', i: 0 }, land - STARS.EARLY - 10), s, 'рано');
    assert.equal(inputGame(s, 'a', { k: 'catch', i: 0 }, land + STARS.LATE + 10), s, 'поздно');
    s = inputGame(s, 'a', { k: 'catch', i: 0 }, land);
    assert.equal(s.g === 'stars' && s.scores.a, 1);
    assert.equal(inputGame(s, 'b', { k: 'catch', i: 0 }, land + 10), s, 'уже поймана');
    const gold = sched.find((x) => x.kind === 'gold')!;
    s = inputGame(s, 'b', { k: 'catch', i: gold.i }, starLand(1000, gold));
    assert.equal(s.g === 'stars' && s.scores.b, STARS.GOLD);
    const cloud = sched.find((x) => x.kind === 'cloud')!;
    assert.equal(inputGame(s, 'c', { k: 'catch', i: cloud.i }, starLand(1000, cloud)), s, 'тучку не ловят');
    assert.equal(inputGame(s, 'c', { k: 'catch', i: 999 }, land), s, 'нет такой звезды');
  });

  it('тучка оглушает на 1 с: в это время звезда не ловится', () => {
    const seed = 21;
    let s = initGame('stars', P3, [], seed, 0);
    const sched = starSchedule(seed);
    const cloud = sched.find((x) => x.kind === 'cloud')!;
    const cl = starLand(0, cloud);
    s = inputGame(s, 'a', { k: 'zap', i: cloud.i }, cl);
    if (s.g !== 'stars') return;
    assert.equal(s.stun.a, cl + STARS.STUN);
    assert.equal(inputGame(s, 'a', { k: 'zap', i: cloud.i }, cl + 20), s, 'дважды одной тучкой — нет');
    const next = sched.find((x) => x.kind !== 'cloud' && starLand(0, x) > cl && starLand(0, x) < cl + STARS.STUN);
    if (next) assert.equal(inputGame(s, 'a', { k: 'catch', i: next.i }, starLand(0, next)), s, 'оглушённый не ловит');
    const later = sched.find((x) => x.kind !== 'cloud' && starLand(0, x) > cl + STARS.STUN + 50)!;
    const caught = inputGame(s, 'a', { k: 'catch', i: later.i }, starLand(0, later));
    assert.notEqual(caught, s, 'после оглушения снова ловит');
  });

  it('30 с — конец; места по очкам, при равенстве выше тот, кто набрал раньше', () => {
    const seed = 8;
    let s = initGame('stars', P3, [], seed, 0);
    const sched = starSchedule(seed).filter((x) => x.kind === 'star');
    s = inputGame(s, 'c', { k: 'catch', i: sched[0].i }, starLand(0, sched[0]));
    s = inputGame(s, 'b', { k: 'catch', i: sched[1].i }, starLand(0, sched[1]));
    s = inputGame(s, 'b', { k: 'catch', i: sched[2].i }, starLand(0, sched[2]));
    s = inputGame(s, 'c', { k: 'catch', i: sched[3].i }, starLand(0, sched[3]));
    let t: number;
    [s, t] = run(s, 0, (x) => x.done);
    assert.ok(t >= STARS.DURATION && t < STARS.DURATION + 100);
    assert.deepEqual(placesOf(s), ['b', 'c', 'a'], 'b набрал 2 раньше c');
    assert.deepEqual(bestOf(s), { a: 0, b: 2, c: 2 });
  });

  it('ушёл — выбыл: счёт замер, место внизу, рекорда нет', () => {
    const seed = 8;
    let s = initGame('stars', P3, [], seed, 0);
    const sched = starSchedule(seed).filter((x) => x.kind === 'star');
    s = inputGame(s, 'a', { k: 'catch', i: sched[0].i }, starLand(0, sched[0]));
    s = leaveGame(s, 'a', 5000);
    assert.equal(inputGame(s, 'a', { k: 'catch', i: sched[3].i }, starLand(0, sched[3])), s);
    [s] = run(s, 5000, (x) => x.done);
    assert.equal(placesOf(s)[2], 'a');
    assert.equal(bestOf(s).a, undefined);
    assert.ok(isPerm(placesOf(s), P3));
  });

  it('близко к звезде — по эллипсу', () => {
    assert.ok(near({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.55 }, 0.03, 0.1));
    assert.ok(!near({ x: 0.5, y: 0.5 }, { x: 0.54, y: 0.5 }, 0.03, 0.1));
    assert.ok(!near({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.65 }, 0.03, 0.1));
  });
});

describe('Реакция', () => {
  const wait = (s: GameState) => (s.g === 'reaction' ? s : null)!;

  it('зелёный через 2–6 с; кто быстрее — тот берёт раунд', () => {
    let s = initGame('reaction', P3, [], 4, 0);
    const g = wait(s).greenAt;
    assert.ok(g >= REACTION.MIN_WAIT && g <= REACTION.MAX_WAIT);
    s = inputGame(s, 'a', { k: 'tap', r: 1, ms: 320 }, g + 400);
    s = inputGame(s, 'b', { k: 'tap', r: 1, ms: 280 }, g + 400);
    assert.equal(wait(s).phase, 'wait');
    s = inputGame(s, 'c', { k: 'tap', r: 1, ms: 450 }, g + 500);
    assert.equal(wait(s).phase, 'result', 'все ответили — раунд закрыт сразу');
    assert.equal(wait(s).winner, 'b');
    assert.equal(wait(s).points.b, 1);
    assert.deepEqual(wait(s).bestMs, { a: 320, b: 280, c: 450 });
  });

  it('нажал на красный или слишком быстро — фальстарт, раунд проигран', () => {
    let s = initGame('reaction', P3, [], 4, 0);
    const g = wait(s).greenAt;
    s = inputGame(s, 'a', { k: 'tap', r: 1, ms: null }, g - 500);
    s = inputGame(s, 'b', { k: 'tap', r: 1, ms: 40 }, g + 100);
    assert.deepEqual(wait(s).answers, { a: 'fs', b: 'fs' });
    assert.equal(inputGame(s, 'a', { k: 'tap', r: 1, ms: 200 }, g + 300), s, 'второй раз не жмут');
    s = inputGame(s, 'c', { k: 'tap', r: 1, ms: 900 }, g + 1000);
    assert.equal(wait(s).winner, 'c', 'медленный, но честный');
  });

  it('все фальстартнули или молчат — очка нет; чужой раунд и поздний ответ не считаются', () => {
    let s = initGame('reaction', P3, [], 9, 0);
    const g = wait(s).greenAt;
    assert.equal(inputGame(s, 'a', { k: 'tap', r: 2, ms: 300 }, g + 300), s, 'не тот раунд');
    assert.equal(inputGame(s, 'a', { k: 'tap', r: 1, ms: REACTION.ANSWER_MS + 1 }, g + 3000), s, 'поздно');
    s = inputGame(s, 'a', { k: 'tap', r: 1, ms: null }, g - 100);
    [s] = run(s, g, (x) => wait(x).phase === 'result');
    assert.equal(wait(s).winner, null);
    assert.deepEqual(wait(s).points, { a: 0, b: 0, c: 0 });
  });

  it('боты жмут через 250–450 мс', () => {
    for (let seed = 1; seed < 30; seed++) {
      let s = initGame('reaction', ['a', 'bot'], ['bot'], seed, 0);
      const g = wait(s).greenAt;
      [s] = run(s, 0, (x) => wait(x).answers.bot !== undefined, 5);
      const ms = wait(s).answers.bot;
      assert.ok(typeof ms === 'number' && ms >= REACTION.BOT_MIN && ms <= REACTION.BOT_MAX, `бот ${ms}`);
      assert.ok(g > 0);
    }
  });

  it('5 раундов; ничья по очкам — выше тот, у кого лучшее время', () => {
    let s = initGame('reaction', ['a', 'b'], [], 13, 0);
    let t = 0;
    const plan: [number, number][] = [
      [300, 310],
      [400, 250],
      [320, 330],
      [500, 260],
      [999, 999],
    ];
    for (const [ma, mb] of plan) {
      const g = wait(s).greenAt;
      s = inputGame(s, 'a', { k: 'tap', r: wait(s).round, ms: ma }, g + ma);
      s = inputGame(s, 'b', { k: 'tap', r: wait(s).round, ms: mb }, g + mb + 1);
      [s, t] = run(s, Math.max(t, g), (x) => x.done || wait(x).phase === 'wait');
    }
    assert.equal(s.done, true);
    assert.equal(wait(s).round, REACTION.ROUNDS);
    // a: раунды 1, 3, 5 (999 — у обоих, первый по порядку) = 3; b: 2, 4 = 2
    assert.deepEqual(wait(s).points, { a: 3, b: 2 });
    assert.deepEqual(placesOf(s), ['a', 'b']);
    assert.deepEqual(bestOf(s), { a: 300, b: 250 });

    // равные очки: лучшее время решает
    let q = initGame('reaction', ['a', 'b'], [], 13, 0);
    const plan2: [number, number][] = [
      [300, 310],
      [400, 240],
      [320, 330],
      [500, 260],
      [null as unknown as number, null as unknown as number],
    ];
    for (const [ma, mb] of plan2) {
      const g = wait(q).greenAt;
      q = inputGame(q, 'a', { k: 'tap', r: wait(q).round, ms: ma }, g + 10);
      q = inputGame(q, 'b', { k: 'tap', r: wait(q).round, ms: mb }, g + 10);
      [q, t] = run(q, g, (x) => x.done || wait(x).phase === 'wait');
    }
    assert.deepEqual(wait(q).points, { a: 2, b: 2 });
    assert.deepEqual(placesOf(q), ['b', 'a'], 'у b лучшее 240');
  });

  it('ушёл посреди раунда — выбыл; остался один — конец', () => {
    let s = initGame('reaction', P3, [], 4, 0);
    const g = wait(s).greenAt;
    s = inputGame(s, 'a', { k: 'tap', r: 1, ms: 300 }, g + 300);
    s = inputGame(s, 'b', { k: 'tap', r: 1, ms: 350 }, g + 350);
    s = leaveGame(s, 'c', g + 400);
    assert.equal(wait(s).phase, 'result', 'остальные уже ответили — раунд закрыт');
    s = leaveGame(s, 'b', g + 500);
    assert.equal(s.done, true);
    assert.deepEqual(placesOf(s), ['a', 'b', 'c']);
  });
});

describe('Камень, ножницы, бумага', () => {
  const R = (s: GameState) => (s.g === 'rps' ? s : null)!;

  it('исходы: одинаково или все три — ничья, иначе проигравшие выбывают', () => {
    assert.deepEqual(rpsOutcome({ a: 'rock', b: 'rock', c: 'rock' }), { result: 'draw', lost: [] });
    assert.deepEqual(rpsOutcome({ a: 'rock', b: 'paper', c: 'scissors' }), { result: 'draw', lost: [] });
    assert.deepEqual(rpsOutcome({ a: 'rock', b: 'scissors' }), { result: 'rock', lost: ['b'] });
    assert.deepEqual(rpsOutcome({ a: 'paper', b: 'scissors', c: 'paper' }), { result: 'scissors', lost: ['a', 'c'] });
    assert.deepEqual(rpsOutcome({ a: 'paper', b: 'rock', c: 'rock' }), { result: 'paper', lost: ['b', 'c'] });
    const all: [Hand, Hand, Hand][] = [];
    HANDS.forEach((x) => HANDS.forEach((y) => HANDS.forEach((z) => all.push([x, y, z]))));
    all.forEach(([x, y, z]) => {
      const { result, lost } = rpsOutcome({ a: x, b: y, c: z });
      const kinds = new Set([x, y, z]).size;
      if (kinds !== 2) assert.equal(result, 'draw');
      else assert.ok(lost.length >= 1 && lost.length <= 2);
    });
  });

  it('выбор скрыт до «раз!»; не выбрал за 5 с — случайный', () => {
    let s = initGame('rps', P3, [], 6, 0);
    s = inputGame(s, 'a', { k: 'pick', r: 1, h: 'rock' }, 500);
    s = inputGame(s, 'a', { k: 'pick', r: 1, h: 'paper' }, 800); // передумал
    const pub = pubGame(s) as unknown as Record<string, unknown>;
    assert.equal(pub.picks, undefined, 'чужие руки не видны');
    assert.deepEqual(R(s).picked, ['a']);
    assert.equal(R(s).shown, null);
    let t: number;
    [s, t] = run(s, 800, (x) => R(x).phase === 'chant');
    assert.ok(t >= RPS.CHOOSE_MS);
    assert.deepEqual(R(s).auto.sort(), ['b', 'c']);
    assert.equal(R(s).shown, null, 'до «раз!» всё ещё скрыто');
    [s] = run(s, t, (x) => R(x).phase === 'reveal');
    assert.equal(R(s).shown!.a, 'paper');
    assert.ok(HANDS.includes(R(s).shown!.b) && HANDS.includes(R(s).shown!.c));
  });

  it('все выбрали — «раз!» сразу, без ожидания 5 с', () => {
    let s = initGame('rps', ['a', 'b'], [], 6, 0);
    s = inputGame(s, 'a', { k: 'pick', r: 1, h: 'rock' }, 300);
    s = inputGame(s, 'b', { k: 'pick', r: 1, h: 'scissors' }, 400);
    s = tickGame(s, 450);
    assert.equal(R(s).phase, 'chant');
    s = tickGame(s, 450 + RPS.CHANT_MS);
    assert.equal(R(s).result, 'rock');
    assert.deepEqual(R(s).lost, ['b']);
    s = tickGame(s, 450 + RPS.CHANT_MS + RPS.REVEAL_MS);
    assert.equal(s.done, true);
    assert.deepEqual(placesOf(s), ['a', 'b']);
  });

  it('ничья — переигровка тем же составом', () => {
    let s = initGame('rps', P3, [], 6, 0);
    s = inputGame(s, 'a', { k: 'pick', r: 1, h: 'rock' }, 100);
    s = inputGame(s, 'b', { k: 'pick', r: 1, h: 'paper' }, 100);
    s = inputGame(s, 'c', { k: 'pick', r: 1, h: 'scissors' }, 100);
    let t: number;
    [s, t] = run(s, 100, (x) => R(x).phase === 'reveal');
    assert.equal(R(s).result, 'draw');
    [s] = run(s, t, (x) => R(x).phase === 'choose');
    assert.equal(R(s).round, 2);
    assert.deepEqual(R(s).alive, P3);
    assert.equal(inputGame(s, 'a', { k: 'pick', r: 1, h: 'rock' }, t + 100), s, 'выбор для старого раунда не считается');
  });

  it('боты выбирают сами; игра всегда доходит до одного победителя', () => {
    for (let seed = 1; seed < 80; seed++) {
      let s = initGame('rps', ['x', 'y', 'z'], ['y', 'z'], seed, 0);
      [s] = run(s, 0, (q) => q.done || R(q).phase !== 'choose');
      if (!s.done) assert.ok(R(s).picked.includes('y') && R(s).picked.includes('z'));
      [s] = run(s, 0, (q) => q.done);
      assert.equal(s.done, true, `зерно ${seed}`);
      assert.equal(R(s).alive.length, 1);
      assert.ok(isPerm(placesOf(s), ['x', 'y', 'z']));
    }
  });

  it('ушёл — выбыл; остался один — победил', () => {
    let s = initGame('rps', P3, [], 6, 0);
    s = inputGame(s, 'b', { k: 'pick', r: 1, h: 'rock' }, 100);
    s = leaveGame(s, 'b', 200);
    assert.deepEqual(R(s).picked, []);
    assert.equal(s.done, false);
    s = leaveGame(s, 'a', 300);
    assert.equal(s.done, true);
    assert.deepEqual(placesOf(s), ['c', 'a', 'b']);
  });
});

describe('любая партия заканчивается, места — все игроки без повторов', () => {
  // Случайные ходы людей, боты, выходы посреди игры — 4 игры × 120 зёрен
  for (const game of GAME_IDS) {
    it(game, () => {
      for (let seed = 1; seed <= 120; seed++) {
        const r = rng(seed * 31 + game.length);
        const n = 2 + Math.floor(r() * 5); // 2–6
        const players = Array.from({ length: n }, (_, i) => `m${i}`);
        const bots = players.filter(() => r() < 0.4);
        const humans = players.filter((m) => !bots.includes(m));
        let s = initGame(game as GameId, players, bots, seed, 0);
        const sched = game === 'stars' ? starSchedule(seed) : [];
        let t = 0;
        const gone = new Set<string>();
        while (!s.done && t < 15 * 60_000) {
          t += 100;
          s = tickGame(s, t);
          for (const m of humans) {
            if (gone.has(m)) continue;
            if (r() < 0.0015) {
              gone.add(m);
              s = leaveGame(s, m, t);
              continue;
            }
            if (s.g === 'pumpkin' && s.holder === m && r() < 0.2) s = inputGame(s, m, { k: 'pass', to: players[Math.floor(r() * n)] }, t);
            if (s.g === 'stars' && r() < 0.3) {
              const st = sched[Math.floor(r() * sched.length)];
              s = inputGame(s, m, { k: st.kind === 'cloud' ? 'zap' : 'catch', i: st.i }, t);
            }
            if (s.g === 'reaction' && s.phase === 'wait' && r() < 0.1) s = inputGame(s, m, { k: 'tap', r: s.round, ms: t < s.greenAt ? null : t - s.greenAt }, t);
            if (s.g === 'rps' && s.phase === 'choose' && r() < 0.05) s = inputGame(s, m, { k: 'pick', r: s.round, h: HANDS[Math.floor(r() * 3)] }, t);
          }
        }
        assert.equal(s.done, true, `${game} зерно ${seed} не закончилась`);
        const places = placesOf(s);
        assert.ok(isPerm(places, players), `${game} зерно ${seed}: ${places.join(',')}`);
        // выбывшие из-за ухода — ниже всех, кто доиграл
        const firstGone = places.findIndex((m) => gone.has(m));
        if (firstGone >= 0 && s.g !== 'rps' && s.g !== 'pumpkin') assert.ok(places.slice(firstGone).every((m) => gone.has(m) || s.out.includes(m)));
        Object.values(bestOf(s)).forEach((v) => assert.ok(Number.isFinite(v)));
        const pub = pubGame(s) as unknown as Record<string, unknown>;
        assert.equal(pub.r, undefined);
        assert.ok(JSON.stringify(pub).length < 8000, 'состояние для сети маленькое');
      }
    });
  }
});
