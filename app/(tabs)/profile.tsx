// Профиль: свой чибик и желания; можно открыть профиль партнёра и исполнить его желание
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chibi } from '../../src/components/Chibi';
import { HeartsBurst } from '../../src/components/Effects';
import { Icon } from '../../src/components/Icon';
import { Button, Card, Empty, ErrorBox, IconButton, Input, Pressy, Row, Screen, Segmented, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { addWish, deleteWish, fetchMoods, fetchWishes, setWishDone, updateMyProfile } from '../../src/lib/api';
import { CHIBI_KINDS, CHIBI_LABELS, chibiKindOf } from '../../src/lib/chibi';
import { dayKeyOf, formatDayShort, relativeDay, todayKey } from '../../src/lib/dates';
import { confirmAction } from '../../src/lib/dialogs';
import { entryMix, mixDominant } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { haptic } from '../../src/lib/motion';
import { wishStats } from '../../src/lib/report';
import { C, R, S } from '../../src/theme';
import type { ChibiKind, Profile, Wish } from '../../src/types';

type Who = 'me' | 'partner';

export default function ProfileScreen() {
  const { me, partner, refresh: refreshProfiles } = usePair();
  const day = todayKey();
  const version = useTableVersion('wishes', 'mood_entries', 'profiles');
  const { data, setData, refreshing, error, refresh, reload } = useLoader(async () => {
    const [wishes, moods] = await Promise.all([fetchWishes(), fetchMoods(day, day)]);
    return { wishes, moods };
  }, [day, version]);

  const [who, setWho] = useState<Who>('me');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hearts, setHearts] = useState(0);

  const person: Profile | null = who === 'me' ? me : partner;
  const wishes = useMemo(() => (data?.wishes ?? []).filter((w) => w.user_id === person?.id), [data, person]);
  const active = wishes.filter((w) => !w.is_done);
  const done = wishes.filter((w) => w.is_done).slice(0, 12);

  if (!me) return null;

  const nameOf = (id: string | null) => (id === me.id ? 'ты' : id && partner && id === partner.id ? partner.display_name : 'партнёр');
  const lastMood = person ? data?.moods.find((m) => m.user_id === person.id) : undefined;
  const top = lastMood ? mixDominant(entryMix(lastMood)) : null;
  const stats = wishStats(data?.wishes ?? [], me.id);

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addWish({ day, title, note: null, horizon: 'today' });
      haptic.success();
      setTitle('');
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const fulfil = async (wish: Wish, doneNow: boolean) => {
    if (data) setData({ ...data, wishes: data.wishes.map((w) => (w.id === wish.id ? { ...w, is_done: doneNow, done_by: doneNow ? me.id : null } : w)) });
    try {
      await setWishDone(wish.id, doneNow);
      if (doneNow) {
        haptic.success();
        setHearts((n) => n + 1);
      }
      reload();
    } catch (e) {
      showError(e);
      reload();
    }
  };

  const remove = (wish: Wish) =>
    confirmAction(
      'Удалить желание?',
      wish.title,
      'Удалить',
      async () => {
        try {
          await deleteWish(wish.id);
          reload();
        } catch (e) {
          showError(e);
        }
      },
      true,
    );

  const pick = async (kind: ChibiKind) => {
    setPicking(false);
    try {
      await updateMyProfile(me.id, { chibi: { ...(me.chibi ?? {}), kind } });
      haptic.success();
      await refreshProfiles();
    } catch (e) {
      showError(e);
    }
  };

  const isMe = who === 'me';

  return (
    <Screen
      tabs
      title="Профиль"
      refreshing={refreshing}
      onRefresh={refresh}
      right={<IconButton icon="settings" label="Настройки" onPress={() => router.push('/settings')} />}
    >
      {partner ? (
        <Segmented
          options={[
            { value: 'me', label: 'Я' },
            { value: 'partner', label: partner.display_name },
          ]}
          value={who}
          onChange={(v) => {
            setWho(v);
            setPicking(false);
          }}
        />
      ) : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {person ? (
        <Card style={styles.hero}>
          <View>
            <Chibi kind={chibiKindOf(person)} emotion={top?.key ?? 'calm'} value={top?.value ?? 30} pose="idle" size={110} />
            <HeartsBurst trigger={hearts} x={55} y={50} scale={0.8} />
          </View>
          <View style={styles.heroText}>
            <Txt weight="display" size={22} numberOfLines={1}>
              {person.display_name}
            </Txt>
            <Txt muted size={14}>
              {CHIBI_LABELS[chibiKindOf(person)]} · {top ? `сейчас: ${top.emotion.label.toLowerCase()}` : 'настроение не отмечено'}
            </Txt>
            <Txt faint size={13}>
              Желаний исполнено: {isMe ? stats.byPartner : stats.byMe} для {isMe ? 'тебя' : person.display_name}
            </Txt>
            {isMe ? (
              <Button title={picking ? 'Отмена' : 'Сменить чибика'} variant="secondary" small onPress={() => setPicking((p) => !p)} />
            ) : null}
          </View>
        </Card>
      ) : null}

      {isMe && picking ? (
        <Card title="Какой чибик твой?">
          <View style={styles.kinds}>
            {CHIBI_KINDS.map((kind) => {
              const selected = chibiKindOf(me) === kind;
              return (
                <Pressy
                  key={kind}
                  onPress={() => pick(kind)}
                  style={styles.kindItem}
                  innerStyle={[styles.kindInner, selected ? styles.kindSelected : null]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={CHIBI_LABELS[kind]}
                >
                  <Chibi kind={kind} emotion="joy" value={35} pose="idle" size={72} />
                  <Txt weight="heavy" size={12} center>
                    {CHIBI_LABELS[kind]}
                  </Txt>
                </Pressy>
              );
            })}
          </View>
          <Txt faint size={12}>
            Причёски, глаза, рост и остальное можно будет настроить в следующих обновлениях.
          </Txt>
        </Card>
      ) : null}

      {isMe ? (
        <Card title="Желание на сегодня">
          <Input
            placeholder="Чего хочется? Например: погулять вечером"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <Button title="Загадать" icon="gift" onPress={add} loading={busy} disabled={!title.trim()} />
          {partner ? (
            <Txt faint size={12}>
              {partner.display_name} увидит его в твоём профиле и сможет исполнить.
            </Txt>
          ) : null}
        </Card>
      ) : null}

      <Card title={isMe ? 'Сейчас хочу' : `${person?.display_name ?? 'Партнёр'} хочет`}>
        {active.length === 0 ? (
          <Empty text={isMe ? 'Пока ничего — загадай желание выше' : 'Пока ничего не загадано'} />
        ) : null}
        {active.map((w) => (
          <View key={w.id} style={styles.wish}>
            <View style={[styles.wishIcon, { backgroundColor: isMe ? 'rgba(143,162,255,0.18)' : 'rgba(255,158,187,0.18)' }]}>
              <Icon name="gift" size={18} color={isMe ? C.me : C.partner} />
            </View>
            <View style={styles.flex}>
              <Txt weight="bold" size={15}>
                {w.title}
              </Txt>
              <Txt faint size={12}>
                {relativeDay(w.day)}
                {w.horizon === 'future' ? ' · когда-нибудь' : ''}
              </Txt>
            </View>
            {isMe ? (
              <IconButton icon="trash" label="Удалить желание" size={36} tint="transparent" color={C.faint} onPress={() => remove(w)} />
            ) : (
              <Button title="Исполнить" icon="check" small onPress={() => fulfil(w, true)} />
            )}
          </View>
        ))}
      </Card>

      <Card title="Исполнено" right={<Txt faint size={13}>{wishes.filter((w) => w.is_done).length} из {wishes.length}</Txt>}>
        {done.length === 0 ? <Empty text="Исполненных желаний пока нет" /> : null}
        {done.map((w) => (
          <Row key={w.id} gap={S.md} style={styles.doneRow}>
            <Icon name="check" size={18} color={C.good} />
            <View style={styles.flex}>
              <Txt size={15} style={styles.doneTitle}>
                {w.title}
              </Txt>
              <Txt faint size={12}>
                исполнил(а) {nameOf(w.done_by)}
                {w.done_at ? `, ${formatDayShort(dayKeyOf(w.done_at))}` : ''}
              </Txt>
            </View>
            {!isMe && w.done_by === me.id ? (
              <Button title="Вернуть" variant="ghost" small onPress={() => fulfil(w, false)} />
            ) : null}
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  heroText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  kinds: { flexDirection: 'row', gap: S.sm },
  kindItem: { flex: 1 },
  kindInner: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: S.md,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kindSelected: { borderColor: C.accent, backgroundColor: 'rgba(255,107,138,0.14)' },
  wish: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 4 },
  wishIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  doneRow: { paddingVertical: 2 },
  doneTitle: { textDecorationLine: 'line-through', color: C.muted },
});
