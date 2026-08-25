import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEvents } from '../src/store/events';
import { Button, C, Icon } from '../src/ui';
import { RealityMark } from '../src/brand';
import { useMarketplace } from '../src/marketplace';
import { BottomNav, TopHeaderBar } from '../src/navigation';
import { AIChatModal } from '../src/ai-chat';
import { useToast } from '../src/toast';

const categories = [
  { id: 'Plumbing', title: 'Plumbing', icon: 'water', count: '14 Pros nearby' },
  { id: 'Electrical', title: 'Electrical', icon: 'flash', count: '18 Pros nearby' },
  { id: 'AC Repair', title: 'AC Repair', icon: 'snow', count: '9 Pros nearby' },
  { id: 'Cleaning', title: 'Cleaning', icon: 'sparkles', count: '22 Pros nearby' },
  { id: 'Appliance', title: 'Appliance', icon: 'construct', count: '11 Pros nearby' },
  { id: 'Carpentry', title: 'Carpentry', icon: 'hammer', count: '8 Pros nearby' }
];

import { SplashScreenOverlay } from '../src/splash';
import { requestLocationPermission } from '../src/permissions';

export default function Home() {
  const { events } = useEvents();
  const { profile, ready, jobs, syncGlobalJobs, setProfile } = useMarketplace();
  const toast = useToast();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // Request Native Location Permission + Customer Live Job Sync (Every 10 Seconds)
  useEffect(() => {
    requestLocationPermission();
    const syncInterval = setInterval(() => {
      syncGlobalJobs();
    }, 10000);
    return () => clearInterval(syncInterval);
  }, []);
  const [search, setSearch] = useState('');
  const [aiChatModalOpen, setAiChatModalOpen] = useState(false);
  const categoryScrollRef = useRef<ScrollView>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  useEffect(() => {
    if (isUserInteracting) {
      const resumeTimer = setTimeout(() => setIsUserInteracting(false), 3000);
      return () => clearTimeout(resumeTimer);
    }

    const interval = setInterval(() => {
      setScrollPos(prev => {
        const nextPos = prev + 1.2;
        const maxScroll = categories.length * 165;
        const wrapPos = nextPos >= maxScroll ? 0 : nextPos;
        categoryScrollRef.current?.scrollTo({ x: wrapPos, animated: false });
        return wrapPos;
      });
    }, 35);

    return () => clearInterval(interval);
  }, [isUserInteracting]);

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={{ marginTop: 12, color: C.navy, fontWeight: '800', fontSize: 15 }}>Loading RealityChain...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return <Redirect href="/login" />;
  }

  const activeJob = jobs.find(j => j.stage !== 'Completed');

  const handleSearchSubmit = () => {
    const query = search.trim();
    if (!query) return;

    const lowerQ = query.toLowerCase();
    const matchIdx = categories.findIndex(c => c.id.toLowerCase().includes(lowerQ) || c.title.toLowerCase().includes(lowerQ));

    if (matchIdx >= 0) {
      categoryScrollRef.current?.scrollTo({ x: matchIdx * 165, animated: true });
      const matched = categories[matchIdx];
      toast.show(`Found ${matched.title} category! Navigating...`, 'success');
      setTimeout(() => {
        router.push({ pathname: '/request', params: { category: matched.id } });
      }, 400);
    } else {
      toast.show(`Searching for ${query} service...`, 'info');
      router.push({ pathname: '/request', params: { category: query } });
    }
  };

  return (
    <SafeAreaView style={st.page}>
      {showSplash && <SplashScreenOverlay onFinish={() => setShowSplash(false)} />}
      <TopHeaderBar />

      <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Title */}
        <View style={st.head}>
          <Text style={st.sub}>WELCOME BACK, {profile.name.toUpperCase()}</Text>
          <Text style={st.title}>What service do you need?</Text>
        </View>

        {/* Quick Search Input */}
        <View style={st.searchBox}>
          <Pressable onPress={handleSearchSubmit}>
            <Icon name="search-outline" size={20} color={C.muted} />
          </Pressable>
          <TextInput
            value={search}
            onChangeText={v => {
              setSearch(v);
              const lowerQ = v.toLowerCase().trim();
              if (lowerQ) {
                const matchIdx = categories.findIndex(c => c.id.toLowerCase().includes(lowerQ) || c.title.toLowerCase().includes(lowerQ));
                if (matchIdx >= 0) {
                  categoryScrollRef.current?.scrollTo({ x: matchIdx * 165, animated: true });
                }
              }
            }}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search plumbing, electrician, AC repair..."
            placeholderTextColor="#94A3B8"
            style={st.searchInput}
            returnKeyType="search"
          />
          <Pressable onPress={handleSearchSubmit} style={st.searchGoBtn}>
            <Text style={st.searchGoText}>Search</Text>
          </Pressable>
        </View>

        {/* Active Booking Live Tracker Card if active */}
        {activeJob && (
          <Pressable onPress={() => router.push(`/job/${activeJob.id}` as any)} style={st.activeTrackCard}>
            <View style={st.activeHeader}>
              <View style={st.activePulseDot} />
              <Text style={st.activeHeaderTitle}>ACTIVE SERVICE BOOKING</Text>
            </View>
            <View style={st.activeBody}>
              <View style={{ flex: 1 }}>
                <Text style={st.activeKindText}>{activeJob.kind} Service</Text>
                <Text style={st.activeProText}>Assigned Pro: {activeJob.proName} ({activeJob.eta} away)</Text>
              </View>
              <View style={st.activeStagePill}>
                <Text style={st.activeStageText}>{activeJob.stage}</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Popular Service Categories Single-Line Horizontal Scroll */}
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.categoryScrollline}
          onTouchStart={() => setIsUserInteracting(true)}
          onTouchEnd={() => setTimeout(() => setIsUserInteracting(false), 3000)}
          onScrollBeginDrag={() => setIsUserInteracting(true)}
          onScrollEndDrag={() => setTimeout(() => setIsUserInteracting(false), 3000)}
        >
          {categories.map(cat => (
            <Pressable
              key={cat.id}
              onPress={() => router.push({ pathname: '/request', params: { category: cat.id } })}
              style={st.catPillCard}
            >
              <View style={st.catIconWrap}>
                <Icon name={cat.icon as any} color={C.green} size={20} />
              </View>
              <View>
                <Text style={st.catTitle}>{cat.title}</Text>
                <Text style={st.catCount}>{cat.count}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Interactive AI Chat Assistant Card */}
        <Pressable onPress={() => setAiChatModalOpen(true)} style={st.grokCard}>
          <View style={st.grokIconWrap}>
            <Icon name="sparkles" color={C.white} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.grokTitle}>Ask AI Chat Assistant</Text>
            <Text style={st.grokText}>Instant issue diagnosis, required tools list & fair price estimate.</Text>
          </View>
          <Icon name="chevron-forward" color={C.indigo} size={20} />
        </Pressable>

        {/* Recent Service Verification Events */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Verified Service Proof Records</Text>
          <Text style={st.count}>{events.length} records</Text>
        </View>

        <View style={{ gap: 10 }}>
          {events.slice(0, 3).map(item => (
            <Pressable key={item.id} onPress={() => router.push(`/event/${item.id}`)} style={st.card}>
              <View style={st.eventIcon}>
                <Icon name="document-text" color={C.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>{item.title}</Text>
                <Text style={st.cardMeta}>{item.type} · {item.startedAt}</Text>
              </View>
              <View style={[st.pill, item.status === 'Resolved' && st.resolved]}>
                <Text style={[st.pillText, item.status === 'Resolved' && { color: C.green }]}>{item.status}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>



      {/* Interactive AI Chat Assistant Modal */}
      <AIChatModal visible={aiChatModalOpen} onClose={() => setAiChatModalOpen(false)} />

      <BottomNav />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper },
  scrollContent: { padding: 18, paddingBottom: 130 },
  head: { marginTop: 8, marginBottom: 14 },
  sub: { fontSize: 11, fontWeight: '900', color: C.green, letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '900', color: C.navy, marginTop: 4 },
  searchBox: {
    backgroundColor: C.white,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    color: C.navy,
    fontWeight: '700',
    fontSize: 14,
    paddingLeft: 10,
    outlineStyle: 'none' as any
  },
  searchGoBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10
  },
  searchGoText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 12
  },
  activeTrackCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  activePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green
  },
  activeHeaderTitle: {
    color: C.green,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8
  },
  activeBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  activeKindText: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 16
  },
  activeProText: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2
  },
  activeStagePill: {
    backgroundColor: C.green,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  activeStageText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 11
  },
  categoryScrollline: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 12,
    paddingVertical: 10,
    paddingRight: 40,
    marginBottom: 8
  },
  catPillCard: {
    minWidth: 155,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    elevation: 3
  },
  catCard: {
    width: '31%',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.line
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  catTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center'
  },
  catCount: {
    color: C.muted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center'
  },
  grokCard: {
    backgroundColor: '#EEF2FF',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    marginVertical: 10
  },
  grokIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.indigo,
    alignItems: 'center',
    justifyContent: 'center'
  },
  grokTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 14
  },
  grokText: {
    color: C.muted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 18,
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.navy
  },
  count: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.line
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.paper,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardTitle: {
    fontWeight: '800',
    fontSize: 14,
    color: C.navy
  },
  cardMeta: {
    color: C.muted,
    marginTop: 2,
    fontSize: 11
  },
  pill: {
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  resolved: {
    backgroundColor: C.mint
  },
  pillText: {
    color: '#B45229',
    fontSize: 11,
    fontWeight: '800'
  }
});

