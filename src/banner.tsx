import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BannerAudience,
  BannerTone,
  DEFAULT_CONFIG,
  pickBanner,
  useRemoteConfig
} from './remote-config';
import { C, Icon, IconName, radius } from './ui';

const tones: Record<BannerTone, { bg: string; title: string; body: string; iconBg: string; icon: string; cta: string }> = {
  brand: { bg: C.brandSoft, title: C.brandDark, body: C.brandDark, iconBg: C.brand, icon: C.white, cta: C.brandDark },
  dark: { bg: C.ink, title: C.white, body: 'rgba(255,255,255,0.72)', iconBg: 'rgba(255,255,255,0.13)', icon: C.white, cta: C.white },
  amber: { bg: C.amberSoft, title: C.amberDark, body: C.amberDark, iconBg: C.amber, icon: C.white, cta: C.amberDark }
};

// Transparent portrait art sits in its own column, so copy never overlaps it.
const art: Record<BannerAudience, number> = {
  customer: require('../assets/banners/customer.png'),
  pro: require('../assets/banners/pro.png'),
  bookings: require('../assets/banners/bookings.png'),
  records: require('../assets/banners/records.png')
};

function fillName(value: string | undefined, name?: string) {
  if (!value) return value;
  const first = (name || '').trim().split(/\s+/)[0] || '';
  if (!first) return value.replace(/\{\{\s*name\s*\}\}(,\s*)?/gi, '').trim();
  return value.replace(/\{\{\s*name\s*\}\}/gi, first);
}

/**
 * Image banner driven by remote config. Copy, icon, tone, CTA, audience and
 * schedule can change server-side or with an OTA; the banner itself is a
 * permanent surface, so there is no dismiss control. Copy and art use separate
 * columns (never an overlay); the art stays still while the icon breathes.
 */
export function HomeBanner({
  role,
  name,
  onAssistant
}: {
  role: BannerAudience;
  name?: string;
  onAssistant?: () => void;
}) {
  const router = useRouter();
  const config = useRemoteConfig();
  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const native = Platform.OS !== 'web';
    const intro = Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native
    });
    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: native })
    ]));
    intro.start();
    breatheLoop.start();
    return () => { intro.stop(); breatheLoop.stop(); };
  }, [enter, breathe]);

  // A missing/empty cached config must never leave a screen without its banner.
  const banner = pickBanner(config, role) ?? pickBanner(DEFAULT_CONFIG, role);
  if (!banner) return null;

  const tone = tones[banner.tone ?? 'brand'];
  const icon = (banner.icon ?? 'megaphone-outline') as IconName;
  const title = fillName(banner.title, name);
  const body = fillName(banner.body, name);
  const open = () => {
    const action = banner.action;
    if (!action) return;
    if (action.type === 'route') router.push(action.href as any);
    else if (action.type === 'url') Linking.openURL(action.url).catch(() => {});
    else onAssistant?.();
  };

  const lift = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const iconScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] });
  const arrowX = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  return (
    <Animated.View
      testID={`home-banner-${role}`}
      style={[s.shell, { opacity: enter, transform: [{ translateY: lift }] }]}
    >
      <View style={[s.banner, { backgroundColor: tone.bg }]}>
        <View style={s.copy} testID={`home-banner-copy-${role}`}>
          <View style={s.iconRow}>
            <View style={s.iconWrap}>
              <Animated.View
                pointerEvents="none"
                style={[s.halo, { backgroundColor: tone.iconBg, opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
              />
              <Animated.View style={[s.icon, { backgroundColor: tone.iconBg, transform: [{ scale: iconScale }] }]}>
                <Icon name={icon} size={17} color={tone.icon} />
              </Animated.View>
            </View>
          </View>

          <Text style={[s.title, { color: tone.title }]} numberOfLines={4}>{title}</Text>
          {body ? <Text style={[s.body, { color: tone.body }]} numberOfLines={3}>{body}</Text> : null}
          {banner.cta && banner.action ? (
            <Pressable testID="home-banner-cta" onPress={open} accessibilityRole="button" hitSlop={8} style={s.cta}>
              <Text style={[s.ctaText, { color: tone.cta }]}>{banner.cta}</Text>
              <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
                <Icon name="arrow-forward" size={14} color={tone.cta} />
              </Animated.View>
            </Pressable>
          ) : null}
        </View>

        <View pointerEvents="none" testID={`home-banner-art-${role}`} style={s.artWrap}>
          <View style={s.artInner}>
            <Image source={art[role]} style={s.artImage} resizeMode="contain" />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  shell: { borderRadius: radius.lg, overflow: 'hidden' },
  banner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 214,
    borderRadius: radius.lg,
    paddingLeft: 16,
    overflow: 'hidden'
  },
  copy: { flex: 1, justifyContent: 'center', paddingVertical: 15, gap: 4 },
  iconRow: { flexDirection: 'row', marginBottom: 2 },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 32, height: 32, borderRadius: 9 },
  icon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.25 },
  body: { fontSize: 12.5, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ctaText: { fontSize: 13, fontWeight: '700' },
  artWrap: {
    width: '42%',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingRight: 2,
    overflow: 'hidden'
  },
  artInner: { flex: 1 },
  artImage: { width: '100%', height: '100%' }
});
