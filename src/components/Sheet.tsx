// Панель снизу поверх экрана: затемнение + стеклянная карточка, выезжает пружиной.
// Закрывается нажатием на затемнение, «назад» на Android или крестиком.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { C, R, S } from '../theme';
import { IconButton, Txt } from './ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function Sheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const y = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(visible);

  useEffect(() => {
    if (visible) setShown(true);
    if (reduce) {
      y.setValue(visible ? 0 : 1);
      if (!visible) setShown(false);
      return;
    }
    const anim = visible
      ? Animated.spring(y, { toValue: 0, useNativeDriver: nativeDriver, speed: 16, bounciness: 5 })
      : Animated.timing(y, { toValue: 1, duration: 180, useNativeDriver: nativeDriver });
    anim.start(({ finished }) => {
      if (finished && !visible) setShown(false);
    });
    return () => anim.stop();
  }, [visible, reduce, y]);

  return (
    <Modal visible={shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть" />
      </Animated.View>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.panel,
            { paddingBottom: insets.bottom + S.lg, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 520] }) }] },
          ]}
        >
          <View style={styles.grip} />
          {title ? (
            <View style={styles.header}>
              <Txt weight="display" size={19} style={styles.flex}>
                {title}
              </Txt>
              <IconButton icon="close" label="Закрыть" size={38} onPress={onClose} />
            </View>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(5,4,12,0.62)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    backgroundColor: '#1A1530',
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.glassBorder,
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
    gap: S.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    boxShadow: '0px -14px 40px rgba(4,2,14,0.5), inset 0px 1px 0px rgba(255,255,255,0.14)',
  },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md },
});
