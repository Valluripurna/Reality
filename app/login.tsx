import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authMode, cleanPhone, DEMO_OTP, isValidIndianMobile, requestOtp, verifyOtp } from '../src/auth';
import { BrandMark } from '../src/brand';
import { DatabaseEngine } from '../src/db';
import { FREE_ACCEPTS, useMarketplace } from '../src/marketplace';
import { ScreenHeader } from '../src/navigation';
import { useToast } from '../src/toast';
import { Badge, Button, C, Field, Icon, IconName, radius, type } from '../src/ui';

type Step = 'phone' | 'otp' | 'setup';
type Role = 'customer' | 'pro';

const RESEND_AFTER = 30;

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { setProfile } = useMarketplace();
  const params = useLocalSearchParams<{ role?: Role }>();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>(params.role === 'pro' ? 'pro' : 'customer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digits = cleanPhone(phone);
  const pretty = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

  const sendCode = async () => {
    setError(undefined);
    setBusy(true);
    const res = await requestOtp(phone);
    setBusy(false);
    if (!res.ok) return setError(res.reason);
    setOtp('');
    setStep('otp');
    setResendIn(RESEND_AFTER);
    setTimeout(() => otpRef.current?.focus(), 250);
  };

  const checkCode = async (code = otp) => {
    setError(undefined);
    setBusy(true);
    const res = await verifyOtp(phone, code);
    if (!res.ok) {
      setBusy(false);
      return setError(res.reason);
    }
    await DatabaseEngine.setActivePhone(digits);
    const existing = await DatabaseEngine.loadProfile(digits);
    setBusy(false);
    if (existing) {
      setProfile(existing);
      toast.show(`Welcome back, ${existing.name.split(' ')[0]}`, 'success');
      router.replace(existing.role === 'pro' ? '/pro' : '/');
    } else {
      setStep('setup');
    }
  };

  const createAccount = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError('Enter your name.');
    setError(undefined);
    if (role === 'customer') {
      setProfile({ role: 'customer', name: trimmed, phone: digits });
      toast.show('Account created', 'success');
      router.replace('/');
    } else {
      setProfile({
        role: 'pro',
        name: trimmed,
        phone: digits,
        skills: '',
        isOnline: true,
        freeAcceptsRemaining: FREE_ACCEPTS,
        monthlyFreeAcceptsRemaining: 0,
        subscriptionActive: false,
        gpsEnabled: true
      });
      toast.show('Pro account created. Add your skills to start getting jobs.', 'success');
      router.replace('/profile');
    }
  };

  const back = () => {
    setError(undefined);
    if (step === 'otp') return setStep('phone');
    if (step === 'setup') return setStep('phone');
    if (router.canGoBack()) router.back(); else router.replace('/welcome');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <ScreenHeader onBack={back} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <BrandMark size={44} tile />

          {step === 'phone' && (
            <>
              <Text style={[type.display, s.title]}>Enter your mobile number</Text>
              <Text style={type.small}>We'll text you a 6-digit code to confirm it's you.</Text>
              <Field
                testID="phone-input"
                style={{ marginTop: 28 }}
                prefix="+91"
                value={phone}
                onChangeText={v => { setPhone(v.replace(/\D/g, '').slice(0, 10)); setError(undefined); }}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
                error={error}
                returnKeyType="done"
                onSubmitEditing={() => isValidIndianMobile(phone) && sendCode()}
              />
              <View style={{ flex: 1, minHeight: 28 }} />
              <Button testID="send-code" label="Continue" onPress={sendCode} loading={busy} disabled={!isValidIndianMobile(phone)} />
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={[type.display, s.title]}>Enter the code</Text>
              <Text style={type.small}>
                Sent to {pretty}.{' '}
                <Text style={s.link} onPress={() => setStep('phone')}>Change</Text>
              </Text>
              {authMode() === 'demo' && (
                <Badge tone="amber" icon="information-circle" label={`Demo build — use code ${DEMO_OTP}`} style={{ marginTop: 14 }} />
              )}

              <Pressable onPress={() => otpRef.current?.focus()} style={s.cells} accessibilityLabel="One-time code">
                {Array.from({ length: 6 }).map((_, i) => {
                  const focused = otp.length === i || (i === 5 && otp.length === 6);
                  return (
                    <View key={i} style={[s.cell, focused && s.cellFocused, !!error && s.cellError]}>
                      <Text style={s.cellText}>{otp[i] ?? ''}</Text>
                    </View>
                  );
                })}
                <TextInput
                  testID="otp-input"
                  ref={otpRef}
                  value={otp}
                  onChangeText={v => {
                    const code = v.replace(/\D/g, '').slice(0, 6);
                    setOtp(code);
                    setError(undefined);
                    if (code.length === 6) checkCode(code);
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  style={s.hiddenInput}
                  caretHidden
                />
              </Pressable>
              {error ? <Text style={s.error}>{error}</Text> : null}

              <Pressable disabled={resendIn > 0} onPress={sendCode} style={{ marginTop: 18 }} hitSlop={8}>
                <Text style={[type.smallStrong, { color: resendIn > 0 ? C.faint : C.ink }]}>
                  {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, '0')}` : 'Resend code'}
                </Text>
              </Pressable>
              <View style={{ flex: 1, minHeight: 28 }} />
              <Button testID="verify-code" label="Verify" onPress={() => checkCode()} loading={busy} disabled={otp.length !== 6} />
            </>
          )}

          {step === 'setup' && (
            <>
              <Text style={[type.display, s.title]}>Set up your account</Text>
              <Text style={type.small}>{pretty} is verified. Just a couple of details.</Text>

              <Field
                testID="name-input"
                style={{ marginTop: 24 }}
                label="Your name"
                value={name}
                onChangeText={v => { setName(v); setError(undefined); }}
                placeholder="Full name"
                autoCapitalize="words"
                autoFocus
                error={error}
              />

              <Text style={[s.label, { marginTop: 22 }]}>I want to</Text>
              <View style={{ gap: 10 }}>
                <RoleOption
                  icon="home-outline"
                  title="Book services"
                  body="Get help at home from pros nearby."
                  selected={role === 'customer'}
                  onPress={() => setRole('customer')}
                />
                <RoleOption
                  icon="construct-outline"
                  title="Offer my services"
                  body="Get job requests and send quotes."
                  selected={role === 'pro'}
                  onPress={() => setRole('pro')}
                />
              </View>
              <View style={{ flex: 1, minHeight: 28 }} />
              <Button testID="create-account" label="Create account" onPress={createAccount} disabled={name.trim().length < 2} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RoleOption({ icon, title, body, selected, onPress }: { icon: IconName; title: string; body: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.role, selected && s.roleSelected, pressed && !selected && { backgroundColor: C.surface }]}
    >
      <View style={[s.roleIcon, selected && { backgroundColor: C.ink }]}>
        <Icon name={icon} size={20} color={selected ? C.white : C.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text style={type.small}>{body}</Text>
      </View>
      <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.radioDot} />}</View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { marginTop: 24, marginBottom: 8 },
  link: { color: C.ink, fontWeight: '600', textDecorationLine: 'underline' },
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 8 },
  cells: { flexDirection: 'row', gap: 8, marginTop: 24 },
  cell: {
    flex: 1,
    maxWidth: 56,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cellFocused: { borderColor: C.ink, borderWidth: 1.5 },
  cellError: { borderColor: C.danger },
  cellText: { fontSize: 24, fontWeight: '600', color: C.ink },
  hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0.011, color: 'transparent' },
  error: { color: C.danger, fontSize: 13, marginTop: 10, fontWeight: '500' },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.lineStrong
  },
  roleSelected: { borderColor: C.ink, borderWidth: 1.5, backgroundColor: C.surface },
  roleIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.ink },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.ink }
});
