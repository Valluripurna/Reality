import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

type SwipeButtonProps = {
  label: string;
  onSwipeComplete: () => void;
  disabled?: boolean;
  busy?: boolean;
};

const KNOB = 50;
const INSET = 4;

/**
 * Slide-to-confirm, used for stage changes a pro should not trigger by
 * accident. Handlers read from refs so they always see the latest props
 * (an earlier version captured the first render's callback and PIN).
 */
export function SwipeButton({ label, onSwipeComplete, disabled = false, busy = false }: SwipeButtonProps) {
  const [width, setWidth] = useState(320);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(100, width - KNOB - INSET * 2);

  const maxRef = useRef(max);
  maxRef.current = max;
  const doneRef = useRef(onSwipeComplete);
  doneRef.current = onSwipeComplete;
  const offRef = useRef(disabled || busy);
  offRef.current = disabled || busy;

  const settle = useCallback(() => Animated.spring(x, { toValue: 0, bounciness: 6, useNativeDriver: false }).start(), [x]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !offRef.current,
    onMoveShouldSetPanResponder: (_, g) => !offRef.current && Math.abs(g.dx) > 4,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(g.dx, maxRef.current))),
    onPanResponderRelease: (_, g) => {
      if (g.dx >= maxRef.current * 0.75 || g.vx > 1) {
        Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start(() => {
          doneRef.current();
          setTimeout(() => x.setValue(0), 500);
        });
      } else settle();
    },
    onPanResponderTerminate: settle
  }), [x, settle]);

  const off = disabled || busy;
  return (
    <View
      style={[s.track, off && { backgroundColor: C.surface2 }]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}. Slide right to confirm.`}
      accessibilityState={{ disabled: off, busy }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => !off && onSwipeComplete()}
    >
      <Animated.View style={[s.fill, { width: Animated.add(x, KNOB + INSET * 2) }]} />
      <Text style={[s.label, off && { color: C.faint }]} numberOfLines={1}>{busy ? 'Updating…' : label}</Text>
      <Animated.View testID="swipe-knob" {...(off ? {} : pan.panHandlers)} style={[s.knob, off && { backgroundColor: C.faint }, { transform: [{ translateX: x }] }]}>
        <Icon name="arrow-forward" color={C.white} size={22} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: KNOB + INSET * 2, borderRadius: (KNOB + INSET * 2) / 2, backgroundColor: C.surface, justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.brandSoft, borderRadius: (KNOB + INSET * 2) / 2 },
  label: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.ink, paddingHorizontal: KNOB + 16 },
  knob: {
    position: 'absolute',
    left: INSET,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
