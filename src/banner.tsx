import { useIsFocused, useRouter } from 'expo-router';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BannerAudience,
  BannerTone,
  DEFAULT_CONFIG,
  pickBanner,
  useRemoteConfig
} from './remote-config';
import { C, Icon, IconName, radius } from './ui';

const tones: Record<BannerTone, { bg: string; title: string; body: string; iconBg: string; icon: string; cta: string }> = {
  brand: { bg: '#E7F3EC', title: C.brandDark, body: C.brandDark, iconBg: C.brand, icon: C.white, cta: C.brandDark },
  cream: { bg: '#F2EDE1', title: C.ink, body: C.ink2, iconBg: C.ink, icon: C.white, cta: C.ink },
  dark: { bg: '#0D0E11', title: C.white, body: 'rgba(255,255,255,0.72)', iconBg: 'rgba(255,255,255,0.13)', icon: C.white, cta: C.white },
  amber: { bg: '#FCF1E0', title: C.amberDark, body: C.amberDark, iconBg: C.amber, icon: C.white, cta: C.amberDark }
};

// Matching first-frame art is also the fallback while the matching MP4 loads.
const art: Record<BannerAudience, number> = {
  customer: require('../assets/banners/customer.png'),
  pro: require('../assets/banners/pro.png'),
  bookings: require('../assets/banners/bookings.png'),
  records: require('../assets/banners/records.png')
};

// The MP4s are pre-keyed to each card colour with ffmpeg. Their backgrounds
// therefore match the banner exactly, so the art can sit inside the column
// without a visible video frame.
const video: Record<BannerAudience, number> = {
  customer: require('../assets/banners/customer.mp4'),
  pro: require('../assets/banners/pro.mp4'),
  bookings: require('../assets/banners/bookings.mp4'),
  records: require('../assets/banners/records.mp4')
};

// Tab navigation mounts one screen at a time, so remember where each clip was
// paused and restore that position when the tab comes back.
const positions: Record<BannerAudience, number> = { customer: 0, pro: 0, bookings: 0, records: 0 };

// Tabs unmount their screens, so without this the banner's intro would replay
// (fade and slide in) on every switch, which read as a blink.
const introPlayed: Record<BannerAudience, boolean> = { customer: false, pro: false, bookings: false, records: false };

// Keep the players alive across tab mounts. Recreating them (as useVideoPlayer
// does) makes a native player decode the clip again, which looked like a 1-2s
// load every time a tab was opened.
const players: Partial<Record<BannerAudience, VideoPlayer>> = {};

function playerFor(role: BannerAudience) {
  if (!players[role]) {
    const p = createVideoPlayer(video[role]);
    p.loop = true;
    p.muted = true;
    players[role] = p;
  }
  return players[role]!;
}

let warming = false;

function warmPlayers() {
  if (warming) return;
  warming = true;
  (Object.keys(video) as BannerAudience[]).forEach(playerFor);
}

function fillName(value: string | undefined, name?: string) {
  if (!value) return value;
  const first = (name || '').trim().split(/\s+/)[0] || '';
  if (!first) return value.replace(/\{\{\s*name\s*\}\}(,\s*)?/gi, '').trim();
  return value.replace(/\{\{\s*name\s*\}\}/gi, first);
}

