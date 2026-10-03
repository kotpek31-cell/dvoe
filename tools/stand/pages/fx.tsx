// Стенд: рисунки мини-игр, грибы и эффекты. Параметры: ?bg=dark|forest&fx=1 (эффекты запускаются сразу)
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { CloudArt, Dizzy, HandArt, Pumpkin, Shadow, Spark, StarArt } from '../../../src/components/room/games/art';
import { MushroomArt } from '../../../src/components/scene/Mushrooms';
import { Confetti, HeartsBurst, Ripple, SparkPop, Toast } from '../../../src/components/Effects';
import { MUSH_COLORS } from '../../../src/lib/mushrooms';

const q = new URLSearchParams(window.location.search);
const bg = q.get('bg') === 'forest' ? '#1F3A34' : '#161226';
const Label = ({ t }: { t: string }) => <Text style={{ color: '#B9B2D6', fontSize: 11, marginTop: 4 }}>{t}</Text>;
const Cell = ({ t, children }: { t: string; children: any }) => (
  <View style={{ alignItems: 'center', width: 110, height: 120, justifyContent: 'flex-end' }}>
    {children}
    <Label t={t} />
  </View>
);

function Page() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (q.get('fx') === '0') return;
    const t = setTimeout(() => setN(1), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Cell t="тыква"><Pumpkin size={88} /></Cell>
        <Cell t="искра"><Spark size={44} /></Cell>
        <Cell t="звезда"><StarArt size={64} /></Cell>
        <Cell t="золотая"><StarArt size={64} gold /></Cell>
        <Cell t="тучка"><CloudArt size={96} bolt={false} /></Cell>
        <Cell t="молния"><CloudArt size={96} bolt /></Cell>
        <Cell t="тень"><Shadow w={70} color="#FFD45E" /></Cell>
        <Cell t="камень"><HandArt hand="rock" size={72} /></Cell>
        <Cell t="ножницы"><HandArt hand="scissors" size={72} /></Cell>
        <Cell t="бумага"><HandArt hand="paper" size={72} /></Cell>
        <Cell t="оглушён"><Dizzy size={90} /></Cell>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {MUSH_COLORS.map((c) => (
          <Cell key={c} t={`гриб ${c}`}><MushroomArt color={c} size={72} /></Cell>
        ))}
        {MUSH_COLORS.map((c) => (
          <Cell key={`${c}n`} t={`ночью`}><MushroomArt color={c} size={72} glow={0.6} /></Cell>
        ))}
      </View>
      <View style={{ height: 330, marginTop: 14 }}>
        <HeartsBurst trigger={n} x={140} y={200} scale={1.2} />
        <SparkPop trigger={n} x={420} y={170} scale={1.4} />
        <Ripple trigger={n} x={640} y={200} scale={1.4} />
        <View style={{ position: 'absolute', left: 760, top: 0, width: 380, height: 330 }}>
          <Confetti trigger={n} colors={['#FF6B8A', '#8FA2FF', '#FFC266', '#5ED3A0', '#9B8CFF']} width={380} />
        </View>
        <Toast text={n ? 'Думаю о тебе' : null} top={270} />
      </View>
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<Page />);
