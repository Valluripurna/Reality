import { usePathname, useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarketplace } from './marketplace';
import { SOSModal } from './sos';
import { Avatar, C, Icon, IconName, type } from './ui';

export const TAB_BAR_HEIGHT = 60;

/** Bottom padding a scrolling screen needs so content clears the tab bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 16;
}

type Tab = { label: string; icon: IconName; activeIcon: IconName; href: string; match: (p: string) => boolean };

const customerTabs: Tab[] = [
  { label: 'Home', icon: 'home-outline', activeIcon: 'home', href: '/', match: p => p === '/' || p.startsWith('/request') },
  { label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar', href: '/bookings', match: p => p.startsWith('/bookings') || p.startsWith('/job') },
  { label: 'Records', icon: 'document-text-outline', activeIcon: 'document-text', href: '/records', match: p => p.startsWith('/records') || p.startsWith('/event') || p.startsWith('/new-event') },
  { label: 'Account', icon: 'person-circle-outline', activeIcon: 'person-circle', href: '/profile', match: p => p.startsWith('/profile') }
];

const proTabs: Tab[] = [
  { label: 'Jobs', icon: 'flash-outline', activeIcon: 'flash', href: '/pro', match: p => p.startsWith('/pro') },
  { label: 'My work', icon: 'briefcase-outline', activeIcon: 'briefcase', href: '/bookings', match: p => p.startsWith('/bookings') || p.startsWith('/job') },
  { label: 'Account', icon: 'person-circle-outline', activeIcon: 'person-circle', href: '/profile', match: p => p.startsWith('/profile') }
];

export function BottomNav() {
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { profile } = useMarketplace();
  const tabs = profile?.role === 'pro' ? proTabs : customerTabs;

  return (
    <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {tabs.map(tab => {
        const active = tab.match(path);
        return (
          <Pressable
            key={tab.href}
            testID={`tab-${tab.label.toLowerCase().replace(/\s/g, '-')}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => { if (!active || path !== tab.href) router.replace(tab.href as any); }}
            style={({ pressed }) => [s.tab, pressed && { opacity: 0.6 }]}
          >
            {tab.href === '/profile' && profile?.avatarUri
              ? <Avatar name={profile.name} uri={profile.avatarUri} size={24} />
              : <Icon name={active ? tab.activeIcon : tab.icon} size={24} color={active ? C.ink : C.faint} />}
            <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Red SOS pill. Opens the emergency sheet. */
export function SOSButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID="sos-button"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS"
        hitSlop={6}
        style={({ pressed }) => [s.sos, pressed && { backgroundColor: C.dangerSoft }]}
      >
        <Icon name="alert-circle" size={15} color={C.danger} />
        <Text style={s.sosText}>SOS</Text>
      </Pressable>
      <SOSModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Top bar for tab roots: a title or custom left block, SOS and the account avatar. */
export function HomeHeader({ left, showSOS = true }: { left: ReactNode; showSOS?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useMarketplace();
  return (
    <View style={[s.homeHeader, { paddingTop: insets.top + 10 }]}>
      <View style={{ flex: 1 }}>{left}</View>
      <View style={s.headerRight}>
        {showSOS && <SOSButton />}
        <Pressable testID="header-avatar" onPress={() => router.replace('/profile')} accessibilityRole="button" accessibilityLabel="Account" hitSlop={6}>
          <Avatar name={profile?.name} uri={profile?.avatarUri} size={36} />
        </Pressable>
      </View>
    </View>
  );
}

/** Standard header for pushed screens: back arrow, title, optional right slot. */
export function ScreenHeader({ title, onBack, right, fallback = '/' }: { title?: string; onBack?: () => void; right?: ReactNode; fallback?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback as any)));
  return (
    <View style={[s.screenHeader, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && { backgroundColor: C.surface }]}>
        <Icon name="arrow-back" size={22} color={C.ink} />
      </Pressable>
      <Text style={[type.heading, { flex: 1 }]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

/** @deprecated Kept for older imports; renders a plain brand header. */
export function TopHeaderBar() {
  return <HomeHeader left={<Text style={type.title}>RealityChain</Text>} />;
}

const s = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: C.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineStrong,
    paddingTop: 8,
    minHeight: TAB_BAR_HEIGHT
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '500', color: C.faint },
  tabLabelActive: { color: C.ink, fontWeight: '600' },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.white,
    gap: 12
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3B9B4'
  },
  sosText: { color: C.danger, fontWeight: '700', fontSize: 12, letterSpacing: 0.4 },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }
});
