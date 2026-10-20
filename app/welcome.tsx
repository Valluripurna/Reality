import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../src/brand';
import { useMarketplace } from '../src/marketplace';
import { C, Icon, IconName } from '../src/ui';

const points: { icon: IconName; title: string; body: string }[] = [
  { icon: 'shield-checkmark-outline', title: 'Pros near you', body: 'Plumbers, electricians, AC techs and more.' },
  { icon: 'pricetag-outline', title: 'Price agreed upfront', body: 'Compare quotes. Nothing starts until you accept.' },
  { icon: 'document-text-outline', title: 'Every step on record', body: 'Arrival PIN, photos and receipt, saved for you.' }
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, ready } = useMarketplace();
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 520, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [rise]);

  if (ready && profile) return <Redirect href={profile.role === 'pro' ? '/pro' : '/'} />;

  const go = (role: 'customer' | 'pro') => router.push({ pathname: '/login', params: { role } });
  const enter = (i: number) => ({
    opacity: rise,
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14 + i * 6, 0] }) }]
  });

  return (
    <View style={[s.page, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <StatusBar style="light" />
      <View style={s.brandRow}>
        <BrandMark size={34} color={C.white} />
        <Text style={s.brandName}>RealityChain</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.Text style={[s.headline, enter(0)]}>Home services,{'\n'}done right.{'\n'}<Text style={{ color: C.brandBright }}>On the record.</Text></Animated.Text>
        <View style={s.points}>
          {points.map((p, i) => (
            <Animated.View key={p.title} style={[s.point, enter(i + 1)]}>
              <View style={s.pointIcon}><Icon name={p.icon} size={20} color={C.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pointTitle}>{p.title}</Text>
                <Text style={s.pointBody}>{p.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Pressable
          testID="welcome-customer"
          onPress={() => go('customer')}
          accessibilityRole="button"
          style={({ pressed }) => [s.primary, pressed && { opacity: 0.88 }]}
        >
          <Text style={s.primaryText}>Book a service</Text>
          <Icon name="arrow-forward" size={20} color={C.ink} />
        </Pressable>
        <Pressable
          testID="welcome-pro"
          onPress={() => go('pro')}
          accessibilityRole="button"
          style={({ pressed }) => [s.secondary, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
        >
          <Text style={s.secondaryText}>I'm a service professional</Text>
        </Pressable>
        <Text style={s.legal}>By continuing you agree to our Terms of Service and Privacy Policy.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.ink, paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: C.white, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  headline: { color: C.white, fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2 },
  points: { marginTop: 36, gap: 20 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  pointTitle: { color: C.white, fontSize: 15, fontWeight: '600' },
  pointBody: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  primary: {
    height: 56,
    borderRadius: 16,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryText: { color: C.ink, fontSize: 16, fontWeight: '700' },
  secondary: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryText: { color: C.white, fontSize: 16, fontWeight: '600' },
  legal: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 }
});
