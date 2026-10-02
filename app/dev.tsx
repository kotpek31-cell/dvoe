// Комната разработчиков. Вход — 7 нажатий на номер версии в настройках или плитка в профиле (только с ролью).
// Экран лишь показывает кнопки: каждое действие сервер проверяет по роли. Управление ролями — только у владельца.
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';
import { Icon } from '../src/components/Icon';
import { MushroomArt } from '../src/components/scene/Mushrooms';
import { Button, Card, Chip, Empty, ErrorBox, Input, Pressy, Row, Screen, Segmented, showError, Txt } from '../src/components/ui';
import { useAbility } from '../src/context/AbilityProvider';
import { usePair } from '../src/context/PairProvider';
import { useAccess } from '../src/lib/access';
import {
  devCreateCode,
  devMushroomsSet,
  devSetMushrooms,
  devFindUser,
  devGrantItem,
  devListCodes,
  devListRoles,
  devRemoveRole,
  devRevokeItem,
  devSetCodeActive,
  devSetRole,
  devStats,
  devTestPartnerCreate,
  devTestPartnerRemove,
  devTestPartnerSleep,
  devRoomResetRecords,
  isDevRole,
  roomKick,
  roomSetCapacity,
  roomState,
  type DevUser,
} from '../src/lib/api';
import { syncCatalog, useCatalog, type ItemRow } from '../src/lib/catalog';
import { confirmAction } from '../src/lib/dialogs';
import { setDevOverride, useDevOverride } from '../src/lib/devOverride';
import { useLoader } from '../src/lib/hooks';
import { LOCATIONS } from '../src/lib/locations';
import { haptic } from '../src/lib/motion';
import { MUSH_COLORS, MUSH_NAME, showHatReveal, type MushColor } from '../src/lib/mushrooms';
import type { DayTime } from '../src/lib/scene';
import { C, R, S } from '../src/theme';

type Tab = 'give' | 'codes' | 'check' | 'stats' | 'roles';

const CAT_LABEL: Record<string, string> = {
  hair: 'Причёски',
  eyes: 'Глаза',
  hat: 'Шляпы',
  face: 'Лицо',
  top: 'Верх',
  bottom: 'Низ',
  shoes: 'Обувь',
  back: 'Спина',
  hand: 'В руках',
  ability: 'Способности',
};

function useItemsByCat() {
  const catalog = useCatalog();
  return useMemo(() => {
    const groups = new Map<string, ItemRow[]>();
    [...catalog.values()]
      .sort((a, b) => a.sort - b.sort)
      .forEach((it) => groups.set(it.cat, [...(groups.get(it.cat) ?? []), it]));
    return [...groups.entries()];
  }, [catalog]);
}

