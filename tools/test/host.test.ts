// Автотесты ведущего мини-игры (колесо → игра → итог → пьедестал): node --test tools/test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { END_MS, GameHost, LEAVE_GRACE, MIN_GAME_MS, PLAY_DELAY, type FinishReply, type GameInit, type GameSnap } from '../../src/lib/games/host.ts';
import * as rules from '../../src/lib/games/rules.ts';

function setup(init: Partial<GameInit> = {}, finish?: (places: string[], best: Record<string, number>) => Promise<FinishReply>) {
  let t = 1_000_000;
  const sent: GameSnap[] = [];
  const calls: { places: string[]; best: Record<string, number>; at: number }[] = [];
  const waits: number[] = [];
  const host = new GameHost(
    { id: 'g1', game: 'rps', seed: 5, host: 'a', players: ['a', 'b', 'c'], bots: ['c'], cx: 0.5, half: 0.15, spots: {}, ...init },
    {
      rules,
      clock: () => t,
      emit: (s) => sent.push(s),
      finish:
        finish ??
        (async (places, best) => {
          calls.push({ places, best, at: t });
          return { ok: true, counted: true, records: [], rewards: [{ user_id: 'u-a', item_id: 'hand.trophy' }] };
        }),
      wait: async (ms) => {
        waits.push(ms);
        t += ms;
      },
    },
  );
  const step = (ms: number, every = 100) => {
    for (let k = 0; k < ms; k += every) {
      t += every;
      host.tick();
    }
  };
  return { host, sent, calls, waits, step, now: () => t, advance: (ms: number) => (t += ms) };
}
const flushAsync = () => new Promise((r) => setTimeout(r, 0));

