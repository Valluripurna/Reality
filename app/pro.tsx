import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { HomeBanner } from '../src/banner';
import { formatWhen } from '../src/format';
import { distanceKm } from '../src/location';
import { phoneKey, useMarketplace } from '../src/marketplace';
import { serviceCatalog } from '../src/matching';
import { BottomNav, HomeHeader, useTabBarSpace } from '../src/navigation';
import { PassSheet } from '../src/pass-sheet';
import { useToast } from '../src/toast';
import { isActiveStage, ServiceJob } from '../src/types';
import { Badge, C, Card, EmptyState, Icon, IconName, radius, rupee, type } from '../src/ui';

function skillMatches(job: ServiceJob, skills: string[]) {
  if (!skills.length) return true;
  const kind = (job.kind || '').toLowerCase();
  return skills.some(sk => kind.includes(sk) || sk.includes(kind));
}

export default function ProHome() {
  const router = useRouter();
  const toast = useToast();
  const bottomSpace = useTabBarSpace();
  const { profile, jobs, toggleProOnline, syncGlobalJobs } = useMarketplace();
  const [passOpen, setPassOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const known = useRef<Set<string> | null>(null);

  const pro = profile?.role === 'pro' ? profile : null;
  const online = pro?.isOnline ?? false;

  // Poll for new requests and nudge when one arrives.
  useEffect(() => {
    if (!pro) return;
    const tick = async () => {
      const latest = await syncGlobalJobs().catch(() => null);
      if (!latest) return;
      const open = latest.filter(j => j.stage === 'Matching');
      if (known.current) {
        const fresh = open.find(j => !known.current!.has(j.id) && phoneKey(j.customerPhone) !== phoneKey(pro.phone));
        if (fresh && pro.isOnline) toast.show(`New request: ${fresh.kind} · ${fresh.title}`, 'info');
      }
      known.current = new Set(open.map(j => j.id));
    };
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, [pro?.phone, pro?.isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return <Redirect href="/welcome" />;
  if (!pro) return <Redirect href="/" />;

  const me = phoneKey(pro.phone);
  const here = pro.liveLat != null && pro.liveLng != null ? { lat: pro.liveLat, lng: pro.liveLng } : null;
  const skills = (pro.skills || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const open = jobs.filter(j => j.stage === 'Matching');
  const matched = open.filter(j => skillMatches(j, skills));
  const feed = showAll ? open : matched;
  const myActive = jobs.filter(j => phoneKey(j.proPhone) === me && isActiveStage(j.stage));
  const myDone = jobs.filter(j => phoneKey(j.proPhone) === me && j.stage === 'Completed');
  const today = new Date().toDateString();
  const earnedToday = myDone
    .filter(j => j.completedWorkAt && new Date(j.completedWorkAt).toDateString() === today)
    .reduce((sum, j) => sum + j.estimate - Math.round(j.estimate * 0.1), 0);
  const passActive = pro.subscriptionActive && pro.passExpiresAt && new Date(pro.passExpiresAt).getTime() > Date.now();

  const header = (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <HomeBanner role="pro" name={pro.name.split(' ')[0]} />

      <View style={[s.online, online && s.onlineOn]}>
        <View style={[s.dot, { backgroundColor: online ? C.brandBright : C.faint }]} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, online && { color: C.white }]}>{online ? "You're online" : "You're offline"}</Text>
          <Text style={[type.small, online && { color: 'rgba(255,255,255,0.65)' }]}>
            {online ? 'Customers nearby can see you' : 'Go online to receive requests'}
          </Text>
        </View>
        <Switch
          testID="online-toggle"
          value={online}
          onValueChange={v => { toggleProOnline(v); toast.show(v ? "You're online" : "You're offline", v ? 'success' : 'info'); }}
          trackColor={{ false: C.lineStrong, true: C.brand }}
          thumbColor={C.white}
        />
      </View>

      <View style={s.stats}>
        <Stat label="Earned today" value={rupee(earnedToday)} />
        <Stat label="Jobs done" value={String(pro.completedJobsCount ?? myDone.length)} />
        <Stat label="Rating" value={pro.ratingScore ? `★ ${pro.ratingScore.toFixed(1)}` : 'New'} />
      </View>

      {myActive.map(j => (
        <Pressable key={j.id} onPress={() => router.push(`/job/${j.id}` as any)} style={({ pressed }) => [s.activeJob, pressed && { opacity: 0.9 }]} accessibilityRole="button">
          <Icon name="navigate" size={20} color={C.white} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.white, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{j.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{j.stage} · {j.customerName ?? 'Customer'}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={C.white} />
        </Pressable>
      ))}

      {!passActive && (
        <Pressable onPress={() => setPassOpen(true)} accessibilityRole="button" style={({ pressed }) => [s.claims, pressed && { opacity: 0.85 }]}>
          <Icon name="ticket-outline" size={18} color={C.amberDark} />
          <Text style={[type.small, { flex: 1, color: C.amberDark }]}>
            <Text style={{ fontWeight: '700' }}>{pro.freeAcceptsRemaining ?? 0} free quotes left.</Text> Get a pass for unlimited.
          </Text>
          <Icon name="chevron-forward" size={16} color={C.amberDark} />
        </Pressable>
      )}

      {skills.length === 0 && (
        <Card onPress={() => router.replace('/profile')} style={s.rowCenter}>
          <Icon name="construct-outline" size={20} color={C.ink} />
          <Text style={[type.small, { flex: 1, color: C.ink }]}>Add the services you offer so we can show you the right jobs.</Text>
          <Icon name="chevron-forward" size={18} color={C.faint} />
        </Card>
      )}

      <View style={[s.rowCenter, { marginTop: 12 }]}>
        <Text style={[type.heading, { flex: 1 }]}>New requests</Text>
        {skills.length > 0 && open.length !== matched.length && (
          <Pressable onPress={() => setShowAll(v => !v)} hitSlop={8}>
            <Text style={{ color: C.brand, fontWeight: '600', fontSize: 14 }}>{showAll ? 'My skills only' : `Show all (${open.length})`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.page}>
      <HomeHeader showSOS left={<Text style={type.title}>Service pro</Text>} />
      <FlatList
        data={online ? feed : []}
        keyExtractor={j => j.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomSpace }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <RequestCard job={item} myPhone={me} from={here} onPress={() => router.push(`/job/${item.id}` as any)} />}
        ListEmptyComponent={
          online ? (
            <EmptyState icon="radio-outline" title="No requests right now" body="New requests near you will show up here automatically." />
          ) : (
            <EmptyState icon="moon-outline" title="You're offline" body="Turn on the switch above to start receiving requests." />
          )
        }
      />
      <PassSheet visible={passOpen} onClose={() => setPassOpen(false)} />
      <BottomNav />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={type.heading}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

function RequestCard({ job, myPhone, from, onPress }: { job: ServiceJob; myPhone: string; from: { lat: number; lng: number } | null; onPress: () => void }) {
  const icon = (serviceCatalog.find(c => c.kind === job.kind)?.icon ?? 'construct-outline') as IconName;
  const mine = job.bids?.find(b => phoneKey(b.proPhone) === myPhone);
  const others = (job.bids?.length ?? 0) - (mine ? 1 : 0);
  return (
    <Pressable testID={`request-${job.id}`} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.card, pressed && { backgroundColor: C.surface }]}>
      <View style={s.rowCenter}>
        <View style={s.icon}><Icon name={icon} size={22} color={C.ink} /></View>
        <View style={{ flex: 1 }}>
          <Text style={type.bodyStrong} numberOfLines={1}>{job.title}</Text>
          <Text style={type.small} numberOfLines={1}>
            {job.kind} · {from && job.lat != null && job.lng != null ? `${distanceKm(from, { lat: job.lat, lng: job.lng }).toFixed(1)} km away` : 'distance unknown'} · {formatWhen(job.createdAt)}
          </Text>
        </View>
        {job.urgency === 'Urgent' ? <Badge label="Urgent" tone="danger" /> : null}
      </View>
      <View style={[s.rowCenter, { marginTop: 12 }]}>
        <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
          {job.budget
            ? <>Budget <Text style={{ color: C.ink, fontWeight: '600' }}>{rupee(job.budget)}</Text></>
            : 'No price set — quote your own'}
          {others > 0 ? ` · ${others} other quote${others > 1 ? 's' : ''}` : ''}
        </Text>
        {mine ? <Badge label={`Quoted ${rupee(mine.bidAmount)}`} tone="brand" icon="checkmark" /> : <Badge label="Send quote" tone="dark" />}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  online: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: C.surface },
  onlineOn: { backgroundColor: C.ink },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, gap: 2 },
  activeJob: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: C.brand },
  claims: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: C.amberSoft },
  card: { padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }
});
