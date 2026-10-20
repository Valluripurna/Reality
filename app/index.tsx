import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AIChatModal } from '../src/ai-chat';
import { HomeBanner } from '../src/banner';
import { LocationPromptModal } from '../src/location-modal';
import { useLocationStatus } from '../src/location-sync';
import { useMarketplace } from '../src/marketplace';
import { resolveCategory, serviceCatalog, startingPrice } from '../src/matching';
import { BottomNav, HomeHeader, useTabBarSpace } from '../src/navigation';
import { useEvents } from '../src/store/events';
import { useToast } from '../src/toast';
import { isActiveStage, ServiceJob } from '../src/types';
import { Badge, C, Card, Icon, IconName, ListRow, radius, rupee, SectionHeader, type } from '../src/ui';

export default function Home() {
  const { profile, ready, jobs, syncGlobalJobs } = useMarketplace();
  const locStatus = useLocationStatus();
  const { events } = useEvents();
  const router = useRouter();
  const toast = useToast();
  const bottomSpace = useTabBarSpace();
  const [search, setSearch] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  // Bookings move on other devices (the pro's phone), so keep this fresh.
  useEffect(() => {
    if (!profile || profile.role !== 'customer') return;
    syncGlobalJobs().catch(() => {});
    const t = setInterval(() => syncGlobalJobs().catch(() => {}), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.phone]);

  if (!ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.ink} />
      </View>
    );
  }
  if (!profile) return <Redirect href="/welcome" />;
  if (profile.role === 'pro') return <Redirect href="/pro" />;

  const active = jobs.filter(j => isActiveStage(j.stage));
  const firstName = profile.name.split(' ')[0];
  const known = profile.locationName || profile.address;
  const place = known
    ? profile.locationName || profile.address!.split(',')[0]
    : locStatus.state === 'locating' ? 'Finding your location…' : 'Set your address';
  const placeSub = profile.address
    ? profile.address
    : locStatus.state === 'error' ? 'Location is off — tap to set your address' : locStatus.state === 'locating' ? 'Getting an accurate GPS fix' : 'Tap to add your service address';

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    const match = resolveCategory(q);
    router.push({ pathname: '/request', params: match ? { category: match } : { category: 'Other', title: q } });
    setSearch('');
  };

  return (
    <View style={s.page}>
      <HomeHeader
        left={
          <Pressable testID="location-picker" onPress={() => setLocationOpen(true)} accessibilityRole="button" accessibilityLabel="Change service address" hitSlop={6}>
<View style={s.locRow}>
                <View style={{ marginLeft: -8 }}>
                  <Icon name="location" size={14} color={C.ink} />
                </View>
                <Text style={type.bodyStrong} numberOfLines={1}>{place}</Text>
                <Icon name="chevron-down" size={14} color={C.ink} />
              </View>
            <Text style={[type.caption, { marginLeft: 20 }]} numberOfLines={1}>{placeSub}</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottomSpace }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HomeBanner role="customer" name={firstName} onAssistant={() => setAssistantOpen(true)} />

        <View style={s.search}>
          <Icon name="search" size={16} color={C.muted} />
          <TextInput
            testID="home-search"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={submitSearch}
            placeholder="Try “leaking tap” or “AC service”"
            placeholderTextColor={C.faint}
            returnKeyType="search"
            style={s.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={submitSearch} accessibilityRole="button" accessibilityLabel="Search" style={s.searchGo}>
              <Icon name="arrow-forward" size={16} color={C.white} />
            </Pressable>
          )}
        </View>

        {active.map(job => <ActiveBooking key={job.id} job={job} onPress={() => router.push(`/job/${job.id}` as any)} />)}

        <View style={s.grid}>
          {serviceCatalog.map(item => (
            <Pressable
              key={item.kind}
              testID={`service-${item.kind}`}
              onPress={() => router.push({ pathname: '/request', params: { category: item.kind } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.kind}, from ${rupee(startingPrice(item.kind))}`}
              android_ripple={{ color: 'transparent' }}
              style={({ pressed }) => [s.tile, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <View style={s.tileIcon}>
                <Icon name={item.icon.replace(/-outline$/, '') as IconName} size={24} color={C.ink2} />
              </View>
              <Text style={s.tileLabel} numberOfLines={2}>{item.kind}</Text>
            </Pressable>
          ))}
        </View>

        <SectionHeader title="How it works" style={{ marginTop: 28 }} />
        <View style={s.steps}>
          {[
            ['1', 'Describe the job', 'Add a photo if you can.'],
            ['2', 'Compare quotes', 'Pick a pro and price.'],
            ['3', 'Share your PIN', 'Work starts when they arrive.']
          ].map(([n, t, b]) => (
            <View key={n} style={s.step}>
              <Text style={s.stepNum}>{n}</Text>
              <Text style={type.smallStrong}>{t}</Text>
              <Text style={type.caption}>{b}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Your records" action={events.length ? 'See all' : undefined} onAction={() => router.replace('/records')} style={{ marginTop: 28 }} />
        {events.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 22 }}>
            <Icon name="document-text-outline" size={24} color={C.muted} />
            <Text style={type.smallStrong}>Nothing here yet</Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>Each booking keeps a timestamped record — quotes, arrival, photos and payment.</Text>
          </Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {events.slice(0, 3).map(ev => (
              <ListRow
                key={ev.id}
                icon={ev.status === 'Resolved' ? 'checkmark-circle' : 'time-outline'}
                iconTone={ev.status === 'Resolved' ? 'brand' : 'neutral'}
                title={ev.title}
                subtitle={`${ev.type} · ${ev.startedAt}`}
                onPress={() => router.push(`/event/${ev.id}`)}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <AIChatModal visible={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <LocationPromptModal
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        savedPlaces={profile.savedPlaces}
        onDone={label => toast.show(`Service address set to ${label}`, 'success')}
      />
      <BottomNav />
    </View>
  );
}

function ActiveBooking({ job, onPress }: { job: ServiceJob; onPress: () => void }) {
  const quotes = job.bids?.length ?? 0;
  const headline =
    job.stage === 'Matching'
      ? quotes ? `${quotes} quote${quotes > 1 ? 's' : ''} received` : 'Finding pros near you'
      : job.stage === 'Assigned' ? `${job.proName} accepted`
      : job.stage === 'On the way' ? `${job.proName} is on the way`
      : 'Work in progress';
  const steps = ['Matching', 'Assigned', 'On the way', 'In progress'];
  const idx = steps.indexOf(job.stage);
  return (
    <Pressable testID="active-booking" onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.active, pressed && { opacity: 0.92 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={s.liveDot} />
        <Text style={s.activeKicker}>{job.kind}</Text>
        {job.stage === 'Matching' && quotes > 0 ? <Badge tone="brand" label="Review quotes" style={{ marginLeft: 'auto' }} /> : null}
      </View>
      <Text style={s.activeTitle}>{headline}</Text>
      <Text style={s.activeSub} numberOfLines={1}>{job.title}{job.stage === 'Matching' ? '' : ` · ${rupee(job.estimate)}`}</Text>
      <View style={s.progress}>
        {steps.map((st, i) => <View key={st} style={[s.progressSeg, i <= idx && { backgroundColor: C.brandBright }]} />)}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  search: {
    marginTop: 16,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 5,
    gap: 9
  },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, height: '100%', outlineStyle: 'none' } as any,
  searchGo: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  active: { marginTop: 16, backgroundColor: C.ink, borderRadius: radius.lg, padding: 16 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brandBright },
  activeKicker: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  activeTitle: { color: C.white, fontSize: 18, fontWeight: '700', marginTop: 8, letterSpacing: -0.3 },
  activeSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 4, marginTop: 14 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, marginHorizontal: -6, rowGap: 24 },
  tile: { width: '25%', alignItems: 'center', paddingHorizontal: 6 },
  tileIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.ink,
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  tileLabel: { marginTop: 6, fontSize: 10.5, lineHeight: 13, fontWeight: '500', color: C.ink, textAlign: 'center' },
  steps: { flexDirection: 'row', gap: 10 },
  step: { flex: 1, backgroundColor: C.surface, borderRadius: radius.md, padding: 12, gap: 3 },
  stepNum: { fontSize: 20, fontWeight: '700', color: C.brand, marginBottom: 4 }
});