describe('ведущий', () => {
  it('сначала колесо, через PLAY_DELAY — игра; снимок уходит сразу и раз в 2,5 с', () => {
    const { host, sent, step } = setup();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].phase, 'wheel');
    step(PLAY_DELAY - 200);
    assert.equal(host.snap.phase, 'wheel');
    assert.ok(sent.length >= 3, `пульс: ${sent.length}`);
    step(300);
    assert.equal(host.snap.phase, 'play');
    assert.equal(host.snap.st?.g, 'rps');
    const last = sent[sent.length - 1];
    assert.equal(last.phase, 'play');
    assert.ok(last.v > sent[0].v);
    assert.equal((last.st as unknown as Record<string, unknown>).picks, undefined, 'скрытое не уходит');
  });

  it('ходы принимает только в игре и только от игроков', () => {
    const { host, step } = setup();
    host.input('a', { k: 'pick', r: 1, h: 'rock' });
    step(PLAY_DELAY + 100);
    host.input('zzz', { k: 'pick', r: 1, h: 'rock' });
    host.input('a', { k: 'pick', r: 1, h: 'rock' });
    const st = host.snap.st;
    assert.ok(st?.g === 'rps');
    if (st?.g === 'rps') assert.deepEqual(st.picked, ['a']);
  });

  it('пропал с экрана дольше 2,5 с — выбыл; мелькнул — нет; вышел из комнаты — сразу', () => {
    const { host, step } = setup({ game: 'reaction', players: ['a', 'b', 'c', 'd'], bots: [] });
    step(PLAY_DELAY + 100);
    const all = new Set(['a', 'b', 'c', 'd']);
    host.present(new Set(['a', 'c', 'd']), all); // b пропал
    step(LEAVE_GRACE - 500);
    host.present(new Set(['a', 'c', 'd']), all);
    host.present(new Set(['a', 'b', 'c', 'd']), all); // вернулся
    step(LEAVE_GRACE);
    host.present(new Set(['a', 'b', 'c', 'd']), all);
    let st = host.snap.st;
    assert.ok(st?.g === 'reaction' && st.alive.includes('b'), 'мелькнул — остался');
    host.present(new Set(['a', 'c', 'd']), all);
    step(LEAVE_GRACE + 100);
    host.present(new Set(['a', 'c', 'd']), all);
    st = host.snap.st;
    assert.ok(st?.g === 'reaction' && !st.alive.includes('b') && st.out.includes('b'), 'пропал надолго — выбыл');
    host.present(new Set(['a', 'c', 'd']), new Set(['a', 'c'])); // d вышел из комнаты
    st = host.snap.st;
    assert.ok(st?.g === 'reaction' && st.out.includes('d'));
  });

  it('ушёл ещё во время колеса — выбыл сразу на старте', () => {
    const { host, step } = setup({ game: 'pumpkin', players: ['a', 'b', 'c'], bots: [] });
    host.present(new Set(['a', 'c']), new Set(['a', 'c']));
    step(PLAY_DELAY + 100);
    const st = host.snap.st;
    assert.ok(st?.g === 'pumpkin' && st.out.includes('b') && !st.alive.includes('b'));
  });

  it('конец игры → END_MS → пьедестал; итог на сервер не раньше минимума партии', async () => {
    const { host, calls, step, sent } = setup({ game: 'rps', players: ['a', 'b'], bots: ['b'] });
    step(PLAY_DELAY + 100);
    host.input('a', { k: 'pick', r: 1, h: 'rock' });
    // доиграть (бот выбирает сам, ничьи переигрываются)
    for (let i = 0; i < 4000 && host.snap.phase === 'play'; i++) {
      step(100);
      const st = host.snap.st;
      if (st?.g === 'rps' && st.phase === 'choose' && !st.picked.includes('a')) host.input('a', { k: 'pick', r: st.round, h: 'paper' });
    }
    assert.equal(host.snap.phase, 'end');
    await flushAsync();
    await flushAsync();
    assert.equal(calls.length, 1, 'итог отправлен один раз');
    assert.ok(calls[0].at - host.snap.t0 >= MIN_GAME_MS.rps, 'не раньше минимума');
    assert.ok(rules.GAME_IDS && calls[0].places.length === 2);
    step(END_MS + 100);
    assert.equal(host.snap.phase, 'podium');
    assert.equal(host.snap.result?.saved, true);
    assert.deepEqual(host.snap.result?.rewards, [{ user_id: 'u-a', item_id: 'hand.trophy' }]);
    assert.equal(sent[sent.length - 1].phase, 'podium');
    const before = sent.length;
    step(10_000);
    assert.equal(sent.length, before, 'на пьедестале пульса нет');
  });

  it('сервер сказал «слишком быстро» — повтор; не сохранилось — пьедестал всё равно есть', async () => {
    let n = 0;
    const { host, step } = setup({ game: 'pumpkin', players: ['a', 'b'], bots: [] }, async () => {
      n++;
      return n === 1 ? { ok: false, error: 'too_fast', message: 'рано' } : { ok: false, error: 'result', message: 'Итог не сходится с игроками' };
    });
    step(PLAY_DELAY + 100);
    host.present(new Set(['a']), new Set(['a'])); // b вышел — тыква кончилась
    step(200);
    assert.notEqual(host.snap.phase, 'play');
    for (let i = 0; i < 5; i++) await flushAsync();
    assert.equal(n, 2);
    step(END_MS + 100);
    assert.equal(host.snap.phase, 'podium');
    assert.equal(host.snap.result?.saved, false);
    assert.equal(host.snap.result?.message, 'Итог не сходится с игроками');
    assert.deepEqual(host.snap.result?.places, ['a', 'b']);
  });

  it('прервать: снимок «aborted», дальше тишина', () => {
    const { host, sent, step } = setup();
    step(PLAY_DELAY + 100);
    host.abort('Gaster ушёл');
    assert.equal(host.snap.phase, 'aborted');
    assert.equal(sent[sent.length - 1].reason, 'Gaster ушёл');
    const n = sent.length;
    step(5000);
    assert.equal(sent.length, n);
  });

  it('боты в «Звездопаде» бегут к теням и ловят звёзды', () => {
    const pos: Record<string, { x: number; y: number }> = { b: { x: 0.5, y: 0.5 }, c: { x: 0.4, y: 0.6 } };
    const moves: string[] = [];
    let t = 0;
    const host = new GameHost(
      { id: 'g2', game: 'stars', seed: 77, host: 'a', players: ['a', 'b', 'c'], bots: ['b', 'c'], cx: 0.5, half: 0.15, spots: {} },
      {
        rules,
        clock: () => t,
        emit: () => undefined,
        finish: async () => ({ ok: true, counted: false, records: [], rewards: [] }),
        // бот «добегает» мгновенно — проверяем выбор цели и поимку
        starBots: {
          pos: (m) => pos[m] ?? null,
          move: (m, x, y) => {
            moves.push(m);
            pos[m] = { x, y };
          },
          spot: (st) => rules.starSpot(0.5, 0.15, st),
          rx: 0.03,
          ry: 0.2,
        },
        random: rules.rng(5),
      },
    );
    for (; t < PLAY_DELAY + rules.STARS.DURATION + 500; t += 50) host.tick();
    const st = host.snap.st;
    assert.ok(st?.g === 'stars');
    if (st?.g !== 'stars') return;
    assert.ok(moves.length > 10, `ходов ${moves.length}`);
    const caught = Object.values(st.taken).filter((m) => m === 'b' || m === 'c').length;
    const total = rules.starSchedule(77).filter((x) => x.kind !== 'cloud').length;
    assert.ok(caught >= 6 && caught < total, `боты поймали ${caught} из ${total}`);
    assert.equal(st.scores.a, 0);
    assert.equal(host.snap.phase, 'end');
  });
});