// ---------- Выдача ----------
function GiveTab() {
  const { me } = usePair();
  const catalog = useCatalog();
  const groups = useItemsByCat();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<DevUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const find = async (q = query) => {
    if (!q.trim()) return;
    setBusy('find');
    setNotFound(false);
    try {
      const u = await devFindUser(q);
      setUser(u);
      setNotFound(!u);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (it: ItemRow, owned: boolean) => {
    if (!user) return;
    setBusy(it.id);
    try {
      if (owned) await devRevokeItem(user.id, it.id);
      else await devGrantItem(user.id, it.id);
      haptic.success();
      setUser(await devFindUser(user.short_id ?? user.email));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const owned = new Set(user?.inventory.map((v) => v.item_id) ?? []);

  return (
    <>
      <Card title="Кому">
        <Input placeholder="Email или ID из 6 символов" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => find()} />
        <Row>
          <Button title="Найти" icon="check" onPress={() => find()} loading={busy === 'find'} disabled={!query.trim()} style={styles.flex} />
          {me?.short_id ? (
            <Button
              title="Себе"
              variant="secondary"
              onPress={() => {
                setQuery(me.short_id!);
                find(me.short_id!);
              }}
              style={styles.flex}
            />
          ) : null}
        </Row>
        {notFound ? <Txt color={C.bad}>Никого не нашли — проверь email или ID</Txt> : null}
      </Card>
      {user ? (
        <Card title={user.display_name} right={<Txt faint size={13}>{user.short_id ?? ''}</Txt>}>
          <Txt muted size={14}>
            {user.is_bot ? 'тестовый партнёр' : user.email}
            {user.title ? ` · ${user.title}` : ''}
          </Txt>
          <Txt faint size={13}>
            Нажми на вещь: серая — выдать, подсвеченная — забрать (надетая снимется). Бесплатные есть у всех.
          </Txt>
          {groups.map(([cat, items]) => {
            const paid = items.filter((it) => it.source !== 'free');
            if (!paid.length) return null;
            return (
              <View key={cat} style={styles.group}>
                <Txt weight="heavy" size={13} color={C.muted}>
                  {CAT_LABEL[cat] ?? cat}
                </Txt>
                <View style={styles.chips}>
                  {paid.map((it) => {
                    const has = owned.has(it.id);
                    return busy === it.id ? (
                      <ActivityIndicator key={it.id} color={C.accent} />
                    ) : (
                      <Chip key={it.id} label={it.name} selected={has} onPress={() => toggle(it, has)} />
                    );
                  })}
                </View>
              </View>
            );
          })}
          {catalog.size === 0 ? <Empty text="Каталог ещё не загрузился" /> : null}
        </Card>
      ) : null}
    </>
  );
}

// ---------- Коды ----------
function CodesTab() {
  const groups = useItemsByCat();
  const catalog = useCatalog();
  const { data, error, reload } = useLoader(devListCodes, []);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [rewards, setRewards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      await devCreateCode(code, title, rewards);
      haptic.success();
      setCode('');
      setTitle('');
      setRewards([]);
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Новый код">
        <Txt faint size={13}>
          Сам код уходит только на сервер — в базе хранится его отпечаток. Код на «Core» получит один человек на всё приложение.
        </Txt>
        <Input placeholder="Код" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Input placeholder="Название набора" value={title} onChangeText={setTitle} maxLength={60} />
        {groups.map(([cat, items]) => {
          const paid = items.filter((it) => it.source !== 'free');
          if (!paid.length) return null;
          return (
            <View key={cat} style={styles.group}>
              <Txt weight="heavy" size={13} color={C.muted}>
                {CAT_LABEL[cat] ?? cat}
              </Txt>
              <View style={styles.chips}>
                {paid.map((it) => (
                  <Chip
                    key={it.id}
                    label={it.name}
                    selected={rewards.includes(it.id)}
                    onPress={() => setRewards((r) => (r.includes(it.id) ? r.filter((x) => x !== it.id) : [...r, it.id]))}
                  />
                ))}
              </View>
            </View>
          );
        })}
        <Button title={`Создать код${rewards.length ? ` · ${rewards.length}` : ''}`} icon="key" onPress={create} loading={busy} disabled={code.trim().length < 4 || !title.trim() || !rewards.length} />
      </Card>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {(data ?? []).map((c) => (
        <Card key={c.id}>
          <Row style={styles.between}>
            <Pressy onPress={() => setOpen(open === c.id ? null : c.id)} style={styles.flex} scaleTo={0.98} accessibilityLabel={`${c.title}, введён ${c.count} раз`}>
              <Txt weight="heavy" size={16}>
                {c.title}
                {c.is_core ? ' · Core' : ''}
              </Txt>
              <Txt muted size={13}>
                введён {c.count} · {c.rewards.map((r) => catalog.get(r)?.name ?? r).join(', ')}
              </Txt>
            </Pressy>
            <Switch
              value={c.active}
              onValueChange={(v) => devSetCodeActive(c.id, v).then(reload).catch(showError)}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: C.good }}
              thumbColor="#FFFFFF"
              accessibilityLabel={c.active ? 'Код включён' : 'Код выключен'}
            />
          </Row>
          {open === c.id
            ? c.redeemed.length
              ? c.redeemed.map((r, i) => (
                  <Txt key={i} size={13} color={C.muted}>
                    {r.name ?? '—'} · {r.email ?? ''} · {new Date(r.at).toLocaleString('ru-RU')}
                  </Txt>
                ))
              : <Txt faint size={13}>Пока никто не вводил</Txt>
            : null}
        </Card>
      ))}
    </>
  );
}

// ---------- Проверка ----------
const TIMES: { value: DayTime | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Как сейчас' },
  { value: 'day', label: 'День' },
  { value: 'evening', label: 'Вечер' },
  { value: 'night', label: 'Ночь' },
];

// ---------- Комната на троих ----------
function RoomCard() {
  const access = useAccess();
  const owner = access?.role === 'owner';
  const { data, error, reload } = useLoader(roomState, []);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      haptic.success();
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const cap = data?.room.capacity ?? 3;
  const members = data?.members ?? [];
  return (
    <Card title="Комната на троих" right={<Txt faint size={13}>{members.length} из {cap}</Txt>}>
      <Txt faint size={13}>
        Общая площадка для своих: гуляете, даёте пять, применяете способности. Вход и через плитку «Комната» в профиле.
      </Txt>
      <Button title="Войти" icon="door" onPress={() => router.push('/room')} />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {owner ? (
        <Row style={styles.between}>
          <Txt weight="heavy" size={15}>
            Мест
          </Txt>
          <Row>
            <Button title="−" small variant="secondary" disabled={cap <= 2} loading={busy === 'cap-'} onPress={() => run('cap-', () => roomSetCapacity(cap - 1))} />
            <Txt weight="display" size={18}>
              {cap}
            </Txt>
            <Button title="+" small variant="secondary" disabled={cap >= 6} loading={busy === 'cap+'} onPress={() => run('cap+', () => roomSetCapacity(cap + 1))} />
          </Row>
        </Row>
      ) : null}
      {members.map((m) => (
        <Row key={m.id} style={styles.between}>
          <View style={styles.flex}>
            <Txt weight="heavy" size={14} numberOfLines={1}>
              {m.name} · {m.title}
            </Txt>
            <Txt muted size={12}>
              {m.bot ? 'бот' : Date.now() - Date.parse(m.seen_at) < 60_000 ? 'на экране комнаты' : 'не на экране'}
            </Txt>
          </View>
          {owner ? <Button title="Вывести" small variant="danger" loading={busy === m.id} onPress={() => run(m.id, () => roomKick(m.id))} /> : null}
        </Row>
      ))}
      {owner ? (
        <Button
          title="Сбросить рекорды"
          icon="undo"
          variant="secondary"
          loading={busy === 'records'}
          onPress={() => confirmAction('Сбросить рекорды комнаты?', 'Победы и лучшие результаты обнулятся у всех. Полученные вещи останутся.', 'Сбросить', () => run('records', devRoomResetRecords), true)}
        />
      ) : null}
    </Card>
  );
}

// ---------- Порядок грибов (только владелец) ----------
// После сохранения порядок не показывается никому — даже здесь: только «задан / не задан»
function MushroomCard() {
  const { data: isSet, reload } = useLoader(devMushroomsSet, []);
  const [seq, setSeq] = useState<MushColor[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await devSetMushrooms(seq);
      haptic.success();
      setSeq([]);
      setSaved(true);
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Порядок грибов" right={<Txt size={13} color={isSet ? C.good : C.warn}>{isSet ? 'задан' : 'не задан'}</Txt>}>
      <Txt faint size={13}>
        5 нажатий на грибы — «Сохранить». Цвета могут повторяться. После сохранения порядок не показывается никому, даже тебе.
      </Txt>
      <Row style={styles.mushSlots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.mushSlot, seq[i] ? styles.mushSlotFull : null]}>
            {seq[i] ? <MushroomArt color={seq[i]} size={30} /> : <Txt faint size={13}>{i + 1}</Txt>}
          </View>
        ))}
      </Row>
      <Row style={styles.mushPick}>
        {MUSH_COLORS.map((c) => (
          <Pressy
            key={c}
            onPress={() => {
              if (seq.length >= 5) return;
              haptic.light();
              setSaved(false);
              setSeq((q) => [...q, c]);
            }}
            innerStyle={styles.mushBtn}
            scaleTo={0.9}
            accessibilityLabel={`Гриб: ${MUSH_NAME[c]}`}
          >
            <MushroomArt color={c} size={36} />
          </Pressy>
        ))}
      </Row>
      {saved ? (
        <Txt size={13} color={C.good}>
          Порядок сохранён
        </Txt>
      ) : null}
      <Row>
        <Button title="Очистить" variant="secondary" style={styles.flex} disabled={!seq.length || busy} onPress={() => setSeq([])} />
        <Button title="Сохранить" icon="check" style={styles.flex} disabled={seq.length < 5} loading={busy} onPress={save} />
      </Row>
    </Card>
  );
}

