// Профиль: свой чибик и желания; можно открыть профиль партнёра и исполнить его желание
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chibi } from '../../src/components/Chibi';
import { CodeSheet } from '../../src/components/CodeSheet';
import { HeartsBurst } from '../../src/components/Effects';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, Card, Empty, ErrorBox, IconButton, Input, Pressy, Row, Screen, Segmented, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { addWish, deleteWish, fetchMoods, fetchWishes, setWishDone } from '../../src/lib/api';
import { lookOf } from '../../src/lib/chibi';
import { dayKeyOf, formatDayShort, relativeDay, todayKey } from '../../src/lib/dates';
import { confirmAction } from '../../src/lib/dialogs';
import { entryMix, mixDominant } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { openWhatsNew, useWhatsNew } from '../../src/lib/whatsNew';
import { refreshAccess, useAccess } from '../../src/lib/access';
import { useScreenFocused } from '../../src/lib/focus';
import { haptic } from '../../src/lib/motion';
import { wishStats } from '../../src/lib/report';
import { C, S } from '../../src/theme';
import type { Profile, Wish } from '../../src/types';

type Who = 'me' | 'partner';

// Круглые плитки под карточкой: всё второстепенное собрано здесь
const HUB: { key: string; label: string; icon: IconName; color: string; ring: string; href?: '/wardrobe' | '/settings' | '/dev' }[] = [
  { key: 'wardrobe', label: 'Гардероб', icon: 'hanger', color: C.partner, ring: 'rgba(255,158,187,0.4)', href: '/wardrobe' },
  { key: 'codes', label: 'Коды', icon: 'key', color: C.warn, ring: 'rgba(255,194,102,0.4)' },
  { key: 'news', label: 'Что нового', icon: 'gift', color: C.good, ring: 'rgba(94,211,160,0.4)' },
  { key: 'settings', label: 'Настройки', icon: 'settings', color: C.me, ring: 'rgba(143,162,255,0.4)', href: '/settings' },
];

export default function ProfileScreen() {
  const { me, partner } = usePair();
  const news = useWhatsNew();
  const access = useAccess();
  const focused = useScreenFocused();
  useEffect(() => {
    if (focused && me?.id) refreshAccess(me.id);
  }, [focused, me?.id]);
  const hub = HUB;
  const day = todayKey();
  const version = useTableVersion('wishes', 'mood_entries', 'profiles');
  const { data, setData, refreshing, error, refresh, reload } = useLoader(async () => {
    const [wishes, moods] = await Promise.all([fetchWishes(), fetchMoods(day, day)]);
    return { wishes, moods };
  }, [day, version]);

  const [who, setWho] = useState<Who>('me');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState(false);
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

  const isMe = who === 'me';

  return (
    <Screen
      tabs
      title="Профиль"
      right={
        access ? (
          <IconButton icon="wrench" label="Комната разработчиков" onPress={() => router.push('/dev')} />
        ) : undefined
      }
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {partner ? (
        <Segmented
          options={[
            { value: 'me', label: 'Я' },
            { value: 'partner', label: partner.display_name },
          ]}
          value={who}
          onChange={setWho}
        />
      ) : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {person ? (
        <Card style={styles.hero}>
          <Pressy
            onPress={isMe ? () => router.push('/wardrobe') : () => setHearts((n) => n + 1)}
            haptics={!isMe}
            scaleTo={0.96}
            accessibilityLabel={isMe ? 'Твой чибик. Нажми, чтобы открыть гардероб' : `Чибик: ${person.display_name}`}
          >
            <View style={styles.stage}>
              <View style={styles.stageGlow} />
              <Chibi look={lookOf(person)} emotion={top?.key ?? 'calm'} value={top?.value ?? 30} pose="idle" size={124} />
            </View>
            <HeartsBurst trigger={hearts} x={62} y={56} scale={0.8} />
          </Pressy>
          <View style={styles.heroText}>
            <Txt weight="display" size={22} numberOfLines={1}>
              {person.display_name}
            </Txt>
            <Txt muted size={14}>
              {top ? `Сейчас: ${top.emotion.label.toLowerCase()}` : 'Настроение не отмечено'}
            </Txt>
            <Txt faint size={13}>
              Желаний исполнено: {isMe ? stats.byPartner : stats.byMe} для {isMe ? 'тебя' : person.display_name}
            </Txt>
            {isMe ? <Button title="Гардероб" icon="hanger" variant="secondary" small onPress={() => router.push('/wardrobe')} /> : null}
          </View>
        </Card>
      ) : null}

      <View style={styles.hub}>
        {hub.map((h) => (
          <Pressy
            key={h.key}
            onPress={() => (h.key === 'codes' ? setCodes(true) : h.key === 'news' ? openWhatsNew() : router.push(h.href!))}
            style={styles.hubItem}
            scaleTo={0.9}
            accessibilityLabel={h.label}
          >
            <View style={[styles.hubCircle, { borderColor: h.ring }]}>
              <Icon name={h.icon} size={24} color={h.color} />
              {h.key === 'news' && !news.seen ? <View style={styles.newDot} /> : null}
            </View>
            <Txt weight="bold" size={12} center muted numberOfLines={1}>
              {h.label}
            </Txt>
          </Pressy>
        ))}
      </View>

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

      <CodeSheet
        visible={codes}
        onClose={() => setCodes(false)}
        onWear={(ids) => {
          setCodes(false);
          router.push({ pathname: '/wardrobe', params: { wear: ids.join(',') } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  heroText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  stage: { width: 124, height: 176, alignItems: 'center' },
  stageGlow: {
    position: 'absolute',
    bottom: -2,
    width: 116,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(155,140,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,158,187,0.35)',
  },
  hub: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: S.sm },
  hubItem: { width: 68, alignItems: 'center' },
  newDot: { position: 'absolute', top: 4, right: 4, width: 11, height: 11, borderRadius: 6, backgroundColor: C.accent, borderWidth: 2, borderColor: '#1A1530' },
  hubCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.glass,
    borderWidth: 1.5,
  },
  wish: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 4 },
  wishIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  doneRow: { paddingVertical: 2 },
  doneTitle: { textDecorationLine: 'line-through', color: C.muted },
});
