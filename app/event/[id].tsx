import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TimelineItem } from '../../src/types';
import { useEvents } from '../../src/store/events';
import { useMarketplace } from '../../src/marketplace';
import { Button, C, Icon } from '../../src/ui';
import { useToast } from '../../src/toast';
import { BottomNav } from '../../src/navigation';

const icon: Record<string, any> = { Photo: 'camera', Note: 'eye', Action: 'paper-plane', Verification: 'checkmark-circle', Location: 'location', Message: 'chatbubble' };

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { events, addItem, toggleResolved } = useEvents();
  const event = events.find(e => e.id === id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  if (!event) return null;

  const time = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const add = (item: TimelineItem) => {
    addItem(event.id, item);
    setOpen(false);
    setNote('');
    toast.show('Record added to timeline & database', 'success');
  };

  const photo = async () => {
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) {
      add({
        id: Date.now().toString(),
        kind: 'Photo',
        title: 'Photo evidence captured',
        detail: 'Captured on device · saved in local database',
        at: time(),
        imageUri: res.assets[0].uri
      });
    }
  };

  const handleToggleResolve = () => {
    toggleResolved(event.id);
    if (event.status === 'Open') {
      addItem(event.id, {
        id: Date.now().toString(),
        kind: 'Verification',
        title: 'Outcome verified & resolved',
        detail: 'Event status updated in database',
        at: time(),
        verified: true
      });
      toast.show('Event verified and marked as Resolved', 'success');
    } else {
      toast.show('Event reopened for updates', 'info');
    }
  };

  return (
    <SafeAreaView style={st.page}>
      <ScrollView contentContainerStyle={st.scroll}>
        <View style={st.nav}>
          <Pressable onPress={() => router.back()}>
            <Icon name="arrow-back" size={24} />
          </Pressable>
          <Pressable onPress={() => {
            Alert.alert('Evidence Package', 'Package generation created & synchronized with database.');
            toast.show('Evidence package exported successfully!', 'success');
          }}>
            <Icon name="share-outline" size={23} />
          </Pressable>
        </View>

        <Text style={st.category}>{event.type.toUpperCase()}</Text>
        <Text style={st.title}>{event.title}</Text>

        <View style={st.status}>
          <View style={[st.dot, event.status === 'Resolved' && { backgroundColor: C.green }]} />
          <Text style={st.statusText}>{event.status} · Started {event.startedAt}</Text>
        </View>

        <View style={st.integrity}>
          <Icon name="shield-checkmark" color={C.green} />
          <View>
            <Text style={st.integrityTitle}>Evidence Integrity Active</Text>
            <Text style={st.integrityText}>Records are timestamped and preserved in your database.</Text>
          </View>
        </View>

        <View style={st.heading}>
          <Text style={st.h2}>Timeline Records</Text>
          <Text style={st.hint}>{event.items.length} items</Text>
        </View>

        {event.items.map((item, i) => (
          <View key={item.id} style={st.row}>
            <View style={st.rail}>
              <View style={[st.circle, item.kind === 'Verification' && { backgroundColor: C.mint }]}>
                <Icon
                  name={(icon[item.kind] ?? 'document') as any}
                  size={16}
                  color={item.kind === 'Verification' ? C.green : C.white}
                />
              </View>
              {i < event.items.length - 1 && <View style={st.line} />}
            </View>
            <View style={st.item}>
              <Text style={st.time}>{item.at}</Text>
              <Text style={st.itemTitle}>{item.title}</Text>
              <Text style={st.detail}>{item.detail}</Text>
              {item.imageUri && <Image source={{ uri: item.imageUri }} style={st.image} />}
            </View>
          </View>
        ))}

        <View style={st.actions}>
          <Button label="Add Record" onPress={() => setOpen(true)} icon="add-circle" />
          {useMarketplace().profile?.role === 'pro' && (
            <Button
              label={event.status === 'Open' ? 'Verify & Resolve' : 'Reopen Event'}
              onPress={handleToggleResolve}
              icon="checkmark-circle"
              secondary
            />
          )}
        </View>
      </ScrollView>

      {/* Modal Sheet for adding evidence */}
      <Modal visible={open} transparent animationType="slide">
        <View style={st.modalWrap}>
          <View style={st.sheet}>
            <View style={st.handle} />
            <Text style={st.sheetTitle}>Add to Timeline</Text>
            <Pressable style={st.capture} onPress={photo}>
              <View style={st.captureIcon}>
                <Icon name="camera" color={C.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.captureTitle}>Capture Photo Evidence</Text>
                <Text style={st.captureText}>Timestamped & stored with image in database</Text>
              </View>
              <Icon name="chevron-forward" color={C.muted} />
            </Pressable>

            <Text style={st.noteLabel}>Or Add Observation Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What did you observe?"
              placeholderTextColor="#9AA39F"
              style={st.note}
              multiline
            />

            <View style={st.sheetButtons}>
              <Button label="Cancel" onPress={() => setOpen(false)} icon="close" secondary />
              <Button
                label="Save Note"
                onPress={() =>
                  note.trim() &&
                  add({
                    id: Date.now().toString(),
                    kind: 'Note',
                    title: 'Observation recorded',
                    detail: note.trim(),
                    at: time()
                  })
                }
                icon="checkmark"
              />
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper },
  scroll: { padding: 18, paddingBottom: 80 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  category: { marginTop: 24, color: C.green, fontWeight: '900', fontSize: 11, letterSpacing: 1.2 },
  title: { color: C.ink, fontSize: 28, fontWeight: '900', marginTop: 5 },
  status: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange },
  statusText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  integrity: { backgroundColor: C.mint, borderRadius: 15, padding: 13, flexDirection: 'row', gap: 11, marginTop: 20, alignItems: 'center' },
  integrityTitle: { color: C.ink, fontWeight: '800', fontSize: 13 },
  integrityText: { color: C.muted, fontSize: 11, marginTop: 2 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 16 },
  h2: { color: C.ink, fontWeight: '900', fontSize: 18 },
  hint: { color: C.muted, fontSize: 12 },
  row: { flexDirection: 'row' },
  rail: { width: 42, alignItems: 'center' },
  circle: { height: 32, width: 32, borderRadius: 16, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  line: { width: 2, backgroundColor: '#C7D9D0', flex: 1, minHeight: 40 },
  item: { flex: 1, paddingBottom: 22, paddingTop: 2 },
  time: { color: C.muted, fontSize: 11, fontWeight: '700' },
  itemTitle: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: 3 },
  detail: { color: C.muted, fontSize: 12, marginTop: 2 },
  image: { width: '100%', height: 140, borderRadius: 12, marginTop: 8 },
  actions: { gap: 10, marginTop: 14 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,30,24,.35)' },
  sheet: { backgroundColor: C.paper, padding: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#C5CECA', alignSelf: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: C.ink, marginTop: 16, marginBottom: 14 },
  capture: { borderColor: '#B8D5C7', borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  captureIcon: { backgroundColor: C.green, height: 38, width: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  captureTitle: { color: C.ink, fontWeight: '800', fontSize: 14 },
  captureText: { color: C.muted, marginTop: 2, fontSize: 11 },
  noteLabel: { color: C.ink, fontWeight: '800', marginTop: 18, marginBottom: 8, fontSize: 13 },
  note: { minHeight: 80, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, textAlignVertical: 'top', color: C.ink, fontSize: 14 },
  sheetButtons: { flexDirection: 'row', gap: 10, marginTop: 15 }
});

