import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { BrandLockup } from '../src/brand';
import { useMarketplace } from '../src/marketplace';
import { BottomNav, TopHeaderBar } from '../src/navigation';
import { useToast } from '../src/toast';
import { C, Icon } from '../src/ui';

import { AIChatModal } from '../src/ai-chat';

export default function ProHome() {
  const { jobs, profile, toggleProOnline, syncGlobalJobs, acceptJob, submitProBid, setProfile } = useMarketplace();
  const router = useRouter();
  const toast = useToast();
  const prevCountRef = useRef(jobs.length);
  const [aiChatModalOpen, setAiChatModalOpen] = useState(false);

  const proProfile = profile?.role === 'pro' ? profile : null;
  const isOnline = proProfile?.isOnline ?? true;

  // Immediate Sync + Hidden Silent 10-Second Auto-Refresh Loop
  useEffect(() => {
    syncGlobalJobs();

    const interval = setInterval(async () => {
      const latest = await syncGlobalJobs();
      if (latest.length > prevCountRef.current) {
        const newest = latest[0];
        if (newest && newest.stage === 'Matching') {
          toast.show(`⚡ New Service Request: ${newest.kind} (₹${newest.estimate})!`, 'success');
        }
      }
      prevCountRef.current = latest.length;
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const completedJobs = jobs.filter(j => j.stage === 'Completed');
  
  // Category Skills Matching Engine
  const proSkillsList = proProfile?.skills
    ? proProfile.skills.toLowerCase().split(',').map(s => s.trim())
    : ['plumbing', 'electrical', 'cleaning', 'carpentry', 'other'];

  const matchedJobs = jobs.filter(j => {
    if (j.stage === 'Completed') return false;
    const jobKindLower = (j.kind || j.title || '').toLowerCase();
    return proSkillsList.some(skill => jobKindLower.includes(skill) || skill.includes(jobKindLower)) || proSkillsList.includes('other');
  });

  const openJobs = matchedJobs.length > 0 ? matchedJobs : jobs.filter(j => j.stage !== 'Completed');
  const todayEarnings = completedJobs.reduce((acc, j) => acc + Math.round(j.estimate * 0.9), 0);
  const potentialEarnings = openJobs.reduce((acc, j) => acc + Math.round(j.estimate * 0.9), 0);

  return (
    <SafeAreaView style={s.page}>
      <TopHeaderBar />

      <View style={s.statusBanner}>
        <View style={{ flex: 1 }}>
          <View style={s.statusHeaderRow}>
            <View style={[s.dot, !isOnline && s.dotOffline]} />
            <Text style={s.statusTitle}>{isOnline ? 'You are ONLINE' : 'You are OFFLINE'}</Text>
          </View>
          <Text style={s.statusSub}>
            {isOnline ? 'Ready to accept nearby service requests' : 'Go online to view live customer requests'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={v => {
            toggleProOnline(v);
            toast.show(v ? 'Online mode active' : 'Went offline', v ? 'success' : 'warning');
          }}
          trackColor={{ false: '#D0D5D2', true: C.mint }}
          thumbColor={isOnline ? C.green : '#8C9692'}
        />
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={s.title}>Nearby Service Jobs ({openJobs.length})</Text>
        <Text style={s.sub}>Matched to skills: {proProfile?.skills || 'General Service'}</Text>
      </View>

      <View style={s.earnings}>
        <Icon name="wallet" color={C.white} size={24} />
        <View style={{ flex: 1 }}>
          <Text style={s.earningsSmall}>TODAY’S NET PAYOUT ({completedJobs.length} Jobs)</Text>
          <Text style={s.earningsBig}>₹{todayEarnings} <Text style={{ fontSize: 13, color: '#A7F3D0', fontWeight: '600' }}>(Potential: ₹{potentialEarnings})</Text></Text>
        </View>
        <View style={s.proLevelPill}>
          <Text style={s.proLevelText}>{proProfile?.proLevel || 'Gold Pro'}</Text>
        </View>
      </View>

      {/* AI Assistant Quick Assistance Card for Service Pros */}
      <Pressable onPress={() => setAiChatModalOpen(true)} style={s.aiChatBtn}>
        <View style={s.aiChatIconBg}>
          <Icon name="sparkles" color={C.green} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.aiChatTitle}>AI Chat Assistant</Text>
          <Text style={s.aiChatSub}>Ask app guidance, earnings tips & service troubleshooting</Text>
        </View>
        <View style={s.aiChatBadge}>
          <Text style={s.aiChatBadgeText}>CHAT NOW</Text>
        </View>
      </Pressable>

      {/* Free Accepts Allocation Card */}
      <View style={s.acceptsCard}>
        <Icon name="sparkles" color={C.gold} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={s.acceptsTitle}>Free Job Accepts Allocation</Text>
          <Text style={s.acceptsSub}>
            {proProfile?.subscriptionActive
              ? `Active ${proProfile.passType} Pass · Unlimited Accepts`
              : `${proProfile?.freeAcceptsRemaining ?? 50} free accepts remaining`}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/profile')} style={s.passLinkBtn}>
          <Text style={s.passLinkText}>Pass Info</Text>
        </Pressable>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={x => x.id}
        contentContainerStyle={{ gap: 11, paddingTop: 18, paddingBottom: 130 }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Icon name="compass" size={32} color={C.green} />
            <Text style={s.emptyTitle}>Looking for nearby work...</Text>
            <Text style={s.empty}>You're online. Customer requests in your service area will appear here in real-time.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.card, item.stage === 'Matching' && { borderColor: C.green, borderWidth: 2, backgroundColor: '#F0FDF4' }]}>
            <Pressable onPress={() => router.push(`/job/${item.id}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[s.cardIcon, item.stage === 'Matching' && { backgroundColor: C.green }]}>
                <Icon name="construct" color={item.stage === 'Matching' ? C.white : C.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.cardMeta}>{item.kind} · {item.urgency} · {item.eta} away</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.price}>₹{item.estimate}</Text>
                <Text style={[s.status, item.stage === 'Matching' && { color: C.green, fontWeight: '900' }]}>
                  {item.stage === 'Matching' ? '⚡ INCOMING' : item.stage}
                </Text>
              </View>
            </Pressable>

            {item.stage === 'Matching' && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Pressable
                  onPress={() => {
                    const customQuote = prompt ? prompt('Enter your price quote (₹):', String(item.estimate)) : null;
                    const amount = customQuote ? Number(customQuote) : item.estimate;
                    if (amount > 0) {
                      const ok = submitProBid(item.id, amount, 'Ready to perform service with genuine tools.');
                      if (ok) {
                        toast.show(`✓ Price Quote Bid of ₹${amount} submitted to customer!`, 'success');
                        router.push(`/job/${item.id}` as any);
                      }
                    }
                  }}
                  style={{
                    backgroundColor: C.gold,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <Icon name="pricetag" color={C.navy} size={18} />
                  <Text style={{ color: C.navy, fontWeight: '900', fontSize: 14 }}>SUBMIT PRICE QUOTE (₹{item.lastBidAmount ?? item.estimate})</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    const ok = acceptJob(item.id);
                    if (ok) {
                      toast.show(`✓ Accepted ${item.kind} service job! (₹${item.estimate})`, 'success');
                      router.push(`/job/${item.id}` as any);
                    } else {
                      toast.show('Could not accept job. Request may be taken.', 'warning');
                    }
                  }}
                  style={{
                    backgroundColor: C.green,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Icon name="checkmark" color={C.white} size={16} />
                  <Text style={{ color: C.white, fontWeight: '900', fontSize: 13 }}>ACCEPT DIRECT FARE (₹{item.estimate})</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />

      {/* Interactive AI Chat Assistant Modal */}
      <AIChatModal visible={aiChatModalOpen} onClose={() => setAiChatModalOpen(false)} />

      <BottomNav />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper, paddingHorizontal: 18, paddingTop: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarPress: { padding: 2 },
  avatarBox: { width: 38, height: 38, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 38, height: 38, borderRadius: 14 },
  statusBanner: { backgroundColor: C.mint, borderRadius: 16, padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  dotOffline: { backgroundColor: '#8C9692' },
  statusTitle: { color: C.ink, fontWeight: '900', fontSize: 14 },
  statusSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  title: { color: C.ink, fontSize: 20, fontWeight: '900' },
  sub: { color: C.muted, marginTop: 2, fontSize: 11 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  refreshBtnText: {
    color: C.indigo,
    fontWeight: '800',
    fontSize: 11
  },
  earnings: { backgroundColor: C.green, borderRadius: 17, padding: 15, marginTop: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  earningsSmall: { color: '#B7E4CB', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  earningsBig: { color: C.white, fontSize: 22, fontWeight: '900', marginTop: 2 },
  proLevelPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  proLevelText: { color: C.white, fontWeight: '900', fontSize: 11 },
  aiChatBtn: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#A7F3D0'
  },
  aiChatIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  aiChatTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 13
  },
  aiChatSub: {
    color: C.muted,
    fontSize: 10,
    marginTop: 1
  },
  aiChatBadge: {
    backgroundColor: C.green,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  aiChatBadgeText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 10
  },
  acceptsCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  acceptsTitle: { color: C.navy, fontWeight: '900', fontSize: 13 },
  acceptsSub: { color: '#B45309', fontSize: 11, marginTop: 2, fontWeight: '600' },
  passLinkBtn: { backgroundColor: C.gold, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  passLinkText: { color: C.navy, fontWeight: '900', fontSize: 11 },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 11, alignItems: 'center' },
  cardIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: C.ink, fontWeight: '900', fontSize: 15 },
  cardMeta: { color: C.muted, fontSize: 12, marginTop: 4 },
  price: { color: C.green, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  status: { color: C.muted, fontSize: 10, marginTop: 3, textAlign: 'right' },
  emptyBox: { backgroundColor: C.white, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.line, alignItems: 'center', gap: 8, marginTop: 10 },
  emptyTitle: { color: C.ink, fontWeight: '900', fontSize: 16 },
  empty: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }
});

