import { versionLabel } from '../src/version';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../src/brand';
import { FREE_ACCEPTS, useMarketplace } from '../src/marketplace';
import { ScreenHeader } from '../src/navigation';
import { C, Icon, IconName, radius, type } from '../src/ui';

type Step = { icon: IconName; title: string; body: string };

const CUSTOMER_STEPS: Step[] = [
  { icon: 'grid-outline', title: 'Pick a service', body: 'Choose from 12 categories or just search “leaking tap”. Add a photo so pros can quote accurately.' },
  { icon: 'pricetag-outline', title: 'Pros send quotes', body: 'Your request goes to pros near your location. Each one sends their own price and a short note.' },
  { icon: 'checkmark-circle-outline', title: 'Accept the one you like', body: 'Compare and accept. That books the pro and creates your private 4-digit arrival PIN.' },
  { icon: 'navigate-outline', title: 'Track them live', body: 'Follow your pro on the map with a live distance and ETA. Call or message from the booking.' },
  { icon: 'key-outline', title: 'Share the PIN at the door', body: 'The pro enters your PIN to start the job — so you know exactly who arrived, and when.' },
  { icon: 'card-outline', title: 'Pay and rate', body: 'Pay by UPI or cash when the work is done. The receipt and every step stay in Records.' }
];

const PRO_STEPS: Step[] = [
  { icon: 'person-outline', title: 'Set up your profile', body: 'Choose the services you offer, add payout details and upload ID for the verified badge.' },
  { icon: 'radio-outline', title: 'Go online', body: 'Your live location lets nearby customers find you. New requests that match your skills appear instantly.' },
  { icon: 'pricetag-outline', title: 'Send quotes', body: `Name your price with a short note. The first ${FREE_ACCEPTS} quotes are free; a pass makes them unlimited.` },
  { icon: 'briefcase-outline', title: 'Get booked', body: 'When a customer accepts, the job moves to My work with their address and a route.' },
  { icon: 'swap-horizontal-outline', title: 'Swipe through the job', body: 'Swipe to start your route, enter the customer’s PIN on arrival, then swipe to finish.' },
  { icon: 'wallet-outline', title: 'Get paid', body: 'The customer pays you directly by UPI or cash. Good ratings bring you more work.' }
];

const TRUST: Step[] = [
  { icon: 'key-outline', title: 'Arrival PIN', body: 'Work can’t start until the right pro is at your door.' },
  { icon: 'document-text-outline', title: 'Everything on record', body: 'Quotes, arrival, photos and payment — timestamped.' },
  { icon: 'alert-circle-outline', title: 'SOS, one tap away', body: 'Dial 112 and text your contacts your location.' }
];

const STAGGER = 110;
const CYCLE_MS = 2600;

