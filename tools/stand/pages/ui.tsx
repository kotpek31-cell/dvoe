// Стенд: элементы интерфейса на авроре. Параметры: ?tab=0..5
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { Aurora } from '../../../src/components/Aurora';
import { TabBar } from '../../../src/components/TabBar';
import { Button, Card, Chip, GroupLabel, IconButton, Input, Pill, Row, Segmented, Txt } from '../../../src/components/ui';
import { Icon } from '../../../src/components/Icon';
import { C } from '../../../src/theme';

const q = new URLSearchParams(window.location.search);
const ROUTES = ['home', 'mood', 'sleep', 'us', 'stats', 'profile'].map((name) => ({ name, key: name, params: undefined }));

function Page() {
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');
  const [tab, setTab] = useState(Number(q.get('tab') ?? 1));
  const [chips, setChips] = useState<Record<string, boolean>>({ Радость: true, Нежность: true });
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => setTab(ROUTES.findIndex((r) => r.name === name)),
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aurora />
      <View style={{ padding: 16, gap: 14, paddingTop: 26 }}>
        <Row gap={12}>
          <IconButton icon="back" label="Назад" onPress={() => undefined} size={42} />
          <View style={{ flex: 1 }}>
            <Txt weight="display" size={24}>
              Настроение
            </Txt>
            <Txt muted size={14}>
              Сегодня, 2 октября
            </Txt>
          </View>
          <IconButton icon="settings" label="Настройки" onPress={() => undefined} />
        </Row>
        <Segmented
          options={[
            { value: 'day', label: 'День' },
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <Card title="Как ты сейчас?" right={<Pill><Icon name="heart" size={14} color={C.accent} fill={C.accent} /><Txt weight="heavy" size={13}>7,4</Txt></Pill>}>
          <Txt muted size={14}>
            Выбери, что чувствуешь, — партнёр увидит это на главной.
          </Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {['Радость', 'Нежность', 'Усталость', 'Тревога'].map((t) => (
              <Chip key={t} label={t} selected={chips[t]} onPress={() => setChips((c) => ({ ...c, [t]: !c[t] }))} />
            ))}
          </Row>
          <Input placeholder="Пара слов о дне" />
          <Button title="Сохранить" icon="check" onPress={() => undefined} />
        </Card>
        <GroupLabel text="Кнопки" />
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          <Button title="Готово" variant="success" small onPress={() => undefined} />
          <Button title="Позже" variant="secondary" small onPress={() => undefined} />
          <Button title="Удалить" variant="danger" small icon="trash" onPress={() => undefined} />
          <Button title="Подробнее" variant="ghost" small onPress={() => undefined} />
        </Row>
        <Card tint="rgba(155,140,255,0.1)" title="Сон">
          <Txt weight="display" size={30} color={C.sleep}>
            7 ч 40 мин
          </Txt>
          <Txt muted size={14}>
            Лёг в 23:50, проснулся в 7:30
          </Txt>
        </Card>
      </View>
      <TabBar {...({ state: { routes: ROUTES, index: tab }, navigation } as any)} />
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
