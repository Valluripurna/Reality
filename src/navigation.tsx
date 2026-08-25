import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RealityChainLogo } from './logo';
import { useMarketplace } from './marketplace';
import { SOSModal } from './sos';
import { C, Icon } from './ui';

export function TopHeaderBar() {
  const { profile } = useMarketplace();
  const insets = useSafeAreaInsets();
  const isPro = profile?.role === 'pro';
  const paddingTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 44) : 44, 44) + 14;

  return (
    <View style={[s.topBar, { paddingTop }]}>
      <RealityChainLogo size="small" />

      <View style={s.topRightCluster}>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveBadgeText}>{isPro ? 'PRO ONLINE' : 'VERIFIED PROOF'}</Text>
        </View>
      </View>
    </View>
  );
}

export function BottomNav() {
  const router = useRouter();
  const path = usePathname();
  const { profile } = useMarketplace();
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const pro = profile?.role === 'pro';

  const items = pro
    ? [
        { label: 'Work', icon: 'briefcase', href: '/pro' },
        { label: 'SOS', icon: 'warning', href: 'sos' },
        { label: 'Profile', icon: 'person', href: '/profile' }
      ]
    : [
        { label: 'Home', icon: 'home', href: '/' },
        { label: 'Requests', icon: 'receipt', href: '/request' },
        { label: 'SOS', icon: 'warning', href: 'sos' },
        { label: 'Profile', icon: 'person', href: '/profile' }
      ];

  return (
    <>
      {/* Floating Glassmorphic Pill Container */}
      <View style={s.glassNavWrapper}>
        <View style={s.glassNavContainer}>
          {items.map(x => {
            const isSos = x.href === 'sos';
            const selected = path === x.href;
            return (
              <Pressable
                key={x.label}
                onPress={() => {
                  if (isSos) {
                    setSosModalOpen(true);
                  } else {
                    router.replace(x.href as any);
                  }
                }}
                style={[s.item, isSos && s.sosItem]}
              >
                <Icon
                  name={x.icon as any}
                  color={isSos ? C.white : selected ? C.green : C.muted}
                />
                <Text style={[s.label, isSos && s.sosLabel, selected && s.active]}>
                  {x.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SOSModal visible={sosModalOpen} onClose={() => setSosModalOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderColor: C.line
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end'
  },
  drawerSheet: {
    width: '78%',
    height: '100%',
    backgroundColor: C.white,
    padding: 22,
    gap: 12
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20
  },
  drawerName: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 18
  },
  drawerRole: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2
  },
  drawerDivider: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 10
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12
  },
  drawerItemText: {
    color: C.navy,
    fontWeight: '800',
    fontSize: 14
  },
  drawerItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginTop: 'auto'
  },
  drawerItemDangerText: {
    color: C.crimson,
    fontWeight: '800',
    fontSize: 14
  },
  topRightCluster: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  liveBadge: {
    backgroundColor: C.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green
  },
  liveBadgeText: {
    color: C.green,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5
  },
  glassNavWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999
  },
  glassNavContainer: {
    width: '90%',
    maxWidth: 480,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    elevation: 10
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  sosItem: {
    backgroundColor: C.crimson,
    width: 44,
    height: 44,
    borderRadius: 22,
    flex: 0,
    minWidth: 44,
    justifyContent: 'center'
  },
  label: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
  },
  sosLabel: {
    color: C.white,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 0
  },
  active: {
    color: C.green,
    fontWeight: '900'
  }
});

