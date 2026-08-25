import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

export type ToastType = 'success' | 'warning' | 'info';

type ToastContextType = {
  show: (message: string, type?: ToastType) => void;
};

const Ctx = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: React.PropsWithChildren) {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const y = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const show = (text: string, toastType: ToastType = 'success') => {
    setMessage(text);
    setType(toastType);
    y.setValue(-80);
    opacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(y, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true })
      ]),
      Animated.delay(2600),
      Animated.parallel([
        Animated.timing(y, { toValue: -80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true })
      ])
    ]).start();
  };

  const getBorderColor = () => {
    if (type === 'warning') return '#F59E0B';
    if (type === 'info') return '#6366F1';
    return '#10B981';
  };

  const getIconBg = () => {
    if (type === 'warning') return '#F59E0B';
    if (type === 'info') return '#6366F1';
    return '#10B981';
  };

  const getIcon = () => {
    if (type === 'warning') return 'alert-circle';
    if (type === 'info') return 'information-circle';
    return 'checkmark-circle';
  };

  return (
    <Ctx.Provider value={{ show }}>
      <View style={{ flex: 1 }}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            {
              borderColor: getBorderColor(),
              opacity,
              transform: [{ translateY: y }]
            }
          ]}
        >
          <View style={[s.iconWrap, { backgroundColor: getIconBg() }]}>
            <Icon name={getIcon()} color={C.white} size={16} />
          </View>
          <Text style={s.text}>{message}</Text>
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
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 9999
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    color: C.white,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
    lineHeight: 18
  }
});


