import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';

/**
 * RealityChain design tokens.
 *
 * Neutral first: near-black ink for text and primary actions, white and a warm
 * light grey for surfaces. One brand colour — "verified green" — marks trust,
 * success and the active state. Amber is reserved for ratings, red for SOS and
 * errors. Nothing else gets a colour, which is what keeps screens calm.
 */
export const C = {
  // Ink
  ink: '#111214',
  ink2: '#2A2C31',
  text: '#111214',
  muted: '#5F636B',
  faint: '#9A9EA6',

  // Surfaces
  bg: '#FFFFFF',
  surface: '#F5F5F2',
  surface2: '#ECECE7',
  cream: '#F4EFE2',
  white: '#FFFFFF',

  // Hairlines
  line: '#E6E6E1',
  lineStrong: '#D3D3CC',

  // Brand — verified green
  brand: '#0E8A63',
  brandDark: '#08694B',
  brandBright: '#16A374',
  brandSoft: '#E7F4EE',
  brandLine: '#BFE3D3',

  // Ratings / highlights
  amber: '#E59A1F',
  amberDark: '#8A5A0B',
  amberSoft: '#FDF3E1',

  // Danger / SOS
  danger: '#D93025',
  dangerDark: '#A52119',
  dangerSoft: '#FDECEA',

  // Overlays
  scrim: 'rgba(17, 18, 20, 0.5)'
};

export type IconName = keyof typeof Ionicons.glyphMap;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const type = StyleSheet.create({
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: C.text, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: C.text, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', color: C.text },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: C.text },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: C.muted },
  smallStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.text },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: C.muted },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' }
});

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8
  }
};

/**
 * Global icon scale. Icons read a touch large next to the type scale, so every
 * glyph is drawn slightly smaller in one place instead of touching each call.
 */
export const ICON_SCALE = 0.85;

export function Icon({ name, color = C.ink, size = 20 }: { name: IconName; color?: string; size?: number }) {
  return <Ionicons name={name} size={Math.round(size * ICON_SCALE)} color={color} />;
}

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  style,
  testID
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const palette = buttonPalette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{ color: palette.ripple }}
      style={({ pressed }) => [
        btn.base,
        size === 'md' && btn.md,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !isDisabled && { backgroundColor: palette.pressed },
        isDisabled && btn.disabled,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={btn.row}>
          {icon && <Icon name={icon} color={palette.fg} size={size === 'md' ? 17 : 19} />}
          <Text style={[btn.text, size === 'md' && btn.textMd, { color: palette.fg }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonPalette: Record<ButtonVariant, { bg: string; fg: string; border: string; pressed: string; ripple: string }> = {
  primary: { bg: C.ink, fg: C.white, border: C.ink, pressed: C.ink2, ripple: 'rgba(255,255,255,0.12)' },
  brand: { bg: C.brand, fg: C.white, border: C.brand, pressed: C.brandDark, ripple: 'rgba(255,255,255,0.15)' },
  secondary: { bg: C.white, fg: C.ink, border: C.lineStrong, pressed: C.surface, ripple: C.surface2 },
  ghost: { bg: 'transparent', fg: C.ink, border: 'transparent', pressed: C.surface, ripple: C.surface2 },
  danger: { bg: C.danger, fg: C.white, border: C.danger, pressed: C.dangerDark, ripple: 'rgba(255,255,255,0.15)' }
};

const btn = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  md: { minHeight: 44, borderRadius: radius.sm + 2, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
  textMd: { fontSize: 14 },
  disabled: { opacity: 0.4 }
});

/* ------------------------------------------------------------- Containers */

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [ui.card, pressed && ui.cardPressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[ui.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ui.sectionHeader, style]}>
      <Text style={type.heading}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={ui.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[ui.divider, style]} />;
}

/* ------------------------------------------------------------------ Badges */

export type Tone = 'neutral' | 'brand' | 'amber' | 'danger' | 'dark';

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: C.surface, fg: C.ink2 },
  brand: { bg: C.brandSoft, fg: C.brandDark },
  amber: { bg: C.amberSoft, fg: C.amberDark },
  danger: { bg: C.dangerSoft, fg: C.dangerDark },
  dark: { bg: C.ink, fg: C.white }
};

