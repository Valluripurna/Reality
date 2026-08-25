import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { C } from './ui';

/** Original RealityChain mark: an event seed, its preserved record, and a verified outcome. */
export function RealityMark({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  const ring = animated ? new Animated.Value(1) : null;
  if (ring) Animated.loop(Animated.sequence([Animated.timing(ring, { toValue: 1.08, duration: 1500, useNativeDriver: true }), Animated.timing(ring, { toValue: 1, duration: 1500, useNativeDriver: true })])).start();
  const core = <View style={[styles.mark, { width: size, height: size, borderRadius: size * .32 }]}><View style={[styles.orbit, { width: size * .62, height: size * .62, borderRadius: size }]} /><View style={[styles.dot, { width: size * .13, height: size * .13, borderRadius: size, left: size * .17, top: size * .22 }]} /><View style={[styles.dot, { width: size * .13, height: size * .13, borderRadius: size, right: size * .17, bottom: size * .22 }]} /><Text style={[styles.check, { fontSize: size * .42 }]}>✓</Text></View>;
  return ring ? <Animated.View style={{ transform: [{ scale: ring }] }}>{core}</Animated.View> : core;
}

export function BrandLockup() {
  return <View style={styles.lockup}><RealityMark size={28}/><Text style={styles.wordmark}>RealityChain</Text></View>;
}

export function SplashScreenLogo({ onFinish }: { onFinish?: () => void }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true })
      ]),
      Animated.delay(1400),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      if (onFinish) onFinish();
    });
  }, []);

  return (
    <View style={styles.splashBg}>
      {/* Festive Indian Flag Tricolor Ribbon */}
      <View style={styles.flagRibbon}>
        <View style={styles.saffronBar} />
        <View style={styles.whiteBar}>
          <Text style={styles.ashokaChakra}>⚙️</Text>
        </View>
        <View style={styles.greenBar} />
      </View>

      <Animated.View style={[styles.splashCenter, { opacity, transform: [{ scale }] }]}>
        <RealityMark size={96} animated />
        <Text style={styles.splashTitle}>RealityChain</Text>

        <View style={styles.festiveTag}>
          <Text style={styles.festiveTagText}>🇮🇳 Proudly Serving Across India</Text>
        </View>

        <Text style={styles.splashSub}>Verified On-Demand Local Services</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  orbit: { borderWidth: 1.5, borderColor: C.green, position: 'absolute' },
  dot: { position: 'absolute', backgroundColor: C.gold },
  check: { color: C.white, fontWeight: '900', marginTop: -1 },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { color: C.navy, fontSize: 18, fontWeight: '900', letterSpacing: -.4 },
  splashBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  splashCenter: { alignItems: 'center', gap: 12 },
  splashTitle: { color: C.white, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  splashSub: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  flagRibbon: { position: 'absolute', top: 40, flexDirection: 'row', width: 220, height: 18, borderRadius: 9, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  saffronBar: { flex: 1, backgroundColor: '#FF9933' },
  whiteBar: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  greenBar: { flex: 1, backgroundColor: '#138808' },
  ashokaChakra: { fontSize: 10, marginTop: -2 },
  festiveTag: { backgroundColor: 'rgba(255, 255, 255, 0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  festiveTagText: { color: C.gold, fontSize: 12, fontWeight: '800' }
});

