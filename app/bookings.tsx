import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { HomeBanner } from '../src/banner';
import { formatWhen, stageText, stageTone } from '../src/format';
import { phoneKey, useMarketplace } from '../src/marketplace';
import { serviceCatalog } from '../src/matching';
import { BottomNav, HomeHeader, useTabBarSpace } from '../src/navigation';
import { isActiveStage, ServiceJob } from '../src/types';
import { Badge, C, EmptyState, Icon, IconName, radius, rupee, type } from '../src/ui';

export default function Bookings() {
  const router = useRouter();
  const bottomSpace = useTabBarSpace();
  const { profile, jobs, syncGlobalJobs } = useMarketplace();
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { syncGlobalJobs().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return <Redirect href="/welcome" />;
  const isPro = profile.role === 'pro';
  const me = phoneKey(profile.phone);
  // For a pro, "my work" is jobs assigned to them — not the open request pool.
  const mine = isPro ? jobs.filter(j => phoneKey(j.proPhone) === me) : jobs;
  const list = mine.filter(j => (tab === 'active' ? isActiveStage(j.stage) : !isActiveStage(j.stage)));

  const refresh = async () => {
    setRefreshing(true);
    await syncGlobalJobs().catch(() => {});
    setRefreshing(false);
  };

  return (
    <View style={s.page}>
      <HomeHeader left={<Text style={type.title}>{isPro ? 'My work' : 'Bookings'}</Text>} />
      <View style={s.bannerWrap}><HomeBanner role="bookings" /></View>
      <View style={s.segment}>
        {(['active', 'past'] as const).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={[s.segItem, tab === t && s.segOn]}>
            <Text style={[type.smallStrong, { color: tab === t ? C.ink : C.muted }]}>
              {t === 'active' ? 'Active' : 'Past'} · {mine.filter(j => (t === 'active' ? isActiveStage(j.stage) : !isActiveStage(j.stage))).length}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={j => j.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomSpace, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <BookingCard job={item} isPro={isPro} onPress={() => router.push(`/job/${item.id}` as any)} />}
        ListEmptyComponent={
          tab === 'active' ? (
            <EmptyState
              icon={isPro ? 'briefcase-outline' : 'calendar-outline'}
              title={isPro ? 'No jobs in progress' : 'No active bookings'}
              body={isPro ? 'Jobs you win show up here. Send quotes from the Jobs tab.' : 'Book a service and track it here, step by step.'}
              action={isPro ? 'Find jobs' : 'Book a service'}
              onAction={() => router.replace(isPro ? '/pro' : '/')}
            />
          ) : (
            <EmptyState icon="time-outline" title="Nothing here yet" body="Completed and cancelled bookings will appear here." />
          )
        }
      />
      <BottomNav />
    </View>
  );
}

function BookingCard({ job, isPro, onPress }: { job: ServiceJob; isPro: boolean; onPress: () => void }) {
  const icon = (serviceCatalog.find(c => c.kind === job.kind)?.icon ?? 'construct-outline') as IconName;
  const who = isPro ? job.customerName : job.proName;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.card, pressed && { backgroundColor: C.surface }]}>
      <View style={s.icon}><Icon name={icon} size={22} color={C.ink} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>{job.title}</Text>
        <Text style={type.small} numberOfLines={1}>{job.kind}{who ? ` · ${who}` : ''}</Text>
        <Text style={type.caption}>{formatWhen(job.createdAt)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Badge label={stageText(job.stage, job.bids?.length)} tone={stageTone(job.stage)} />
        <Text style={type.smallStrong}>
          {job.stage === 'Matching'
            ? (job.bids?.length ? `${job.bids.length} quote${job.bids.length > 1 ? 's' : ''}` : 'Open price')
            : job.stage === 'Cancelled' ? '—' : rupee(job.estimate)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  bannerWrap: { paddingHorizontal: 20, marginBottom: 16 },
  segment: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderRadius: 12, padding: 4 },
  segItem: { flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }
});