function CheckTab() {
  const access = useAccess();
  const { partner, refresh } = usePair();
  const { rehearse } = useAbility();
  const override = useDevOverride();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
      haptic.success();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <RoomCard />
      <Card title="Способности вхолостую">
        <Txt faint size={13}>
          Сцена только у тебя: без записи, пуша и перезарядки.
        </Txt>
        <Row>
          <Button
            title="Объятия"
            icon="heart"
            variant="secondary"
            style={styles.flex}
            onPress={() => {
              rehearse('ability.hug');
              router.navigate('/home');
            }}
          />
          <Button
            title="Мог"
            icon="flame"
            variant="secondary"
            style={styles.flex}
            onPress={() => {
              rehearse('ability.mog');
              router.navigate('/home');
            }}
          />
        </Row>
        <Row>
          <Button
            title="Мог в шляпу грибника"
            icon="flame"
            variant="secondary"
            style={styles.flex}
            onPress={() => {
              rehearse('ability.mog', { blocked: true });
              router.navigate('/home');
            }}
          />
        </Row>
        <Row>
          <Button title="Шляпа: получение" icon="sparkle" variant="secondary" style={styles.flex} onPress={() => showHatReveal(true)} />
        </Row>
      </Card>
      {access?.role === 'owner' ? <MushroomCard /> : null}

      <Card title="Время и место на этом устройстве">
        <Txt faint size={13}>
          До перезапуска приложения. Пока включено, на главной висит «Режим проверки».
        </Txt>
        <View style={styles.chips}>
          {TIMES.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={(override.time ?? 'auto') === t.value}
              onPress={() => setDevOverride({ time: t.value === 'auto' ? undefined : t.value })}
            />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip label="Место пары" selected={!override.location} onPress={() => setDevOverride({ location: undefined })} />
          {LOCATIONS.map((l) => (
            <Chip key={l.id} label={l.name} selected={override.location === l.id} onPress={() => setDevOverride({ location: l.id })} />
          ))}
        </View>
      </Card>

      <Card title="Тестовый партнёр">
        <Txt faint size={13}>
          Чибик-бот в твоей паре: на нём проверяются «Думаю о тебе» и способности, он отвечает тем же. Только если настоящего партнёра нет.
        </Txt>
        {!partner ? (
          <Button title="Создать тестового партнёра" icon="plus" onPress={() => run('create', devTestPartnerCreate)} loading={busy === 'create'} />
        ) : (
          <>
            <Txt size={14}>
              Сейчас в паре: {partner.display_name}
              {partner.sleeping_since ? ' (спит)' : ''}
            </Txt>
            <Row>
              <Button
                title={partner.sleeping_since ? 'Разбудить' : 'Уложить спать'}
                icon="sleep"
                variant="secondary"
                style={styles.flex}
                onPress={() => run('sleep', () => devTestPartnerSleep(!partner.sleeping_since))}
                loading={busy === 'sleep'}
              />
              <Button
                title="Удалить"
                icon="trash"
                variant="danger"
                style={styles.flex}
                loading={busy === 'remove'}
                onPress={() =>
                  confirmAction('Удалить тестового партнёра?', 'Бот и всё, что с ним связано, пропадут. Настоящих людей это не трогает.', 'Удалить', () =>
                    run('remove', async () => {
                      const n = await devTestPartnerRemove();
                      if (!n) throw new Error('Тестового партнёра нет — в паре настоящий человек');
                    }),
                  true)
                }
              />
            </Row>
          </>
        )}
      </Card>
    </>
  );
}

