// Стенд: локация с двумя чибиками. Параметры: ?id=meadow&time=day|evening|night&part=all&variant=0&chibi=0
import { createRoot } from 'react-dom/client';
import { View, useWindowDimensions } from 'react-native';
import { Chibi } from '../../../src/components/Chibi';
import { Location } from '../../../src/components/scene/Location';
import { LOOKS, type Look } from '../../../src/lib/chibi';
import { LOCATION_BG, type LocationId, type Variant } from '../../../src/lib/locations';
import { NightContext } from '../../../src/lib/night';
import { sceneTransform, type DayTime } from '../../../src/lib/scene';

const q = new URLSearchParams(window.location.search);
const id = (q.get('id') ?? 'meadow') as LocationId;
const time = (q.get('time') ?? 'day') as DayTime;
const variant = Number(q.get('variant') ?? 0) as Variant;
const artist: Look = { kind: 'girl', skin: 1, hair: { id: 'hair.long', c: 'pink' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.beret' }, top: { id: 'top.apron' }, bottom: { id: 'bottom.skirt' }, shoes: { id: 'shoes.sapozhki' }, hand: { id: 'hand.brush' } };

function Page() {
  const { width, height } = useWindowDimensions();
  const tf = sceneTransform(width, height);
  const size = Math.round(104 * tf.s);
  return (
    <NightContext.Provider value={time === 'night'}>
      <View style={{ flex: 1, backgroundColor: LOCATION_BG[id][time], overflow: 'hidden' }}>
        <Location id={id} width={width} height={height} time={time} active variant={variant} />
        {q.get('chibi') === '0' ? null : (
          <>
            <View style={{ position: 'absolute', left: tf.x(60), top: tf.y(520) }}>
              <Chibi look={LOOKS.boy} emotion="joy" value={55} pose={(q.get('pose') as 'idle') ?? 'idle'} size={size} />
            </View>
            <View style={{ position: 'absolute', left: tf.x(190), top: tf.y(548) }}>
              <Chibi look={artist} emotion="love" value={50} pose={(q.get('pose2') as 'wave') ?? 'wave'} size={size} flip />
            </View>
          </>
        )}
      </View>
    </NightContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
