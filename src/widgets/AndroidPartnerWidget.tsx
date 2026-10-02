import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { faceSvg } from '../lib/face';
import type { PartnerSnapshot } from '../lib/widgets';

// Виджет Android рисуется нативными View, поэтому здесь свои примитивы, а не <View>/<Text>.
// Лицо — тот же движок эмоций, что в приложении, только SVG-строкой.
// Этап фиксации 0.2: раскладка по размеру виджета (width/height в dp от лаунчера) — ничего не обрезается:
// в низком — лицо, имя, настроение и оценка; в высоком — ещё подробность и время обновления.
type Props = { snapshot: PartnerSnapshot; width?: number; height?: number };

const TEXT: ColorProp = '#F6F3FF';
const MUTED: ColorProp = '#B9B3CE';
const PARTNER: ColorProp = '#FF9EBB';
const WARN: ColorProp = '#FFC266';
const SLEEP: ColorProp = '#9B8CFF';

export function AndroidPartnerWidget({ snapshot, width = 250, height = 110 }: Props) {
  const tall = height >= 150;
  const narrow = width < 200;
  const pad = height < 100 ? 10 : 14;
  const face = Math.round(Math.max(40, Math.min(tall ? 84 : 64, height - pad * 2 - (tall ? 40 : 0))));
  const svg = faceSvg(snapshot.faceKey ?? 'calm', snapshot.faceValue ?? 0, 96);
  const sleeping = snapshot.faceKey === 'sleep';
  const chip = (text: string, color: ColorProp, bg: ColorProp) => (
    <FlexWidget style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 }}>
      <TextWidget text={text} maxLines={1} truncate="END" style={{ fontSize: 11.5, color, fontWeight: 'bold' }} />
    </FlexWidget>
  );
  const faceBox = (
    <FlexWidget
      style={{
        width: face + 10,
        height: face + 10,
        borderRadius: (face + 10) / 2,
        backgroundColor: sleeping ? '#2C2558' : '#2A2140',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgWidget svg={svg} style={{ height: face, width: face }} />
    </FlexWidget>
  );
  const rating = snapshot.rating && snapshot.rating !== '—' ? `Оценка дня · ${snapshot.rating}` : null;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: tall ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: tall ? 'center' : 'flex-start',
        backgroundGradient: { from: '#2B1F4A', to: '#120E22', orientation: 'TL_BR' },
        borderRadius: 26,
        borderWidth: 1,
        borderColor: '#3A3160',
        padding: pad,
      }}
    >
      {tall ? (
        <>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 6 }}>
            <TextWidget text={snapshot.name} maxLines={1} truncate="END" style={{ fontSize: 14, color: PARTNER, fontWeight: 'bold' }} />
            <FlexWidget style={{ flex: 1 }} />
            <TextWidget text={snapshot.updatedAt} maxLines={1} style={{ fontSize: 11, color: MUTED }} />
          </FlexWidget>
          {faceBox}
          <TextWidget
            text={snapshot.moodLabel}
            maxLines={2}
            truncate="END"
            style={{ fontSize: 17, color: TEXT, fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}
          />
          {!narrow && snapshot.moodDetail ? (
            <TextWidget text={snapshot.moodDetail} maxLines={1} truncate="END" style={{ fontSize: 12, color: MUTED, marginTop: 2, textAlign: 'center' }} />
          ) : null}
          {sleeping ? chip('Спит', SLEEP, '#2C2558') : rating ? chip(rating, WARN, '#3A2E1E') : null}
        </>
      ) : (
        <>
          {faceBox}
          <FlexWidget style={{ flexDirection: 'column', marginLeft: 12, flex: 1, justifyContent: 'center' }}>
            <TextWidget text={snapshot.name} maxLines={1} truncate="END" style={{ fontSize: 13, color: PARTNER, fontWeight: 'bold' }} />
            <TextWidget text={snapshot.moodLabel} maxLines={1} truncate="END" style={{ fontSize: height < 100 ? 15 : 17, color: TEXT, fontWeight: 'bold' }} />
            {sleeping ? (
              chip(snapshot.moodDetail ? `Спит ${snapshot.moodDetail}` : 'Спит', SLEEP, '#2C2558')
            ) : rating ? (
              chip(rating, WARN, '#3A2E1E')
            ) : !narrow && height >= 100 ? (
              <TextWidget text={snapshot.moodDetail} maxLines={1} truncate="END" style={{ fontSize: 12, color: MUTED, marginTop: 2 }} />
            ) : null}
          </FlexWidget>
        </>
      )}
    </FlexWidget>
  );
}
