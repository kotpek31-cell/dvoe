// Базовые элементы интерфейса: аврора-фон, стеклянные карточки, пружинящие кнопки
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notify } from '../lib/dialogs';
import { errorMessage } from '../lib/env';
import { haptic } from '../lib/motion';
import { C, F, R, S, TAB_BAR_SPACE } from '../theme';
import { Aurora } from './Aurora';
import { Icon, type IconName } from './Icon';

export function showError(error: unknown, title = 'Не получилось') {
  notify(title, errorMessage(error));
}

type Weight = 'regular' | 'bold' | 'heavy' | 'display' | 'displaySemi';

export function Txt({
  children,
  style,
  muted,
  faint,
  size = 15,
  bold,
  weight,
  color,
  center,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  faint?: boolean;
  size?: number;
  bold?: boolean;
  weight?: Weight;
  color?: string;
  center?: boolean;
  numberOfLines?: number;
}) {
  const w: Weight = weight ?? (bold ? 'bold' : 'regular');
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: color ?? (faint ? C.faint : muted ? C.muted : C.text),
          fontSize: size,
          fontFamily: F[w],
          lineHeight: Math.round(size * (w === 'display' || w === 'displaySemi' ? 1.2 : 1.35)),
        },
        center ? styles.center : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Пружинящее нажатие: элемент чуть сжимается и отскакивает
export function Pressy({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  innerStyle,
  scaleTo = 0.95,
  haptics = true,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptics?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link' | 'checkbox' | 'radio' | 'adjustable' | 'none';
  accessibilityState?: { selected?: boolean; checked?: boolean };
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 14 : 0 }).start();
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              if (haptics) haptic.tap();
              onPress();
            }
          : undefined
      }
      onLongPress={onLongPress}
      onPressIn={() => springTo(scaleTo)}
      onPressOut={() => springTo(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  color = C.text,
  tint = C.glassStrong,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  tint?: string;
}) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityLabel={label}
      scaleTo={0.9}
      innerStyle={[styles.iconButton, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint }]}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={color} />
    </Pressy>
  );
}

// Экран со своим заголовком. background — своя аврора (для экранов поверх вкладок),
// tabs — отступ снизу под плавающие вкладки.
export function Screen({
  children,
  title,
  subtitle,
  right,
  back = false,
  refreshing = false,
  onRefresh,
  background = false,
  tabs = false,
  contentStyle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  background?: boolean;
  tabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };
  return (
    <View style={[styles.root, background ? styles.rootBg : null]}>
      {background ? <Aurora /> : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 14, paddingBottom: (tabs ? TAB_BAR_SPACE : 32) + insets.bottom },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
            ) : undefined
          }
        >
          {title || back || right ? (
            <View style={styles.header}>
              {back ? <IconButton icon="back" label="Назад" onPress={goBack} size={42} /> : null}
              <View style={styles.flex}>
                {title ? (
                  <Txt weight="display" size={back ? 22 : 26} numberOfLines={1}>
                    {title}
                  </Txt>
                ) : null}
                {subtitle ? (
                  <Txt muted size={14}>
                    {subtitle}
                  </Txt>
                ) : null}
              </View>
              {right}
            </View>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Card({
  title,
  right,
  children,
  style,
  tint,
}: {
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
}) {
  return (
    <View style={[styles.card, tint ? { backgroundColor: tint } : null, style]}>
      {title || right ? (
        <View style={styles.cardHeader}>
          {title ? (
            <Txt weight="displaySemi" size={16} style={styles.flexShrink}>
              {title}
            </Txt>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ children, style, gap = S.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

// Подпись группы: «СВЕТЛОЕ ———»
export function GroupLabel({ text }: { text: string }) {
  return (
    <View style={styles.groupLabel}>
      <Txt weight="heavy" size={12} color={C.faint} style={styles.upper}>
        {text}
      </Txt>
      <View style={styles.groupLine} />
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: C.accent, secondary: C.glassStrong, ghost: 'transparent', danger: 'rgba(255,107,107,0.14)', success: C.good }[
    variant
  ];
  const fg = { primary: C.onAccent, secondary: C.text, ghost: C.accent, danger: C.bad, success: '#0E2A1E' }[variant];
  const inactive = Boolean(disabled || loading);
  return (
    <Pressy
      onPress={onPress}
      disabled={inactive}
      style={style}
      accessibilityLabel={title}
      innerStyle={[
        styles.button,
        small ? styles.buttonSmall : null,
        { backgroundColor: bg, opacity: inactive && !loading ? 0.45 : 1 },
        variant === 'secondary' ? styles.buttonBorder : null,
        variant === 'primary' ? styles.buttonGlow : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonRow}>
          {icon ? <Icon name={icon} size={small ? 16 : 20} color={fg} strokeWidth={2.2} /> : null}
          <Txt weight="heavy" size={small ? 14 : 16} color={fg} numberOfLines={1}>
            {title}
          </Txt>
        </View>
      )}
    </Pressy>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = C.accent,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressy
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(selected) }}
      innerStyle={[styles.chip, selected ? { backgroundColor: color, borderColor: color } : null]}
    >
      <Txt weight="bold" size={14} color={selected ? '#1D1526' : C.text}>
        {label}
      </Txt>
    </Pressy>
  );
}

// Переключатель с «переезжающей» подсветкой
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
  }, [index, x]);
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const last = Math.max(1, options.length - 1);
  return (
    <View style={styles.segmented} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.segmentThumb,
            {
              width: segment,
              transform: [{ translateX: x.interpolate({ inputRange: [0, last], outputRange: [0, segment * last] }) }],
            },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Txt weight="heavy" size={14} color={active ? C.text : C.muted} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={C.faint}
      {...props}
      style={[styles.input, props.multiline ? styles.inputMulti : null, props.style]}
    />
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <Txt faint size={14} center style={styles.empty}>
      {text}
    </Txt>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={C.accent} size="large" />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tint="rgba(255,107,107,0.1)" style={styles.errorCard}>
      <Txt color={C.bad}>{message}</Txt>
      {onRetry ? <Button title="Повторить" variant="secondary" small onPress={onRetry} /> : null}
    </Card>
  );
}

// Маленькая стеклянная плашка: «Аня · 6,1»
export function Pill({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.pill, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  root: { flex: 1, backgroundColor: 'transparent' },
  rootBg: { backgroundColor: C.bg },
  content: { paddingHorizontal: S.lg, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: 2, minHeight: 48 },
  card: {
    backgroundColor: C.glass,
    borderColor: C.glassBorder,
    borderWidth: 1,
    borderRadius: R.xl,
    padding: S.lg,
    gap: S.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  groupLabel: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 4 },
  groupLine: { flex: 1, height: 1, backgroundColor: C.border },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.glassBorder },
  button: { minHeight: 52, borderRadius: R.pill, paddingHorizontal: S.xl, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 40, paddingHorizontal: S.lg },
  buttonBorder: { borderWidth: 1, borderColor: C.glassBorder },
  buttonGlow: { boxShadow: '0px 10px 24px rgba(255,107,138,0.3)' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: S.lg,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: C.glass,
    borderColor: C.glassBorder,
    borderWidth: 1,
    borderRadius: R.pill,
    padding: 4,
  },
  segmentThumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255,107,138,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,143,168,0.45)',
  },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: C.text,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: F.regular,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  inputMulti: { minHeight: 76, textAlignVertical: 'top' },
  empty: { paddingVertical: S.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorCard: { borderColor: 'rgba(255,107,107,0.35)' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: R.pill,
    backgroundColor: C.overlay,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
