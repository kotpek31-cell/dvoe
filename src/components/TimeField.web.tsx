// Веб-версия поля времени: стандартный выбор времени браузера (на iPhone — системное колесо Safari)
import { StyleSheet, Text, View } from 'react-native';
import { formatTime } from '../lib/dates';
import { C, F, R, S } from '../theme';

export function TimeField({ label, value, onChange }: { label: string; value: Date; onChange: (date: Date) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="time"
        value={formatTime(value)}
        onChange={(event: { target: { value: string } }) => {
          const [h, m] = event.target.value.split(':').map(Number);
          if (!Number.isFinite(h) || !Number.isFinite(m)) return;
          const next = new Date(value);
          next.setHours(h, m, 0, 0);
          onChange(next);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
          width: '100%',
          color: C.text,
          fontSize: 24,
          fontFamily: F.display,
          colorScheme: 'dark',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: R.md,
    padding: S.md,
    gap: 4,
  },
  label: { color: C.muted, fontSize: 13, fontFamily: F.bold },
});
