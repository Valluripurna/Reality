import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../src/navigation';
import { capturePhoto } from '../../src/permissions';
import { Sheet } from '../../src/sheet';
import { useEvents } from '../../src/store/events';
import { useToast } from '../../src/toast';
import { TimelineItem } from '../../src/types';
import { Badge, Button, C, EmptyState, Field, Icon, IconButton, IconName, ListRow, radius, type } from '../../src/ui';

const kindIcon: Record<string, IconName> = {
  Photo: 'camera',
  Note: 'create',
  Action: 'arrow-forward',
  Verification: 'checkmark',
  Location: 'location',
  Message: 'chatbubble'
};

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { events, addItem, setStatus } = useEvents();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const event = events.find(e => e.id === id);

  if (!event) {
    return (
      <View style={s.page}>
        <ScreenHeader title="Record" fallback="/records" />
        <EmptyState icon="document-outline" title="Record not found" body="It may belong to another account on this device." action="All records" onAction={() => router.replace('/records')} />
      </View>
    );
  }

  const add = (item: Omit<TimelineItem, 'id' | 'at'>) => {
    addItem(event.id, { ...item, id: `${Date.now()}`, at: 'Now' });
    setOpen(false);
    setNote('');
    toast.show('Added to record', 'success');
  };

  const share = async () => {
    const lines = [
      `${event.title} — ${event.type}`,
      `Status: ${event.status} · Started ${event.startedAt}`,
      '',
      ...event.items.map(i => `• ${i.at} — ${i.title}${i.detail ? `: ${i.detail}` : ''}`),
      '',
      'Recorded with RealityChain'
    ];
    try { await Share.share({ message: lines.join('\n'), title: event.title }); } catch { /* user dismissed */ }
  };

  return (
    <View style={s.page}>
      <ScreenHeader title="Record" fallback="/records" right={<IconButton icon="share-outline" label="Share record" onPress={share} tone="plain" />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 16, gap: 6 }}>
          <Badge label={event.status === 'Resolved' ? 'Closed' : 'Open'} tone={event.status === 'Resolved' ? 'brand' : 'neutral'} />
          <Text style={type.display}>{event.title}</Text>
          <Text style={type.small}>{event.type} · started {event.startedAt}</Text>
        </View>

        <View style={s.integrity}>
          <Icon name="lock-closed-outline" size={16} color={C.brandDark} />
          <Text style={[type.caption, { flex: 1, color: C.brandDark }]}>Entries are timestamped when added and can't be edited afterwards.</Text>
        </View>

        <Text style={[type.heading, { marginTop: 24, marginBottom: 14 }]}>Timeline · {event.items.length}</Text>
        {event.items.map((item, i) => {
          const last = i === event.items.length - 1;
          const verified = item.kind === 'Verification';
          return (
            <View key={item.id} style={s.row}>
              <View style={s.rail}>
                <View style={[s.dot, verified && { backgroundColor: C.brand }]}>
                  <Icon name={kindIcon[item.kind] ?? 'ellipse'} size={13} color={C.white} />
                </View>
                {!last && <View style={s.line} />}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : 22 }}>
                <Text style={type.caption}>{item.at}</Text>
                <Text style={[type.bodyStrong, { marginTop: 2 }]}>{item.title}</Text>
                {item.detail ? <Text style={[type.small, { marginTop: 2 }]}>{item.detail}</Text> : null}
                {item.imageUri ? <Image source={{ uri: item.imageUri }} style={s.image} /> : null}
              </View>
            </View>
          );
        })}

        {event.status === 'Open' && (
          <Button
            label="Close this record"
            variant="ghost"
            style={{ marginTop: 24 }}
            onPress={() => {
              addItem(event.id, { id: `${Date.now()}-close`, kind: 'Verification', title: 'Record closed', detail: 'Marked as resolved', at: 'Now', verified: true });
              setStatus(event.id, 'Resolved');
              toast.show('Record closed', 'success');
            }}
          />
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button testID="add-entry" label="Add entry" icon="add" onPress={() => setOpen(true)} />
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Add to record">
        <ListRow
          icon="camera-outline"
          title="Take a photo"
          subtitle="Saved with the time it was taken"
          onPress={async () => {
            const uri = await capturePhoto();
            if (uri) add({ kind: 'Photo', title: 'Photo added', detail: '', imageUri: uri });
          }}
        />
        <Field value={note} onChangeText={setNote} placeholder="Or write a note — what did you see or agree?" multiline maxLength={500} />
        <Button label="Save note" disabled={!note.trim()} onPress={() => add({ kind: 'Note', title: 'Note', detail: note.trim() })} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  integrity: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brandSoft, padding: 12, borderRadius: radius.md, marginTop: 16 },
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: C.line, marginTop: 2 },
  image: { width: '100%', height: 170, borderRadius: radius.md, marginTop: 10, backgroundColor: C.surface },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineStrong, backgroundColor: C.white },
});
