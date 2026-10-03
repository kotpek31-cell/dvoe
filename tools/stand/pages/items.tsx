// Стенд: каждая вещь каталога на чибике. Параметры: ?cat=top,bottom&size=120&bg=night
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { Chibi } from '../../../src/components/Chibi';
import { LOOKS, type Look } from '../../../src/lib/chibi';
import { STARTER_ITEMS } from '../../../src/lib/catalogStarter';

const q = new URLSearchParams(window.location.search);
const size = Number(q.get('size') ?? 112);
const cats = (q.get('cat') ?? 'hair,eyes,hat,face,top,bottom,shoes,back,hand').split(',');
const bg = q.get('bg') === 'night' ? '#1E2A55' : q.get('bg') === 'dark' ? '#0B0A14' : '#8CCB9A';
const base: Look = { ...LOOKS.nb, top: { id: 'top.tee', c: 'milk' }, bottom: { id: 'bottom.shorts' }, shoes: { id: 'shoes.kedy' } };

function Page() {
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 10 }}>
      {cats.map((cat) => (
        <View key={cat} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 30, paddingTop: size * 0.5, paddingLeft: size * 0.3 }}>
          {STARTER_ITEMS.filter((it) => it.cat === cat).map((it) => (
            <View key={it.id} style={{ width: size, alignItems: 'center' }}>
              <Chibi look={{ ...base, [cat]: { id: it.id } } as Look} emotion="joy" value={45} pose="idle" size={size} still />
              <Text style={{ color: '#1B1426', fontSize: 10, marginTop: 3 }}>{it.id}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
