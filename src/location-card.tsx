import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeAccuracy, locateErrorText } from './location';
import { useLocationStatus } from './location-sync';
import { LocationPromptModal } from './location-modal';
import { useMarketplace } from './marketplace';
import { useToast } from './toast';
import { C, Icon, radius, type } from './ui';

function ago(iso?: string) {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Shows where we think the user is, and how sure we are. The round locate
 * button fetches a fresh high-accuracy GPS fix and turns it into a street
 * address. "Edit" lets the user type or pick an address instead.
 */
export function LocationCard({ title = 'Your location', hint }: { title?: string; hint?: string }) {
  const toast = useToast();
  const { profile } = useMarketplace();
  const { state, error, refresh } = useLocationStatus();
  const [editing, setEditing] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const busy = state === 'locating';

  useEffect(() => {
    if (!busy) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  if (!profile) return null;

  const locate = async () => {
    if (busy) return;
    const res = await refresh('explicit');
    if (!res.error) toast.show(`Location updated - ${describeAccuracy(res.fix?.accuracy).toLowerCase()}`, 'success');
  };

  const hasFix = profile.liveLat != null && profile.liveLng != null;
  const sub = busy
    ? 'Getting an accurate GPS fix…'
    : hasFix
      ? `${describeAccuracy(profile.locationAccuracy)} · ${profile.addressSource === 'manual' ? 'set by you' : `updated ${ago(profile.locationUpdatedAt)}`}`
      : 'Tap the locate button to use your current location';

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={type.caption}>{title}</Text>
          <Text style={type.bodyStrong} numberOfLines={2}>{profile.address || profile.locationName || 'Not set yet'}</Text>
          <Text style={[type.caption, { color: busy ? C.brand : C.muted }]}>{sub}</Text>
        </View>
        <Pressable
          testID="locate-me"
          onPress={locate}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          hitSlop={8}
          style={({ pressed }) => [s.locate, pressed && { opacity: 0.8 }]}
        >
          <Animated.View
            pointerEvents="none"
            style={[s.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }]}
          />
          {busy ? <ActivityIndicator size="small" color={C.white} /> : <Icon name="locate" size={18} color={C.white} />}
        </Pressable>
      </View>

      {error && (
        <View style={s.error}>
          <Icon name="alert-circle" size={16} color={C.dangerDark} />
          <Text style={[type.caption, { flex: 1, color: C.dangerDark }]}>{locateErrorText(error)}</Text>
          {error === 'denied' || error === 'disabled' ? (
            <Text style={s.link} onPress={() => Linking.openSettings().catch(() => {})}>Settings</Text>
          ) : null}
        </View>
      )}

      <View style={s.footer}>
        {hint ? <Text style={[type.caption, { flex: 1 }]}>{hint}</Text> : <View style={{ flex: 1 }} />}
        <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button">
          <Text style={s.link}>Enter manually</Text>
        </Pressable>
      </View>

      <LocationPromptModal visible={editing} onClose={() => setEditing(false)} savedPlaces={profile.role === 'customer' ? profile.savedPlaces : []} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locate: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  ring: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dangerSoft, padding: 10, borderRadius: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { color: C.brand, fontWeight: '600', fontSize: 13 }
});
