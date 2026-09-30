// Поле выбора времени: на Android — системный диалог, на iOS — колесо в нижнем листе
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTime } from '../lib/dates';
import { C, R, S } from '../theme';
import { Button } from './ui';

type PickerEvent = { type: string };

export function TimeField({ label, value, onChange }: { label: string; value: Date; onChange: (date: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onChange: (event: PickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(date);
        },
      });
      return;
    }
    setDraft(value);
    setOpen(true);
  };

  return (
    <>
      <Pressable onPress={openPicker} style={({ pressed }) => [styles.field, { opacity: pressed ? 0.8 : 1 }]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatTime(value)}</Text>
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              is24Hour
              locale="ru-RU"
              themeVariant="dark"
              textColor={C.text}
              onChange={(_event: PickerEvent, date?: Date) => {
                if (date) setDraft(date);
              }}
            />
            <View style={styles.actions}>
              <Button title="Отмена" variant="secondary" style={styles.flex} onPress={() => setOpen(false)} />
              <Button
                title="Готово"
                style={styles.flex}
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, backgroundColor: C.card2, borderRadius: R.md, padding: S.md, gap: 4 },
  label: { color: C.muted, fontSize: 13 },
  value: { color: C.text, fontSize: 24, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: C.card, padding: S.lg, paddingBottom: 36, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: S.md },
  flex: { flex: 1 },
});
