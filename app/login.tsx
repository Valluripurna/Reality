import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RealityChainLogo } from '../src/logo';
import { DatabaseEngine } from '../src/db';
import { useMarketplace } from '../src/marketplace';
import { useToast } from '../src/toast';
import { Button, C, Icon } from '../src/ui';

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const { setProfile, profile } = useMarketplace();
  const { role = 'customer' } = useLocalSearchParams<{ role: 'customer' | 'pro' }>();
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');

  const send = () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      return Alert.alert('Valid Phone Required', 'Please enter a valid 10-digit mobile number.');
    }
    setOtpSent(true);
    toast.show('Demo OTP sent: 123456', 'info');
  };

  const verify = async () => {
    if (otp !== '123456') {
      return Alert.alert('Incorrect OTP', 'Use 123456 for this demo build.');
    }

    const clean = phone.replace(/\D/g, '').slice(-10);
    await DatabaseEngine.setActivePhone(clean);
    const existing = await DatabaseEngine.loadProfile(clean);

    if (existing) {
      setProfile(existing);
      toast.show(`Welcome back ${existing.name}! Logged in as ${existing.role === 'customer' ? 'Customer' : 'Service Pro'}.`, 'success');
      router.replace(existing.role === 'customer' ? '/' : '/pro');
    } else {
      setVerifiedPhone(clean);
      setIsNewUser(true);
      toast.show('New mobile number verified! Please select your account type.', 'info');
    }
  };

  const handleCreateNewAccount = (selectedRole: 'customer' | 'pro') => {
    if (selectedRole === 'customer') {
      const cust = {
        name: 'Customer User',
        phone: verifiedPhone,
        role: 'customer' as const,
        address: '100ft Rd, Indiranagar, Bengaluru',
        preferredPayment: 'UPI' as const,
        savedPlaces: [
          { id: '1', label: 'Home', address: '100ft Rd, Indiranagar, Bengaluru', icon: 'home' as const },
          { id: '2', label: 'Work', address: 'EGL Tech Park, Domlur, Bengaluru', icon: 'briefcase' as const }
        ],
        emergencyContacts: [
          { id: '1', name: 'Rohan Sharma', phone: '9876543210', relation: 'Spouse / Family' }
        ]
      };
      setProfile(cust);
      toast.show('Customer account created! Signed in successfully.', 'success');
      router.replace('/');
    } else {
      const p = {
        name: 'Service Pro',
        phone: verifiedPhone,
        role: 'pro' as const,
        skills: 'Plumbing, Electrical, Appliance Repair, Cleaning',
        proLevel: 'Gold Pro' as const,
        serviceRadiusKm: 50,
        ratingScore: 4.9,
        completedJobsCount: 0,
        payoutUpi: `${verifiedPhone}@upi`,
        bankName: 'HDFC Bank',
        accountNumber: '5010049281029',
        ifscCode: 'HDFC0001234',
        liveLat: 12.9791,
        liveLng: 77.6020,
        isOnline: true,
        freeAcceptsRemaining: 50,
        monthlyFreeAcceptsRemaining: 20,
        subscriptionActive: false,
        gpsEnabled: true
      };
      setProfile(p);
      toast.show('Service Pro account created! Signed in successfully.', 'success');
      router.replace('/pro');
    }
  };

  return (
    <SafeAreaView style={s.page}>
      <View style={s.container}>
        <View style={s.top}>
          <RealityChainLogo size="large" showText={true} />
          <Text style={[s.kicker, { marginTop: 16 }]}>SECURE SIGN IN</Text>
          <Text style={s.title}>
            {isNewUser ? 'Select Account Type' : otpSent ? 'Enter OTP Code' : 'Mobile Sign In'}
          </Text>
          <Text style={s.sub}>
            {isNewUser
              ? `First time registration for +91 ${verifiedPhone}. How will you be using the app?`
              : otpSent
              ? `Verification code sent to +91 ${phone}`
              : 'Enter your registered 10-digit mobile number to access your account.'}
          </Text>
        </View>

        <View style={s.form}>
          {isNewUser ? (
            <View style={s.roleCardContainer}>
              <Pressable onPress={() => handleCreateNewAccount('customer')} style={s.roleCard}>
                <View style={[s.roleIconWrap, { backgroundColor: C.mint }]}>
                  <Icon name="person" size={26} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.roleCardTitle}>Customer Account</Text>
                  <Text style={s.roleCardSub}>Hire local verified pros for Plumbing, Electrical, AC Repair & Home Services.</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={C.green} />
              </Pressable>

              <Pressable onPress={() => handleCreateNewAccount('pro')} style={[s.roleCard, s.roleCardPro]}>
                <View style={[s.roleIconWrap, { backgroundColor: '#EEF2FF' }]}>
                  <Icon name="construct" size={26} color={C.indigo} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.roleCardTitle}>Service Pro Account</Text>
                  <Text style={s.roleCardSub}>Offer repair services, accept nearby requests & manage bank payouts.</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={C.indigo} />
              </Pressable>
            </View>
          ) : otpSent ? (
            <>
              <Text style={s.label}>6-Digit Verification Code</Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                style={s.otp}
              />
              <Pressable onPress={send} style={{ alignSelf: 'center', marginVertical: 14 }}>
                <Text style={s.resend}>Resend OTP Code</Text>
              </Pressable>
              <Button label="Verify & Sign In" onPress={verify} icon="shield-checkmark" />
            </>
          ) : (
            <>
              <Text style={s.label}>Mobile Number</Text>
              <View style={s.phone}>
                <View style={s.prefixBox}>
                  <Text style={s.prefix}>+91</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98765 43210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={s.phoneInput}
                />
              </View>

              <View style={s.privacy}>
                <Icon name="lock-closed" size={16} color={C.green} />
                <Text style={s.privacyText}>Your number is securely verified for booking updates.</Text>
              </View>

              <Button label="Send SMS OTP" onPress={send} icon="chatbubble-ellipses" />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.paper
  },
  container: {
    flex: 1,
    padding: 22,
    maxWidth: 550,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center'
  },
  top: {
    marginBottom: 24
  },
  kicker: {
    color: C.green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 22
  },
  title: {
    color: C.navy,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6
  },
  sub: {
    color: C.muted,
    lineHeight: 20,
    marginTop: 8,
    fontSize: 13
  },
  form: {
    marginTop: 20
  },
  roleCardContainer: {
    gap: 14,
    marginTop: 10
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: C.green,
    elevation: 3
  },
  roleCardPro: {
    borderColor: C.indigo
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  roleCardTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 16
  },
  roleCardSub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16
  },
  label: {
    color: C.navy,
    fontWeight: '800',
    marginBottom: 8,
    fontSize: 13
  },
  phone: {
    height: 54,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 14,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden'
  },
  prefixBox: {
    backgroundColor: C.paper,
    height: '100%',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: C.line
  },
  prefix: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 15
  },
  phoneInput: {
    flex: 1,
    color: C.navy,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    height: '100%',
    outlineStyle: 'none' as any
  },
  privacy: {
    backgroundColor: C.mint,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    marginVertical: 18,
    alignItems: 'center'
  },
  privacyText: {
    color: C.green,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
    fontWeight: '600'
  },
  otp: {
    letterSpacing: 12,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    outlineStyle: 'none' as any,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.white,
    color: C.navy
  },
  resend: {
    color: C.green,
    fontWeight: '800',
    fontSize: 13
  }
});
