import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/navigation';
import { useEvents } from '../src/store/events';
import { Button, C, Chip, Field, type } from '../src/ui';

const types = ['Home repair', 'Appointment', 'Delivery', 'Rental / deposit', 'Incident'];

export default function NewEvent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { create } = useEvents();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState(types[0]);

  const save = () => {
    if (!title.trim()) return;
    const id = create(title.trim(), kind);
    router.replace(`/event/${id}`);
  };

  return (
    <View style={s.page}>
      <ScreenHeader title="New record" fallback="/records" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>
          <Text style={type.display}>What are you recording?</Text>
          <Text style={[type.small, { marginTop: 6 }]}>Start a record, then add photos and notes as things happen. Every entry is timestamped.</Text>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Move-out inspection, flat 4B" autoFocus style={{ marginTop: 24 }} />
          <Text style={[type.smallStrong, { marginTop: 20, marginBottom: 8 }]}>Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {types.map(t => <Chip key={t} label={t} selected={kind === t} onPress={() => setKind(t)} />)}
          </View>
        </View>
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button label="Create record" onPress={save} disabled={!title.trim()} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 12 }
});
