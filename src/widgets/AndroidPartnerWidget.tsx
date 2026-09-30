import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { faceSvg } from '../lib/face';
import type { PartnerSnapshot } from '../lib/widgets';

// Виджет Android рисуется нативными View, поэтому здесь свои примитивы, а не <View>/<Text>.
// Лицо — тот же движок эмоций, что в приложении, только SVG-строкой.
export function AndroidPartnerWidget({ snapshot }: { snapshot: PartnerSnapshot }) {
  const svg = faceSvg(snapshot.faceKey ?? 'calm', snapshot.faceValue ?? 0, 96);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1530',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#3A3160',
        padding: 14,
      }}
    >
      <SvgWidget svg={svg} style={{ height: 68, width: 68 }} />
      <FlexWidget style={{ flexDirection: 'column', marginLeft: 12, flex: 1 }}>
        <TextWidget
          text={snapshot.name}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, color: '#FF9EBB', fontWeight: 'bold' }}
        />
        <TextWidget
          text={snapshot.moodLabel}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 17, color: '#F6F3FF', fontWeight: 'bold' }}
        />
        <TextWidget text={snapshot.moodDetail} maxLines={1} truncate="END" style={{ fontSize: 12, color: '#B9B3CE' }} />
        <TextWidget text={`Оценка дня: ${snapshot.rating}`} maxLines={1} style={{ fontSize: 12, color: '#FFC266', fontWeight: 'bold' }} />
      </FlexWidget>
    </FlexWidget>
  );
}
