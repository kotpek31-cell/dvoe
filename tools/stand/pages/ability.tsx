// Стенд: сцена способности. Параметры: ?kind=hug|mog&blocked=1&time=night&id=meadow
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Animated, View, useWindowDimensions } from 'react-native';
import { AbilityScene, worldTransform } from '../../../src/components/scene/AbilityScene';
import { Location } from '../../../src/components/scene/Location';
import { LOOKS, type Look } from '../../../src/lib/chibi';
import { LOCATION_BG, type LocationId } from '../../../src/lib/locations';
import { sceneTransform, type DayTime } from '../../../src/lib/scene';

const q = new URLSearchParams(window.location.search);
const id = (q.get('id') ?? 'meadow') as LocationId;
const time = (q.get('time') ?? 'evening') as DayTime;
const kind = q.get('kind') === 'mog' ? 'mog' : 'hug';
const artist: Look = { kind: 'girl', skin: 1, hair: { id: 'hair.long', c: 'pink' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.beret' }, top: { id: 'top.apron' }, bottom: { id: 'bottom.skirt' }, shoes: { id: 'shoes.sapozhki' }, hand: { id: 'hand.brush' } };

function Page() {
  const { width, height } = useWindowDimensions();
  const tf = sceneTransform(width, height);
  const size = Math.round(104 * tf.s);
  const t = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(1);
  return (
    <View style={{ flex: 1, backgroundColor: LOCATION_BG[id][time], overflow: 'hidden' }}>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: worldTransform(t, kind, false) }}>
        <Location id={id} width={width} height={height} time={time} active />
      </Animated.View>
      <AbilityScene
        key={n}
        scene={{ key: `k${n}`, ability: kind === 'mog' ? 'ability.mog' : 'ability.hug', from: 'me', at: Date.now(), blocked: q.get('blocked') === '1' }}
        t={t}
        reduce={false}
        caster={{ look: LOOKS.boy, emotion: 'joy', value: 60 }}
        target={{ look: artist, emotion: 'joy', value: 50 }}
        width={width}
        height={height}
        size={size}
        ground={tf.y(534)}
        onDone={() => setTimeout(() => setN((x) => x + 1), 600)}
      />
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
