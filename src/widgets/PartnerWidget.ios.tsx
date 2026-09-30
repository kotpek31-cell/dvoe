// iOS-виджет на expo-widgets. Код внутри функции с директивой 'widget'
// выполняется в отдельной среде виджета: только компоненты @expo/ui/swift-ui,
// без хуков, без импортов и без обращений к переменным модуля — всё приходит в props.
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { PartnerSnapshot } from '../lib/widgets';

const PartnerWidgetView = (props: PartnerSnapshot, environment: WidgetEnvironment) => {
  'widget';
  const medium = environment.widgetFamily === 'systemMedium';
  // До первого обновления из приложения props могут быть пустыми
  const title = (props.avatar ?? '💞') + ' ' + (props.name ?? 'Двое');
  const emoji = props.emoji ?? '🫶';
  const label = props.moodLabel ?? 'Откройте приложение';
  const detail = props.moodDetail ?? '';
  const rating = props.rating ?? '—';
  return (
    <VStack alignment="leading" spacing={medium ? 8 : 4}>
      <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>{title}</Text>
      <Spacer />
      <HStack spacing={8}>
        <Text modifiers={[font({ size: medium ? 40 : 30 })]}>{emoji}</Text>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: medium ? 18 : 15, weight: 'bold' })]}>{label}</Text>
          <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93')]}>{detail}</Text>
        </VStack>
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle('#FF6B8A')]}>
        {'Оценка дня: ' + rating}
      </Text>
      {medium ? (
        <Text modifiers={[font({ size: 10 }), foregroundStyle('#8E8E93')]}>{'обновлено в ' + (props.updatedAt ?? '—')}</Text>
      ) : null}
    </VStack>
  );
};

export const PartnerWidget = createWidget('PartnerWidget', PartnerWidgetView);
