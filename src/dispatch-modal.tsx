import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Sheet } from './sheet';
import { C, Icon, type } from './ui';

const STEPS = ['Request saved to your record', 'Sent to pros nearby', 'Compare quotes when they arrive'];

/**
 * Short, honest confirmation while a request is posted. It only describes
 * what actually happened — no invented pro counts or "guaranteed" prices.
 */
export function DispatchModal({
  visible,
  onDispatchComplete,
  serviceKind,
  preferredName
}: {
  visible: boolean;
  onDispatchComplete: () => void;
  serviceKind: string;
  preferredName?: string;
}) {
  const [done, setDone] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setDone(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    const timers = STEPS.map((_, i) => setTimeout(() => setDone(i + 1), 450 * (i + 1)));
    const finish = setTimeout(onDispatchComplete, 450 * STEPS.length + 500);
    return () => { loop.stop(); timers.forEach(clearTimeout); clearTimeout(finish); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={() => {}} dismissable={false}>
      <View style={s.head}>
        <Animated.View style={[s.ring, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
        <Icon name="paper-plane" size={22} color={C.ink} />
      </View>
      <Text style={[type.title, { textAlign: 'center' }]}>Posting your request</Text>
      <Text style={[type.small, { textAlign: 'center' }]}>
        {preferredName ? `${preferredName} gets it first. ` : ''}{serviceKind} pros near you can now send quotes.
      </Text>
      <View style={{ gap: 12, marginTop: 6, marginBottom: 6 }}>
        {STEPS.map((step, i) => (
          <View key={step} style={s.row}>
            <View style={[s.check, i < done && s.checkOn]}>{i < done && <Icon name="checkmark" size={14} color={C.white} />}</View>
            <Text style={[type.body, { color: i < done ? C.ink : C.faint }]}>{step}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  head: { alignSelf: 'center', width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ring: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: C.surface2, borderTopColor: C.brand },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.brand, borderColor: C.brand }
});
