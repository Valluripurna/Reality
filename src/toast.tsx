import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Icon, IconName } from './ui';

export type ToastType = 'success' | 'warning' | 'info';

type ToastContextType = { show: (message: string, type?: ToastType) => void };

const Ctx = createContext<ToastContextType | null>(null);

const look: Record<ToastType, { icon: IconName; color: string }> = {
  success: { icon: 'checkmark-circle', color: '#4ADE9B' },
  warning: { icon: 'alert-circle', color: '#FFB84D' },
  info: { icon: 'information-circle', color: '#C9CCD1' }
};

export function ToastProvider({ children }: React.PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<ToastType>('success');
  const y = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const show = useCallback((text: string, t: ToastType = 'success') => {
    running.current?.stop();
    setMessage(text);
    setKind(t);
    y.setValue(-20);
    opacity.setValue(0);
    running.current = Animated.sequence([
      Animated.parallel([
        Animated.spring(y, { toValue: 0, tension: 120, friction: 12, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true })
      ]),
      Animated.delay(2400),
      Animated.parallel([
        Animated.timing(y, { toValue: -20, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ])
    ]);
    running.current.start();
  }, [opacity, y]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[s.toast, { top: insets.top + 10, opacity, transform: [{ translateY: y }] }]}
        >
          <Icon name={look[kind].icon} color={look[kind].color} size={20} />
          <Text style={s.text} numberOfLines={3}>{message}</Text>
        </Animated.View>
      </View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Toast provider missing');
  return c;
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.ink,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 9999
  },
  text: { color: C.white, fontWeight: '500', fontSize: 14, flex: 1, lineHeight: 19 }
});
