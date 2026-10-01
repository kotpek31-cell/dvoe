// Лицо эмоции (react-native-svg). Геометрию считает src/lib/face.ts — тот же движок, что в макете.
import { memo, useEffect, useId, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { FACE_PATHS, FACE_SPOTS, faceModel, INK, type FaceKey, type FaceModel } from '../lib/face';
import { CLOTH, SKIN } from '../lib/palette';

// Стили глаз чибика (вещи категории «Глаза»): рисует движок лица, а не каталог
export type EyeStyle = 'classic' | 'lashes' | 'sparkle' | 'sleepy' | 'azure';

type Props = {
  emotion: FaceKey;
  value: number;
  size: number;
  bare?: boolean;
  eyes?: number;
  look?: number;
  blink?: boolean; // иногда моргать (и при «Уменьшить движение» — это единственное, что остаётся)
  closed?: boolean; // глаза закрыты всё время
  eyeStyle?: EyeStyle;
  eyeColor?: string; // цвет радужки; уголь — обычные тёмные глаза
  skin?: string; // для сонных век
  blushMin?: number; // у чибика щёчки розовые всегда
};

// Холст чуть больше лица, чтобы слёзы, пламя и «Zzz» не обрезались
const PAD_X = 10;
const PAD_TOP = 14;
const BOX = 120;

// Глаза выбранного стиля и цвета (по рисунку макета, tools/art/chibi.ts)
function StyledEyes({ f, style, color, skin, gid }: { f: FaceModel; style: EyeStyle; color?: string; skin: string; gid: string }) {
  const g = f.geo;
  const open = g.h > 3;
  const sides = [
    [-1, g.cxL],
    [1, g.cxR],
  ] as const;
  if (style === 'azure') {
    return (
      <G opacity={f.eyesOp}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            {open
              ? [
                  <Stop key="a" offset="0" stopColor="#3B4A66" />,
                  <Stop key="b" offset="0.55" stopColor="#6E86A8" />,
                  <Stop key="c" offset="1" stopColor="#CFDCEB" />,
                ]
              : [<Stop key="a" offset="0" stopColor="#C9F1FF" />, <Stop key="c" offset="1" stopColor="#3A7BFF" />]}
          </LinearGradient>
        </Defs>
        <Path d={f.eyeL} fill={`url(#${gid})`} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <Path d={f.eyeR} fill={`url(#${gid})`} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        {open
          ? sides.map(([sd, cx]) => {
              const xo = cx + sd * g.w;
              const xi = cx - sd * g.w;
              return (
                <G key={sd}>
                  <Ellipse cx={cx} cy={g.topMid + g.h * 0.48} rx={g.w * 0.46} ry={g.h * 0.38} fill="#121033" />
                  <Circle cx={cx - g.w * 0.34} cy={g.topMid + g.h * 0.3} r={Math.max(1.8, g.w * 0.32)} fill="#FFFFFF" />
                  <Circle cx={cx + g.w * 0.32} cy={g.topMid + g.h * 0.72} r={g.w * 0.15} fill="#FFFFFF" opacity={0.9} />
                  <Path
                    d={`M${xo} ${g.ey} C${xo} ${g.ey + g.eto} ${xi} ${g.ey + g.eti} ${xi} ${g.ey}`}
                    fill="none"
                    stroke={INK}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <Path d={`M${xo - sd * 0.5} ${g.ey - 2} l${sd * 3.4} -2.6`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
                </G>
              );
            })
          : null}
      </G>
    );
  }
  const ink = !color || color.toUpperCase() === CLOTH.coal[1].toUpperCase();
  const fill = ink ? INK : color;
  const big = style === 'sparkle' ? 1.4 : 1;
  const lid = g.topMid + g.h * 0.42;
  return (
    <G opacity={f.eyesOp}>
      <Path d={f.eyeL} fill={fill} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Path d={f.eyeR} fill={fill} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {!ink && open
        ? sides.map(([sd, cx]) => (
            <Ellipse key={sd} cx={cx} cy={g.topMid + g.h * 0.56} rx={g.w * 0.48} ry={g.h * 0.34} fill={INK} />
          ))
        : null}
      <Circle cx={f.hl.lx} cy={f.hl.y} r={f.hl.r * big} fill="#FFFFFF" opacity={f.hl.op} />
      <Circle cx={f.hl.rx} cy={f.hl.y} r={f.hl.r * big} fill="#FFFFFF" opacity={f.hl.op} />
      {style === 'sparkle' ? (
        <G opacity={f.hl.op}>
          <Circle cx={f.s2.lx} cy={f.s2.y} r={1.5} fill="#FFFFFF" />
          <Circle cx={f.s2.rx} cy={f.s2.y} r={1.5} fill="#FFFFFF" />
        </G>
      ) : f.s2.op > 0 ? (
        <G opacity={f.s2.op}>
          <Circle cx={f.s2.lx} cy={f.s2.y} r={f.s2.r} fill="#FFFFFF" />
          <Circle cx={f.s2.rx} cy={f.s2.y} r={f.s2.r} fill="#FFFFFF" />
        </G>
      ) : null}
      {style === 'lashes'
        ? sides.map(([sd, cx]) => {
            const xo = cx + sd * g.w;
            return (
              <Path
                key={sd}
                d={`M${xo - sd * 1.2} ${g.topMid + g.h * 0.15} l${sd * 3.2} -3.2 M${xo - sd * 3.6} ${g.topMid - 0.4} l${sd * 2} -3.4`}
                fill="none"
                stroke={INK}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            );
          })
        : null}
      {style === 'sleepy' && open
        ? sides.map(([sd, cx]) => (
            <G key={sd}>
              <Path d={`M${cx - g.w - 2} ${g.topMid - 3} H${cx + g.w + 2} V${lid} H${cx - g.w - 2} Z`} fill={skin} />
              <Path
                d={`M${cx - g.w - 0.6} ${lid} Q${cx} ${lid + 1.4} ${cx + g.w + 0.6} ${lid}`}
                fill="none"
                stroke={INK}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </G>
          ))
        : null}
    </G>
  );
}

function FaceView({ emotion, value, size, bare, eyes, look, blink, closed: alwaysClosed, eyeStyle, eyeColor, skin, blushMin = 0 }: Props) {
  const [blinking, setClosed] = useState(false);
  const closed = blinking || Boolean(alwaysClosed);
  const gid = `eye${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    if (!blink || alwaysClosed) return;
    let open: ReturnType<typeof setTimeout> | undefined;
    let shut: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      shut = setTimeout(() => {
        setClosed(true);
        open = setTimeout(() => {
          setClosed(false);
          schedule();
        }, 130);
      }, 2600 + Math.random() * 3800);
    };
    schedule();
    return () => {
      if (open) clearTimeout(open);
      if (shut) clearTimeout(shut);
    };
  }, [blink, alwaysClosed]);

  const f = useMemo(() => faceModel(emotion, value, { bare, eyes, look, blink: closed }), [emotion, value, bare, eyes, look, closed]);
  const k = size / 100;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg
        width={BOX * k}
        height={BOX * k}
        viewBox={`${-PAD_X} ${-PAD_TOP} ${BOX} ${BOX}`}
        style={[styles.canvas, { left: -PAD_X * k, top: -PAD_TOP * k }]}
      >
        {f.glowOp > 0 ? (
          <G opacity={f.glowOp}>
            <Circle cx={50} cy={50} r={45.5} fill="none" stroke={f.glowColor} strokeWidth={2.2} opacity={0.9} />
            <Circle cx={50} cy={50} r={50.5} fill="none" stroke={f.glowColor} strokeWidth={1.3} opacity={0.5} />
          </G>
        ) : null}
        {f.flameOp > 0 ? (
          <G opacity={f.flameOp} transform={`translate(50 55) scale(${f.flameScale}) translate(-50 -55)`}>
            <Path d={FACE_PATHS.flameOuter} fill="#FF7B3A" />
            <Path d={FACE_PATHS.flameInner} fill="#FFC94A" />
          </G>
        ) : null}
        {f.faceOp > 0 ? (
          <G>
            <Circle cx={50} cy={50} r={40} fill={f.color} stroke={f.outline} strokeWidth={1.8} />
            {f.fearOp > 0 ? FACE_PATHS.fear.map((d) => <Path key={d} d={d} fill="#4F86E0" opacity={f.fearOp} />) : null}
            <Ellipse cx={36} cy={27} rx={11} ry={6} transform="rotate(-28 36 27)" fill="#FFFFFF" opacity={0.32} />
          </G>
        ) : null}
        <G transform={`rotate(${f.rot} 50 56)`}>
          <Ellipse cx={f.cheekL} cy={f.cheekY} rx={7.5} ry={4.4} fill="#FF4F86" opacity={Math.max(f.blushOp, blushMin)} />
          <Ellipse cx={f.cheekR} cy={f.cheekY} rx={7.5} ry={4.4} fill="#FF4F86" opacity={Math.max(f.blushOp, blushMin)} />
          {f.bagsOp > 0 ? (
            <G opacity={f.bagsOp}>
              <Path d={f.bagL} fill="none" stroke="#5E4A73" strokeWidth={1.4} strokeLinecap="round" />
              <Path d={f.bagR} fill="none" stroke="#5E4A73" strokeWidth={1.4} strokeLinecap="round" />
            </G>
          ) : null}
          {f.eyesOp > 0 && eyeStyle ? (
            <StyledEyes f={f} style={eyeStyle} color={eyeColor} skin={skin ?? SKIN[1]} gid={gid} />
          ) : f.eyesOp > 0 ? (
            <G opacity={f.eyesOp}>
              <Path d={f.eyeL} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
              <Path d={f.eyeR} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
              <Circle cx={f.hl.lx} cy={f.hl.y} r={f.hl.r} fill="#FFFFFF" opacity={f.hl.op} />
              <Circle cx={f.hl.rx} cy={f.hl.y} r={f.hl.r} fill="#FFFFFF" opacity={f.hl.op} />
              {f.s2.op > 0 ? (
                <G opacity={f.s2.op}>
                  <Circle cx={f.s2.lx} cy={f.s2.y} r={f.s2.r} fill="#FFFFFF" />
                  <Circle cx={f.s2.rx} cy={f.s2.y} r={f.s2.r} fill="#FFFFFF" />
                </G>
              ) : null}
            </G>
          ) : null}
          {f.heartEyes.op > 0 ? (
            <G opacity={f.heartEyes.op}>
              <Path
                d={FACE_PATHS.heart}
                transform={`translate(${f.heartEyes.lx} ${f.heartEyes.y}) scale(${f.heartEyes.scale})`}
                fill="#F0325F"
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <Path
                d={FACE_PATHS.heart}
                transform={`translate(${f.heartEyes.rx} ${f.heartEyes.y}) scale(${f.heartEyes.scale})`}
                fill="#F0325F"
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
            </G>
          ) : null}
          {f.browOp > 0 ? (
            <G opacity={f.browOp}>
              <Path d={f.browL} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
              <Path d={f.browR} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
            </G>
          ) : null}
          <Path d={f.mouth} fill="#7A2940" stroke={INK} strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" />
          {f.tongue.op > 0 ? (
            <Ellipse cx={f.tongue.x} cy={f.tongue.y} rx={f.tongue.rx} ry={f.tongue.ry} fill="#FF7D93" opacity={f.tongue.op} />
          ) : null}
          {f.tears.dropOp > 0 ? (
            <G>
              {f.tears.streamOp > 0 ? (
                <G opacity={f.tears.streamOp}>
                  <Path d={f.tears.streamL} fill="none" stroke="#8ED3FF" strokeWidth={3} strokeLinecap="round" />
                  <Path d={f.tears.streamR} fill="none" stroke="#8ED3FF" strokeWidth={3} strokeLinecap="round" />
                </G>
              ) : null}
              <G opacity={f.tears.dropOp}>
                <Path
                  d={FACE_PATHS.drop}
                  transform={`translate(${f.tears.lx} ${f.tears.y}) scale(${f.tears.scale})`}
                  fill="#8ED3FF"
                  stroke="#4F9FD6"
                  strokeWidth={0.8}
                />
                <Path
                  d={FACE_PATHS.drop}
                  transform={`translate(${f.tears.rx} ${f.tears.y}) scale(${f.tears.scale})`}
                  fill="#8ED3FF"
                  stroke="#4F9FD6"
                  strokeWidth={0.8}
                />
              </G>
            </G>
          ) : null}
        </G>
        {f.sweat.op > 0 ? (
          <G opacity={f.sweat.op} transform={`translate(81 24) scale(${f.sweat.scale})`}>
            <Path d={FACE_PATHS.drop} fill="#A8DEFF" stroke="#4F9FD6" strokeWidth={0.9} />
            <Ellipse cx={-1.1} cy={1.2} rx={0.9} ry={1.5} fill="#FFFFFF" opacity={0.85} />
          </G>
        ) : null}
        {f.anger.op > 0 ? (
          <Path
            d={FACE_PATHS.angerMark}
            transform={`translate(80 18) scale(${f.anger.scale})`}
            fill="none"
            stroke="#E5364F"
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={f.anger.op}
          />
        ) : null}
        {f.steamOp > 0 ? (
          <G opacity={f.steamOp}>
            <G transform="translate(5 30)">
              <Circle cx={0} cy={0} r={4.4} fill="#FFFFFF" />
              <Circle cx={-3} cy={-5} r={3.1} fill="#FFFFFF" />
              <Circle cx={1.5} cy={-9} r={2.2} fill="#FFFFFF" />
            </G>
            <G transform="translate(95 30)">
              <Circle cx={0} cy={0} r={4.4} fill="#FFFFFF" />
              <Circle cx={3} cy={-5} r={3.1} fill="#FFFFFF" />
              <Circle cx={-1.5} cy={-9} r={2.2} fill="#FFFFFF" />
            </G>
          </G>
        ) : null}
        {FACE_SPOTS.hearts.map(([x, y, s], i) =>
          f.hearts[i] > 0 ? (
            <Path
              key={`h${i}`}
              d={FACE_PATHS.heart}
              transform={`translate(${x} ${y}) scale(${s})`}
              fill="#FF4D7A"
              stroke={INK}
              strokeWidth={1.3}
              opacity={f.hearts[i]}
            />
          ) : null,
        )}
        {FACE_SPOTS.sparkles.map(([x, y, s], i) =>
          f.sparkles[i] > 0 ? (
            <Path
              key={`s${i}`}
              d={FACE_PATHS.sparkle}
              transform={`translate(${x} ${y}) scale(${s})`}
              fill="#FFF6C2"
              stroke="#E0A93A"
              strokeWidth={0.9}
              opacity={f.sparkles[i]}
            />
          ) : null,
        )}
        {FACE_SPOTS.zzz.map(([x, y, s], i) =>
          f.zzz[i] > 0 ? (
            <Path
              key={`z${i}`}
              d={FACE_PATHS.z}
              transform={`translate(${x} ${y}) scale(${s})`}
              fill="none"
              stroke="#D4CCFF"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={f.zzz[i]}
            />
          ) : null,
        )}
        {FACE_SPOTS.dots.map(([x, y], i) =>
          f.dots[i] > 0 ? <Circle key={`d${i}`} cx={x} cy={y} r={2} fill="#E4E0F2" opacity={f.dots[i]} /> : null,
        )}
      </Svg>
    </View>
  );
}

export const Face = memo(FaceView);

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
});
