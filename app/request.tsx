import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DispatchModal } from '../src/dispatch-modal';
import { LocationPromptModal } from '../src/location-modal';
import { useMarketplace } from '../src/marketplace';
import { categories, resolveCategory } from '../src/matching';
import { NearbyMap } from '../src/nearby-map';
import { ScreenHeader } from '../src/navigation';
import { pickImage } from '../src/permissions';
import { useToast } from '../src/toast';
import { MapProPin, ServiceKind } from '../src/types';
import { Button, C, Card, Chip, Field, Icon, radius, rupee, type } from '../src/ui';

export default function Request() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; title?: string }>();
  const { profile, request, addCustomCategory } = useMarketplace();

  const [kind, setKind] = useState<ServiceKind>(() => resolveCategory(params.category) ?? 'Plumbing');
  const [customKind, setCustomKind] = useState('');
  const [title, setTitle] = useState(params.title ?? '');
  const [detail, setDetail] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [preferred, setPreferred] = useState<MapProPin | null>(null);
  const [budget, setBudget] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const center = useMemo(
    () => (profile?.liveLat && profile?.liveLng ? { lat: profile.liveLat, lng: profile.liveLng } : null),
    [profile?.liveLat, profile?.liveLng]
  );
  const address = profile?.address || profile?.locationName;

  const addPhoto = async () => {
    const uri = await pickImage();
    if (uri) setImageUri(uri);
  };

  const submit = () => {
    if (title.trim().length < 3) {
      setError('Tell the pro what needs doing.');
      return;
    }
    let finalKind = kind;
    if (kind === 'Other' && customKind.trim()) {
      addCustomCategory(customKind.trim());
      finalKind = customKind.trim();
    }
    const id = request({
      title: title.trim(),
      kind: finalKind,
      detail: detail.trim(),
      urgency: urgent ? 'Urgent' : 'Standard',
      imageUri,
      address,
      preferredProPhone: preferred?.phone,
      preferredProName: preferred?.name,
      budget: Number(budget) > 0 ? Number(budget) : undefined
    });
    setJobId(id);
    setPosting(true);
  };

  return (
    <View style={s.page}>
      <ScreenHeader title={`Book ${kind === 'Other' ? 'a service' : kind.toLowerCase()}`} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.label}>Service</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginHorizontal: -20 }}>
            {categories.map(c => <Chip key={c} label={c} selected={kind === c} onPress={() => setKind(c)} />)}
          </ScrollView>
          {kind === 'Other' && (
            <Field style={{ marginTop: 12 }} value={customKind} onChangeText={setCustomKind} placeholder="What kind of service? e.g. CCTV repair" />
          )}

          <Text style={s.label}>What needs doing?</Text>
          <Field
            testID="request-title"
            value={title}
            onChangeText={v => { setTitle(v); setError(undefined); }}
            placeholder="e.g. Kitchen sink leaking under the cabinet"
            error={error}
            maxLength={120}
          />
          <Field
            style={{ marginTop: 10 }}
            value={detail}
            onChangeText={setDetail}
            placeholder="Anything else the pro should know? (optional)"
            multiline
            maxLength={600}
          />

          <Text style={s.label}>Photo</Text>
          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} style={s.photo} />
              <View style={s.photoActions}>
                <Button label="Replace" size="md" variant="secondary" icon="image-outline" onPress={addPhoto} style={{ flex: 1 }} />
                <Button label="Remove" size="md" variant="ghost" icon="trash-outline" onPress={() => setImageUri(undefined)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Pressable onPress={addPhoto} accessibilityRole="button" style={({ pressed }) => [s.upload, pressed && { backgroundColor: C.surface }]}>
              <Icon name="camera-outline" size={22} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>Add a photo</Text>
                <Text style={type.small}>Helps pros quote accurately</Text>
              </View>
              <Icon name="add" size={22} color={C.ink} />
            </Pressable>
          )}

          <Text style={s.label}>Address</Text>
          <Pressable onPress={() => setLocationOpen(true)} accessibilityRole="button" style={({ pressed }) => [s.upload, { borderStyle: 'solid' }, pressed && { backgroundColor: C.surface }]}>
            <Icon name="location-outline" size={22} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong} numberOfLines={1}>{address ? address.split(',')[0] : 'Add your address'}</Text>
              {address ? <Text style={type.small} numberOfLines={1}>{address}</Text> : null}
            </View>
            <Text style={type.smallStrong}>Change</Text>
          </Pressable>

          <Text style={s.label}>When</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Choice title="Standard" body="Within a few hours" selected={!urgent} onPress={() => setUrgent(false)} />
            <Choice title="Urgent" body="ASAP — pros notified first" selected={urgent} onPress={() => setUrgent(true)} />
          </View>

          <Text style={s.label}>Your budget <Text style={[type.small, { fontWeight: '400' }]}>(optional)</Text></Text>
          <Field
            value={budget}
            onChangeText={v => setBudget(v.replace(/\D/g, '').slice(0, 7))}
            placeholder="Leave empty to discuss with your pro"
            keyboardType="number-pad"
            prefix="₹"
          />

          <Text style={s.label}>Pros nearby</Text>
          <NearbyMap height={180} center={center} kind={kind} onSelectPro={setPreferred} selectedProId={preferred?.id ?? null} />
          <Text style={[type.caption, { marginTop: 8 }]}>
            {preferred ? `${preferred.name} will see your request first. Others can still quote.` : 'Tap a pro to ask them first, or let anyone nearby quote.'}
          </Text>

          <Card style={{ marginTop: 24 }}>
            <View style={s.note}>
              <Icon name="shield-checkmark-outline" size={16} color={C.brandDark} />
              <Text style={[type.caption, { flex: 1, color: C.brandDark }]}>
                You and your pro decide the price. Pros send their own quote — or accept your budget. Nothing is charged until you both agree, and only then is the arrival PIN created.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Price</Text>
          <Text style={type.heading}>{budget ? rupee(Number(budget)) : 'Agree with pro'}</Text>
        </View>
        <Button testID="post-request" label="Get quotes" icon="arrow-forward" onPress={submit} style={{ flex: 1.6 }} />
      </View>

      <LocationPromptModal
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        savedPlaces={profile?.role === 'customer' ? profile.savedPlaces : []}
      />

      <DispatchModal
        visible={posting}
        serviceKind={kind}
        preferredName={preferred?.name}
        onDispatchComplete={() => {
          setPosting(false);
          toast.show('Request posted. Quotes will appear here.', 'success');
          if (jobId) router.replace(`/job/${jobId}` as any);
        }}
      />
    </View>
  );
}

function Choice({ title, body, selected, onPress }: { title: string; body: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.choice, selected && s.choiceOn, pressed && !selected && { backgroundColor: C.surface }]}
    >
      <Text style={type.bodyStrong}>{title}</Text>
      <Text style={type.caption}>{body}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 24, marginBottom: 10 },
  chips: { gap: 8, paddingHorizontal: 20 },
  photo: { width: '100%', height: 180, borderRadius: radius.lg, backgroundColor: C.surface },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.lineStrong
  },
  choice: { flex: 1, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.lineStrong, gap: 2 },
  choiceOn: { borderColor: C.ink, borderWidth: 1.5, backgroundColor: C.surface },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.brandSoft, borderRadius: 12, padding: 10, marginTop: 14 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineStrong,
    backgroundColor: C.white
  }
});
