import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DatabaseEngine } from './db';
import { useMarketplace } from './marketplace';
import { Coords, getCurrentCoords } from './permissions';
import { Sheet } from './sheet';
import { useToast } from './toast';
import { Button, C, Icon, type } from './ui';

const HELPLINE = '112';
const COUNTDOWN_FROM = 5;

/**
 * Emergency sheet.
 *
 * An app cannot push a location to the police, so this does not pretend to.
 * It puts the two real actions one tap away — dial 112, and open a pre-written
 * SMS with a maps link to the user's saved emergency contacts — and says
 * plainly what will happen.
 */
export function SOSModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { profile } = useMarketplace();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [fired, setFired] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const contacts = profile?.role === 'customer' ? (profile.emergencyContacts ?? []) : [];
  const phones = contacts.map(c => c.phone).filter(Boolean);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (visible) {
      getCurrentCoords().then(setCoords);
    } else {
      stop();
      setCountdown(null);
      setFired(false);
    }
    return stop;
  }, [visible]);

  const where = coords ?? { lat: 12.9716, lng: 77.5946, precise: false };
  const mapsLink = `https://maps.google.com/?q=${where.lat.toFixed(5)},${where.lng.toFixed(5)}`;

  const dial = async () => {
    try {
      await Linking.openURL(Platform.OS === 'ios' ? `telprompt:${HELPLINE}` : `tel:${HELPLINE}`);
    } catch {
      toast.show(`Couldn't open the dialer. Call ${HELPLINE} directly.`, 'warning');
    }
  };

  const message = async () => {
    if (!phones.length) {
      toast.show('Add emergency contacts in Account first.', 'warning');
      return;
    }
    const body = encodeURIComponent(`I need help. My location: ${mapsLink}`);
    const sep = Platform.OS === 'ios' ? '&' : '?';
    try {
      await Linking.openURL(`sms:${phones.join(',')}${sep}body=${body}`);
    } catch {
      toast.show("Couldn't open your messages app.", 'warning');
    }
  };

  const fire = async () => {
    stop();
    setCountdown(null);
    setFired(true);
    await DatabaseEngine.saveSOSLog({
      id: `${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN'),
      lat: where.lat,
      lng: where.lng,
      status: 'ACTIVE',
      contactsNotified: phones
    });
    await dial();
  };

  const start = () => {
    stop();
    setCountdown(COUNTDOWN_FROM);
    timer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          stop();
          void fire();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const close = () => {
    if (countdown !== null) toast.show('SOS cancelled. Nothing was sent.', 'info');
    stop();
    setCountdown(null);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={fired ? 'Help is one tap away' : 'Emergency'} testID="sos-sheet">
      {countdown !== null ? (
        <View style={s.countdown}>
          <Text style={s.count}>{countdown}</Text>
          <Text style={type.bodyStrong}>Calling {HELPLINE}…</Text>
          <Button label="Cancel" variant="secondary" onPress={close} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      ) : fired ? (
        <>
          <View style={s.locBox}>
            <Icon name="location" size={18} color={C.danger} />
            <Text style={[type.small, { flex: 1 }]}>
              {where.precise ? 'Your live location' : 'Approximate location'} · {where.lat.toFixed(4)}, {where.lng.toFixed(4)}
            </Text>
          </View>
          <Button label={`Call ${HELPLINE} again`} icon="call" variant="danger" onPress={dial} />
          <Button
            label={phones.length ? `Text ${phones.length} emergency contact${phones.length > 1 ? 's' : ''}` : 'No emergency contacts saved'}
            icon="chatbubble-ellipses-outline"
            variant="secondary"
            onPress={message}
          />
          <Text style={[type.caption, { textAlign: 'center' }]}>The text opens in your messages app with your location, ready to send.</Text>
        </>
      ) : (
        <>
          <Text style={type.body}>
            We'll start a {COUNTDOWN_FROM}-second countdown, then open your dialer for {HELPLINE}. You can also text your emergency
            contacts your location. RealityChain doesn't contact anyone on your behalf.
          </Text>
          <View style={s.contacts}>
            <Icon name="people-outline" size={18} color={C.ink} />
            <Text style={[type.small, { flex: 1, color: C.ink }]}>
              {contacts.length ? contacts.map(c => c.name).join(', ') : 'No emergency contacts yet — add them in Account.'}
            </Text>
          </View>
          <Pressable
            testID="sos-start"
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel={`Start ${COUNTDOWN_FROM}-second SOS countdown`}
            style={({ pressed }) => [s.big, pressed && { backgroundColor: C.dangerDark }]}
          >
            <Icon name="alert-circle" size={22} color={C.white} />
            <Text style={s.bigText}>Start SOS</Text>
          </Pressable>
          <Button label="Text my contacts now" icon="chatbubble-ellipses-outline" variant="secondary" onPress={message} />
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  countdown: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  count: { fontSize: 72, lineHeight: 80, fontWeight: '700', color: C.danger, letterSpacing: -2 },
  locBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 },
  contacts: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12 },
  big: {
    height: 58,
    borderRadius: 16,
    backgroundColor: C.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  bigText: { color: C.white, fontSize: 17, fontWeight: '700' }
});
