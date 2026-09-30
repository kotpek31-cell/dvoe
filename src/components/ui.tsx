// Базовые элементы интерфейса в тёмной теме
import React from 'react';
import {
  ActivityIndicator,
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
import { notify } from '../lib/dialogs';
import { errorMessage } from '../lib/env';
import { C, R, S } from '../theme';

export function showError(error: unknown, title = 'Не получилось') {
  notify(title, errorMessage(error));
}

export function Screen({
  children,
  refreshing = false,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {title || right ? (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
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

export function Txt({
  children,
  style,
  muted,
  size = 15,
  bold,
  color,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  size?: number;
  bold?: boolean;
  color?: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: color ?? (muted ? C.muted : C.text), fontSize: size, fontWeight: bold ? '700' : '400' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: C.accent, secondary: C.card2, ghost: 'transparent', danger: '#3A1C1C' }[variant];
  const fg = { primary: '#1A0A10', secondary: C.text, ghost: C.accent, danger: C.bad }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : null,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.chipText, selected ? { color: '#14141A', fontWeight: '700' } : null]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.faint} {...props} style={[styles.input, props.multiline && styles.inputMulti, props.style]} />;
}

export function Avatar({ emoji, color, size = 40 }: { emoji: string; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

export function Dots({ value, max = 5, color = C.accent }: { value: number; max?: number; color?: string }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < value ? color : C.border }]} />
      ))}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
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
    <Card style={{ borderColor: '#5A2530', borderWidth: 1 }}>
      <Txt color={C.bad}>{message}</Txt>
      {onRetry ? <Button title="Повторить" variant="secondary" small onPress={onRetry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, gap: S.md, paddingBottom: 48 },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, gap: S.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { minHeight: 48, borderRadius: R.md, paddingHorizontal: S.lg, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 36, paddingHorizontal: S.md, borderRadius: R.sm },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14 },
  chip: {
    paddingHorizontal: S.md,
    paddingVertical: 7,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
  },
  chipText: { color: C.text, fontSize: 14 },
  segmented: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.md, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: R.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: C.card2 },
  segmentText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: C.text },
  input: {
    backgroundColor: C.card2,
    color: C.text,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: C.card2 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { color: C.faint, fontSize: 14, textAlign: 'center', paddingVertical: S.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 40 },
});
