import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, IconButton, radius, type } from './ui';

/**
 * Bottom sheet used by every modal in the app: dimmed scrim, rounded top,
 * grab handle, optional title row with close button, safe-area padding.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  dismissable = true,
  scroll = false,
  maxHeight = '88%',
  testID
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  dismissable?: boolean;
  scroll?: boolean;
  maxHeight?: `${number}%` | number;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      y.setValue(40);
      Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible, y]);

  const body = scroll ? (
    <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ gap: 14 }}>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={dismissable ? onClose : () => {}}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} accessibilityLabel="Close" />
        <Animated.View
          testID={testID}
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 4, maxHeight, transform: [{ translateY: y }] }]}
        >
          <View style={s.handle} />
          {(title || dismissable) && (
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                {title ? <Text style={type.title}>{title}</Text> : null}
                {subtitle ? <Text style={[type.small, { marginTop: 4 }]}>{subtitle}</Text> : null}
              </View>
              {dismissable && <IconButton icon="close" label="Close" onPress={onClose} size={36} />}
            </View>
          )}
          {body}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 8,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center'
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.lineStrong, alignSelf: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }
});