/** Muted, looping ambience. The PNG covers the surface until the clip paints. */
function BannerArt({ role, bg, showVideo }: { role: BannerAudience; bg: string; showVideo: boolean }) {
  const player = useMemo(() => playerFor(role), [role]);
  // Keep the native video surface out of screen transitions: a TextureView can
  // paint over the incoming screen and expose its rectangle while tabs animate.
  // The surface is mounted only after the transition; the player itself stays
  // alive, so remounting does not reload or restart the clip.
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(player.status === 'readyToPlay');
  const [painted, setPainted] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const focused = useIsFocused();

  useEffect(() => {
    const timer = setTimeout(warmPlayers, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const restore = () => {
      const saved = positions[role];
      if (saved > 0.1 && Math.abs(player.currentTime - saved) > 0.05) {
        player.currentTime = saved;
      }
    };
    if (!focused) {
      positions[role] = player.currentTime;
      setVisible(false);
      setPainted(false);
      posterOpacity.setValue(1);
      player.pause();
      return;
    }
    // Seek while the surface is still hidden, so the first visible frame is
    // the resumed one rather than frame zero. Start playback now too; by the
    // time the surface mounts the clip is already moving, not buffering.
    restore();
    player.play();
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') restore();
    });
    const timer = setTimeout(() => setVisible(true), 220);
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [focused, player, role, posterOpacity]);

  useEffect(() => () => {
    positions[role] = player.currentTime;
    player.pause();
  }, [player, role]);

  // Local assets can become ready before the status listener attaches, so ask
  // for playback again whenever the player reports a new status. The saved
  // position is restored instead of resetting to zero, so returning to a tab
  // resumes the ambience rather than replaying the opening frames.
  // Some platforms keep the cached surface painted before `onFirstFrameRender`
  // can fire. Do not leave the poster up forever if that happens.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setPainted(true), 800);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const start = () => {
      const saved = positions[role];
      if (saved > 0.1 && Math.abs(player.currentTime - saved) > 0.05) {
        player.currentTime = saved;
      }
      player.play();
    };
    if (player.status === 'readyToPlay') {
      setReady(true);
      start();
    }
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        setReady(true);
        start();
      }
    });
    return () => sub.remove();
  }, [player, role, visible]);

  // The poster sits on top until the video has actually painted, then fades
  // out. This hides both the native surface's black start and the remount
  // flash, so a tab switch shows continuous art rather than a blink.
  useEffect(() => {
    if (!visible || !posterReady || !ready || !painted) {
      posterOpacity.setValue(1);
      return;
    }
    // Give the first frame a moment to reach the screen; otherwise a slow cold
    // start can reveal the native surface's edge for a frame or two.
    const timer = setTimeout(() => {
      Animated.timing(posterOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web'
      }).start();
    }, 120);
    return () => {
      clearTimeout(timer);
      posterOpacity.stopAnimation();
    };
  }, [painted, posterOpacity, posterReady, ready, visible]);

  const edge = { borderWidth: StyleSheet.hairlineWidth, borderColor: bg };

  return (
    <View pointerEvents="none" testID={`home-banner-art-${role}`} style={[s.artWrap, { backgroundColor: bg }]}>
      {showVideo && visible && posterReady && ready ? (
        <VideoView
          player={player}
          style={[s.artVideo, edge]}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
          playsInline
          surfaceType="textureView"
          onFirstFrameRender={() => setPainted(true)}
        />
      ) : null}
      <Animated.Image
        source={art[role]}
        style={[s.artVideo, edge, { opacity: posterOpacity, backgroundColor: bg }]}
        resizeMode="contain"
        onLoad={() => setPosterReady(true)}
        onError={() => setPosterReady(true)}
      />
    </View>
  );
}

/**
 * Banner driven by remote config. Copy, icon, tone, CTA, audience and schedule
 * can change server-side or with an OTA; the banner itself is a permanent
 * surface, so there is no dismiss control. Copy and art use separate columns
 * (never an overlay); the MP4 loops quietly while the icon breathes.
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
  const enter = useRef(new Animated.Value(introPlayed[role] ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const [entered, setEntered] = useState(introPlayed[role]);

  useEffect(() => {
    const native = Platform.OS !== 'web';
    const intro = introPlayed[role]
      ? null
      : Animated.timing(enter, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: native
        });
    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: native })
    ]));
    if (intro) {
      introPlayed[role] = true;
      intro.start(({ finished }) => {
        if (finished) setEntered(true);
      });
    } else {
      setEntered(true);
    }
    breatheLoop.start();
    return () => { intro?.stop(); breatheLoop.stop(); };
  }, [breathe, enter, role]);

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

        <BannerArt role={role} bg={tone.bg} showVideo={entered} />
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
    width: '46%',
    alignSelf: 'stretch',
    position: 'relative',
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden'
  },
  artVideo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }
});
