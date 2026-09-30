import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { PartnerSnapshot } from '../lib/widgets';

// Виджет Android рисуется нативными View, поэтому здесь свои примитивы, а не <View>/<Text>
export function AndroidPartnerWidget({ snapshot }: { snapshot: PartnerSnapshot }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#17171D',
        borderRadius: 24,
        padding: 14,
      }}
    >
      <TextWidget
        text={`${snapshot.avatar} ${snapshot.name}`}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 13, color: '#9C9CAB' }}
      />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text={snapshot.emoji} style={{ fontSize: 34 }} />
        <FlexWidget style={{ flexDirection: 'column', marginLeft: 10, flex: 1 }}>
          <TextWidget
            text={snapshot.moodLabel}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 17, color: '#F3F3F6', fontWeight: 'bold' }}
          />
          <TextWidget
            text={snapshot.moodDetail}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12, color: '#9C9CAB' }}
          />
        </FlexWidget>
      </FlexWidget>
      <TextWidget text={`Оценка дня: ${snapshot.rating}`} style={{ fontSize: 13, color: '#FF9EBB', fontWeight: 'bold' }} />
    </FlexWidget>
  );
}