// ---------- Статистика ----------
function StatsTab() {
  const { data, error, reload, refreshing } = useLoader(devStats, []);
  const tiles: [string, number | undefined][] = [
    ['аккаунтов', data?.accounts],
    ['пар', data?.pairs],
    ['активных пар за 7 дней', data?.active_pairs_7d],
    ['активны сегодня', data?.active_today],
    ['способностей сегодня', data?.casts_today],
    ['кодов сегодня', data?.codes_today],
  ];
  return (
    <>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <View style={styles.tiles}>
        {tiles.map(([label, v]) => (
          <View key={label} style={styles.tile}>
            <Txt weight="display" size={26}>
              {v ?? '—'}
            </Txt>
            <Txt muted size={13}>
              {label}
            </Txt>
          </View>
        ))}
      </View>
      <Txt faint size={12} center>
        Тестовые партнёры не считаются. «Сегодня» — по Москве.
      </Txt>
      <Button title="Обновить" variant="secondary" onPress={reload} loading={refreshing} />
    </>
  );
}

// ---------- Роли (только владелец) ----------
function RolesTab() {
  const { data, error, reload } = useLoader(devListRoles, []);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<'developer' | 'guest'>('developer');
  const [busy, setBusy] = useState(false);

  const give = async () => {
    setBusy(true);
    try {
      await devSetRole(query, title, level);
      haptic.success();
      setQuery('');
      setTitle('');
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Добавить в комнату по ID">
        <Txt faint size={13}>
          ID человек видит у себя: Настройки → «Твой ID». Можно и email. «Разработчик» — вся комната разработчиков, кроме этого раздела; «Только комната» — только общая комната, без выдачи вещей и кодов. Название — любое.
        </Txt>
        <Input placeholder="ID из 6 символов или email" value={query} onChangeText={setQuery} autoCapitalize="characters" autoCorrect={false} />
        <Segmented
          options={[
            { value: 'developer', label: 'Разработчик' },
            { value: 'guest', label: 'Только комната' },
          ]}
          value={level}
          onChange={setLevel}
        />
        <Input placeholder={level === 'guest' ? 'Роль (друг)' : 'Роль (тестер)'} value={title} onChangeText={setTitle} maxLength={30} />
        <Button title="Добавить" icon="plus" onPress={give} loading={busy} disabled={!query.trim()} />
      </Card>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {(data ?? []).map((r) => (
        <Card key={r.user_id}>
          <Row style={styles.between}>
            <View style={styles.flex}>
              <Txt weight="heavy" size={16}>
                {r.name ?? r.email} · {r.title}
              </Txt>
              <Txt muted size={13}>
                {r.role === 'guest' ? 'только комната' : r.role === 'owner' ? 'владелец' : 'разработчик'} · {r.short_id ?? r.email}
              </Txt>
            </View>
            {r.role !== 'owner' ? (
              <Button
                title="Снять"
                small
                variant="danger"
                onPress={() =>
                  confirmAction('Снять роль?', `${r.name ?? r.email} потеряет доступ и выйдет из общей комнаты.`, 'Снять', () =>
                    devRemoveRole(r.short_id ?? r.email).then(reload).catch(showError),
                  true)
                }
              />
            ) : (
              <Icon name="star" size={20} color={C.warn} fill={C.warn} />
            )}
          </Row>
        </Card>
      ))}
    </>
  );
}

export default function DevScreen() {
  const access = useAccess();
  const [tab, setTab] = useState<Tab>('give');

  useEffect(() => {
    syncCatalog(true).catch(() => undefined);
  }, []);

  const options = useMemo(() => {
    const list: { value: Tab; label: string }[] = [
      { value: 'give', label: 'Выдать' },
      { value: 'codes', label: 'Коды' },
      { value: 'check', label: 'Тест' },
      { value: 'stats', label: 'Цифры' },
    ];
    if (access?.role === 'owner') list.push({ value: 'roles', label: 'Люди' });
    return list;
  }, [access]);

  if (!access || !isDevRole(access)) {
    return (
      <Screen title="Комната" back background>
        <Empty text="Сюда можно только с ролью разработчика." />
        {access ? <Button title="В общую комнату" icon="door" onPress={() => router.replace('/room')} /> : null}
      </Screen>
    );
  }

  return (
    <Screen title="Комната" subtitle={`Для разработчиков · ты: ${access.title}`} back background>
      <Segmented options={options} value={tab} onChange={setTab} />
      {tab === 'give' ? <GiveTab /> : null}
      {tab === 'codes' ? <CodesTab /> : null}
      {tab === 'check' ? <CheckTab /> : null}
      {tab === 'stats' ? <StatsTab /> : null}
      {tab === 'roles' && access.role === 'owner' ? <RolesTab /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mushSlots: { gap: 8, justifyContent: 'center' },
  mushSlot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.05)' },
  mushSlotFull: { borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  mushPick: { gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  mushBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  between: { justifyContent: 'space-between', alignItems: 'center' },
  group: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  tile: {
    width: '47%',
    flexGrow: 1,
    padding: S.lg,
    borderRadius: R.lg,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    gap: 2,
  },
});
