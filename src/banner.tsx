import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BannerAudience,
  BannerTone,
  dismissBanner,
  dismissedBannerIds,
  pickBanner,
  useRemoteConfig
} from './remote-config';
import { C, Icon, IconName, radius } from './ui';

const tones: Record<BannerTone, { bg: string; title: string; body: string; iconBg: string; icon: string; cta: string }> = {
  brand: { bg: C.brandSoft, title: C.brandDark, body: C.brandDark, iconBg: C.brand, icon: C.white, cta: C.brandDark },
  dark: { bg: C.ink, title: C.white, body: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.14)', icon: C.white, cta: C.white },
  amber: { bg: C.amberSoft, title: C.amberDark, body: C.amberDark, iconBg: C.amber, icon: C.white, cta: C.amberDark }
};

/**
 * Home banner, driven by remote config. The copy, icon, tone, CTA, audience and
 * schedule can change server-side (or with an OTA) without a store update, and
 * each person can dismiss one for their install.
 */
function fillName(value: string | undefined, name?: string) {
  if (!value) return value;
  const first = (name || '').trim().split(/\s+/)[0] || '';
  if (!first) return value.replace(/\{\{\s*name\s*\}\}(,\s*)?/gi, '').trim();
  return value.replace(/\{\{\s*name\s*\}\}/gi, first);
}

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
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    dismissedBannerIds().then(ids => { if (alive) setDismissed(ids); });
    return () => { alive = false; };
  }, []);

  const banner = pickBanner(config, role);
  if (!banner || dismissed.includes(banner.id)) return null;

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
  const hide = () => {
    setDismissed(prev => [...prev, banner.id]);
    dismissBanner(banner.id);
  };

  return (
    <View testID={`home-banner-${role}`} style={[s.banner, { backgroundColor: tone.bg }]}>
      <View style={[s.icon, { backgroundColor: tone.iconBg }]}>
        <Icon name={icon} size={18} color={tone.icon} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[s.title, { color: tone.title }]} numberOfLines={2}>{title}</Text>
        {body ? <Text style={[s.body, { color: tone.body }]} numberOfLines={3}>{body}</Text> : null}
        {banner.cta && banner.action ? (
          <Pressable testID="home-banner-cta" onPress={open} accessibilityRole="button" hitSlop={6} style={s.cta}>
            <Text style={[s.ctaText, { color: tone.cta }]}>{banner.cta}</Text>
            <Icon name="arrow-forward" size={13} color={tone.cta} />
          </Pressable>
        ) : null}
      </View>
      {banner.dismissible !== false ? (
        <Pressable testID="home-banner-dismiss" onPress={hide} accessibilityRole="button" accessibilityLabel="Dismiss banner" hitSlop={10}>
          <Icon name="close" size={16} color={tone.body} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '700', letterSpacing: -0.1 },
  body: { fontSize: 12.5, lineHeight: 17 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ctaText: { fontSize: 12.5, fontWeight: '700' }
});
