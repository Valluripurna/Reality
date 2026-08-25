import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

export function SplashScreenOverlay({ onFinish }: { onFinish: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseRingAnim = useRef(new Animated.Value(1)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Entrance Scale & Opacity Fade In
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true
      })
    ]).start();

    // 2. Pulse Ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRingAnim, {
          toValue: 1.4,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseRingAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();

    // 3. Auto-finish splash screen after 2.4 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      }).start(() => {
        onFinish();
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.splashContainer, { opacity: fadeOutAnim }]}>
      <Animated.View
        style={[
          s.logoWrapper,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {/* Pulse Background Ring */}
        <Animated.View
          style={[
            s.pulseRing,
            {
              transform: [{ scale: pulseRingAnim }]
            }
          ]}
        />

        {/* Logo Shield */}
        <View style={s.logoBadge}>
          <Icon name="sparkles" size={44} color={C.white} />
        </View>

        {/* App Title & Tagline */}
        <Text style={s.title}>
          Reality<Text style={s.titleHighlight}>Chain</Text>
        </Text>
        <Text style={s.subtitle}>AI ON-DEMAND LOCAL SERVICES</Text>

        <View style={s.trustBadge}>
          <Icon name="shield-checkmark" size={14} color={C.green} />
          <Text style={s.trustText}>Verified Pros · Instant AI Pricing</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 9999
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.4)'
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: C.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.indigo,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 20
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: C.white,
    letterSpacing: -1
  },
  titleHighlight: {
    color: C.purple
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#A5B4FC',
    letterSpacing: 2,
    marginTop: 4
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  trustText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700'
  }
});
