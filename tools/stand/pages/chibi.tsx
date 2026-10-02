// Стенд: чибики в разных образах и позах. Параметры: ?bg=day|night&size=140&poses=idle,walk
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { Chibi, type ChibiPose } from '../../../src/components/Chibi';
import { LOOKS, type Look } from '../../../src/lib/chibi';

const q = new URLSearchParams(window.location.search);
const size = Number(q.get('size') ?? 130);
const poses = (q.get('poses') ?? 'idle,walk,run,wave,hug,cheer,jump,sit,fallen,sleep').split(',') as ChibiPose[];
const bg = q.get('bg') === 'night' ? '#1E2A55' : q.get('bg') === 'dark' ? '#0B0A14' : '#8CCB9A';

const artist: Look = { kind: 'girl', skin: 1, hair: { id: 'hair.long', c: 'pink' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.beret' }, top: { id: 'top.apron' }, bottom: { id: 'bottom.skirt' }, shoes: { id: 'shoes.sapozhki' }, hand: { id: 'hand.brush' } };
const angel: Look = { kind: 'boy', skin: 1, hair: { id: 'hair.vikhor' }, eyes: { id: 'eyes.classic', c: 'blueberry' }, hat: { id: 'hat.halo' }, top: { id: 'top.sweater', c: 'blueberry' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' }, back: { id: 'back.wings' } };
const looks: [string, Look][] = [['boy', LOOKS.boy], ['girl', LOOKS.girl], ['nb', LOOKS.nb], ['artist', artist], ['angel', angel]];
const pick = q.get('looks');
const shown = pick ? looks.filter(([n]) => pick.split(',').includes(n)) : looks;

function Page() {
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 12, gap: 6 }}>
      {shown.map(([name, look]) => (
        <View key={name} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 26, alignItems: 'flex-end', paddingTop: size * 0.35 }}>
          {poses.map((pose) => (
            <View key={pose} style={{ width: size, alignItems: 'center' }}>
              <Chibi look={look} emotion="joy" value={55} pose={pose} size={size} still={q.get('still') === '1'} />
              <Text style={{ color: '#1B1426', fontSize: 11, marginTop: 4 }}>{name} · {pose}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
