import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { BrandMark } from './brand';
import { C } from './ui';

/** Must match the expo-splash-screen `imageWidth` in app.json. */
export const SPLASH_MARK_SIZE = 120;

/**
 * Bridges the native splash into the app. It opens pixel-identical to the
 * native splash (same ink background, same mark, same size and position), so
 * the handoff is invisible; then the name settles in underneath and the whole
 * layer fades away. Total time on screen: about one second.
 */
export function SplashScreenOverlay({ onFinish }: { onFinish: () => void }) {
  const name = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.timing(name, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(380),
      Animated.timing(fade, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true })
    ]);
    seq.start(({ finished }) => finished && onFinish());
    return () => seq.stop();
  }, [name, fade, onFinish]);

  return (
    <Animated.View
      accessibilityLabel="RealityChain is loading"
      style={[s.screen, { opacity: fade }]}
      onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}
    >
      <BrandMark size={SPLASH_MARK_SIZE} color={C.white} />
      <Animated.View
        style={[
          s.nameWrap,
          { opacity: name, transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }
        ]}
      >
        <Text style={s.name}>RealityChain</Text>
        <Text style={s.tag}>Local services, on the record</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.ink
  },
  // Positioned absolutely so the mark stays exactly where the native splash put it.
  nameWrap: { position: 'absolute', top: '50%', marginTop: SPLASH_MARK_SIZE / 2 + 18, alignItems: 'center' },
  name: { color: C.white, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  tag: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 }
});
