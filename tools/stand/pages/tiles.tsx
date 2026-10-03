// Стенд: плитки гардероба (как в app/wardrobe.tsx): каждая вещь в своей обрезке. Параметры: ?cat=hat,hair&size=96
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { LookThumb, type Crop } from '../../../src/components/ItemTile';
import { LOOKS, type Look } from '../../../src/lib/chibi';
import { STARTER_ITEMS } from '../../../src/lib/catalogStarter';

const q = new URLSearchParams(window.location.search);
const size = Number(q.get('size') ?? 96);
const cats = (q.get('cat') ?? 'hair,eyes,hat,face,top,bottom,shoes,back,hand').split(',');
const CROP: Record<string, Crop> = { skin: 'head', hair: 'head', eyes: 'head', hat: 'head', face: 'head', top: 'torso', bottom: 'legs', shoes: 'legs', back: 'wide' };
const base: Look = { ...LOOKS.nb, top: { id: 'top.tee', c: 'milk' }, bottom: { id: 'bottom.shorts' }, shoes: { id: 'shoes.kedy' } };

function Page() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1A1530', padding: 10, gap: 10 }}>
      {cats.map((cat) => (
        <View key={cat} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {STARTER_ITEMS.filter((it) => it.cat === cat).map((it) => (
            <View key={it.id} style={{ width: size, alignItems: 'center' }}>
              <View style={{ width: size, height: size, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <LookThumb look={{ ...base, [cat]: { id: it.id } } as Look} crop={CROP[cat] ?? 'body'} size={size} />
              </View>
              <Text style={{ color: '#B9B2D6', fontSize: 9, marginTop: 2 }}>{it.id}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