export default function About() {
  const insets = useSafeAreaInsets();
  const { profile } = useMarketplace();
  // Each person sees only their own side of the story.
  const mode: 'customer' | 'pro' = profile?.role === 'pro' ? 'pro' : 'customer';
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const steps = mode === 'pro' ? PRO_STEPS : CUSTOMER_STEPS;

  // Hero entrance
  const hero = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(hero, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();
  }, [hero]);

  // Staggered step entrance, replayed whenever the tab changes
  const enter = useMemo(() => steps.map(() => new Animated.Value(0)), [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => steps.map(() => new Animated.Value(0)), [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setActive(0);
    setAuto(true);
    const anims = steps.map((_, i) => Animated.sequence([
      Animated.delay(150 + i * STAGGER),
      Animated.parallel([
        Animated.timing(enter[i], { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lines[i], { toValue: 1, duration: 420, delay: 120, easing: Easing.out(Easing.quad), useNativeDriver: true })
      ])
    ]));
    Animated.parallel(anims).start();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto walkthrough: highlights each step in turn until the user taps one
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive(a => (a + 1) % steps.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [auto, steps.length]);

  // Pulse ring on the active step
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, mode, pulse]);

  const trust = useRef(TRUST.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(140, trust.map(v => Animated.timing(v, { toValue: 1, duration: 420, delay: 900, useNativeDriver: true }))).start();
  }, [trust]);

  return (
    <View style={s.page}>
      <ScreenHeader title="About" fallback="/profile" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[s.hero, {
            opacity: hero,
            transform: [{ scale: hero.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }]
          }]}
        >
          <BrandMark size={64} tile />
          <Text style={[type.display, { marginTop: 16 }]}>How RealityChain works</Text>
          <Text style={[type.small, { marginTop: 6 }]}>Trusted help at home, with every step on the record.</Text>
        </Animated.View>

        <View style={s.role} testID={`about-${mode}`}>
          <Icon name={mode === 'customer' ? 'person-outline' : 'construct-outline'} size={16} color={C.brandDark} />
          <Text style={[type.smallStrong, { color: C.brandDark }]}>
            {mode === 'customer' ? 'Your customer flow' : 'Your service-pro flow'}
          </Text>
        </View>

        <View style={{ marginTop: 8 }}>
          {steps.map((step, i) => {
            const on = i === active;
            const done = i < active;
            const last = i === steps.length - 1;
            return (
              <Pressable
                key={`${mode}-${i}`}
                testID={`about-step-${i}`}
                onPress={() => { setAuto(false); setActive(i); }}
                accessibilityRole="button"
                accessibilityLabel={`Step ${i + 1}: ${step.title}`}
              >
                <Animated.View
                  style={[s.step, {
                    opacity: enter[i],
                    transform: [{ translateY: enter[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
                  }]}
                >
                  <View style={s.rail}>
                    <View>
                      {on && (
                        <Animated.View
                          pointerEvents="none"
                          style={[s.ring, {
                            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }]
                          }]}
                        />
                      )}
                      <View style={[s.dot, (on || done) && s.dotOn]}>
                        <Icon name={step.icon} size={20} color={on || done ? C.white : C.ink} />
                      </View>
                    </View>
                    {!last && (
                      <View style={s.lineTrack}>
                        <Animated.View style={[s.lineFill, { backgroundColor: done ? C.brand : C.line, transform: [{ scaleY: lines[i] }] }]} />
                      </View>
                    )}
                  </View>
                  <View style={[s.body, on && s.bodyOn]}>
                    <Text style={[type.caption, { color: on ? C.brand : C.muted }]}>Step {i + 1}</Text>
                    <Text style={type.bodyStrong}>{step.title}</Text>
                    {on && <Text style={[type.small, { marginTop: 4 }]}>{step.body}</Text>}
                  </View>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        {!auto && (
          <Pressable onPress={() => { setActive(0); setAuto(true); }} style={s.replay} accessibilityRole="button">
            <Icon name="play-circle-outline" size={18} color={C.brand} />
            <Text style={{ color: C.brand, fontWeight: '600' }}>Play walkthrough</Text>
          </Pressable>
        )}

        <Text style={[type.heading, { marginTop: 32, marginBottom: 12 }]}>Built for trust</Text>
        <View style={{ gap: 10 }}>
          {TRUST.map((t, i) => (
            <Animated.View
              key={t.title}
              style={[s.trust, {
                opacity: trust[i],
                transform: [{ translateX: trust[i].interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }]
              }]}
            >
              <View style={s.trustIcon}><Icon name={t.icon} size={20} color={C.brandDark} /></View>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{t.title}</Text>
                <Text style={type.small}>{t.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Text style={[type.caption, { textAlign: 'center', marginTop: 32 }]}>
          RealityChain {versionLabel()} · support@realitychain.app
        </Text>
      </ScrollView>
    </View>
  );
}

const DOT = 44;

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  hero: { alignItems: 'flex-start', paddingTop: 20 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 22, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.brandSoft },
  step: { flexDirection: 'row', gap: 14 },
  rail: { width: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: C.brand },
  ring: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: C.brand },
  lineTrack: { flex: 1, width: 2, minHeight: 18, marginVertical: 4, overflow: 'hidden' },
  lineFill: { flex: 1, width: 2, transformOrigin: 'top' } as any,
  body: { flex: 1, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12, borderRadius: radius.md, minHeight: DOT },
  bodyOn: { backgroundColor: C.surface, paddingVertical: 10 },
  replay: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 8 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line },
  trustIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }
});