export function Badge({ label, tone = 'neutral', icon, style }: { label: string; tone?: Tone; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const t = toneColors[tone];
  return (
    <View style={[ui.badge, { backgroundColor: t.bg }, style]}>
      {icon && <Icon name={icon} size={12} color={t.fg} />}
      <Text style={[ui.badgeText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, testID }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [ui.chip, selected && ui.chipSelected, pressed && !selected && { backgroundColor: C.surface }]}
    >
      {icon && <Icon name={icon} size={15} color={selected ? C.white : C.ink} />}
      <Text style={[ui.chipText, selected && { color: C.white }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Rows */

export function ListRow({
  icon,
  iconTone = 'neutral',
  title,
  subtitle,
  right,
  onPress,
  chevron = !!onPress,
  destructive,
  testID
}: {
  icon?: IconName;
  iconTone?: Tone;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  testID?: string;
}) {
  const t = toneColors[iconTone];
  const content = (
    <>
      {icon && (
        <View style={[ui.rowIcon, { backgroundColor: destructive ? C.dangerSoft : t.bg }]}>
          <Icon name={icon} size={18} color={destructive ? C.danger : iconTone === 'neutral' ? C.ink : t.fg} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, destructive && { color: C.danger }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 1 }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron && <Icon name="chevron-forward" size={18} color={C.faint} />}
    </>
  );
  if (!onPress) return <View testID={testID} style={ui.row}>{content}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [ui.row, pressed && { backgroundColor: C.surface }]}>
      {content}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Inputs */

export function Field({
  label,
  hint,
  error,
  prefix,
  style,
  inputStyle,
  ...input
}: TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={style}>
      {label ? <Text style={ui.fieldLabel}>{label}</Text> : null}
      <View style={[ui.field, input.multiline && ui.fieldMultiline, focused && ui.fieldFocused, !!error && ui.fieldError]}>
        {prefix ? <Text style={ui.fieldPrefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={C.faint}
          {...input}
          onFocus={e => { setFocused(true); input.onFocus?.(e); }}
          onBlur={e => { setFocused(false); input.onBlur?.(e); }}
          style={[ui.fieldInput, input.multiline && ui.fieldInputMultiline, inputStyle]}
        />
      </View>
      {error ? <Text style={ui.fieldErrorText}>{error}</Text> : hint ? <Text style={ui.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/* ---------------------------------------------------------------- Misc */

export function IconButton({ icon, onPress, label, tone = 'neutral', size = 40, testID }: { icon: IconName; onPress: () => void; label: string; tone?: Tone | 'plain'; size?: number; testID?: string }) {
  const t = tone === 'plain' ? { bg: 'transparent', fg: C.ink } : toneColors[tone];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
        pressed && { opacity: 0.7 }
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.fg} />
    </Pressable>
  );
}

export function Avatar({ name, size = 44, tone = 'dark', uri }: { name?: string; size?: number; tone?: Tone; uri?: string | null }) {
  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?';
  const t = toneColors[tone];
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.fg, fontWeight: '600', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIcon}><Icon name={icon} size={26} color={C.ink} /></View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center', maxWidth: 300 }]}>{body}</Text>
      {action && onAction ? <Button label={action} onPress={onAction} variant="secondary" size="md" style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function KeyValue({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={ui.kv}>
      <Text style={type.small}>{label}</Text>
      <Text style={[strong ? type.bodyStrong : type.smallStrong, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export const rupee = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const ui = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.line,
    padding: space.lg
  },
  cardPressed: { backgroundColor: C.surface },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionAction: { color: C.brand, fontWeight: '600', fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.lineStrong },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.white
  },
  chipSelected: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, fontWeight: '500', color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6 },
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: 10 },
  fieldFocused: { borderColor: C.ink, borderWidth: 1.5 },
  fieldError: { borderColor: C.danger },
  fieldPrefix: { fontSize: 16, fontWeight: '600', color: C.ink, marginRight: 10 },
  fieldInput: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 12, outlineStyle: 'none' } as any,
  fieldInputMultiline: { minHeight: 84, textAlignVertical: 'top', paddingVertical: 4 },
  fieldHint: { fontSize: 12, color: C.muted, marginTop: 6 },
  fieldErrorText: { fontSize: 12, color: C.danger, marginTop: 6, fontWeight: '500' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 5 }
});
