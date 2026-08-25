import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const C = {
  navy: '#0F172A',
  ink: '#1E293B',
  muted: '#64748B',
  line: '#E2E8F0',
  paper: '#F8FAFC',
  green: '#10B981',
  mint: '#D1FAE5',
  orange: '#F97316',
  gold: '#F59E0B',
  indigo: '#4F46E5',
  blue: '#2563EB',
  purple: '#8B5CF6',
  coral: '#FF6B6B',
  cyan: '#0EA5E9',
  crimson: '#EF4444',
  white: '#FFFFFF'
};

export function Icon({ name, color = C.green, size = 20 }: { name: keyof typeof Ionicons.glyphMap; color?: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'danger' | 'indigo';

export function Button({
  label,
  onPress,
  icon = 'add',
  secondary = false,
  variant
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  secondary?: boolean;
  variant?: ButtonVariant;
}) {
  const v = variant ?? (secondary ? 'secondary' : 'primary');

  const getStyle = () => {
    if (v === 'secondary') return s.secondary;
    if (v === 'gold') return s.goldBtn;
    if (v === 'danger') return s.dangerBtn;
    if (v === 'indigo') return s.indigoBtn;
    return s.button;
  };

  const getTextColor = () => {
    if (v === 'secondary') return C.green;
    return C.white;
  };

  return (
    <Pressable onPress={onPress} style={[s.button, getStyle()]}>
      <Icon name={icon} color={getTextColor()} />
      <Text style={[s.buttonText, { color: getTextColor() }]}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  button: {
    backgroundColor: C.green,
    borderRadius: 15,
    paddingHorizontal: 17,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2
  },
  secondary: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  goldBtn: {
    backgroundColor: C.gold
  },
  dangerBtn: {
    backgroundColor: C.crimson
  },
  indigoBtn: {
    backgroundColor: C.indigo
  },
  buttonText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 15
  }
});

