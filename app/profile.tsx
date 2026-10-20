import { Redirect, useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMarketplace } from '../src/marketplace';
import { categories } from '../src/matching';
import { BottomNav, HomeHeader, useTabBarSpace } from '../src/navigation';
import { PassSheet } from '../src/pass-sheet';
import { LocationCard } from '../src/location-card';
import { geocodeAddress } from '../src/location';
import { pickImage } from '../src/permissions';
import { useToast } from '../src/toast';
import { CustomerProfile, PaymentMethod, ProProfile } from '../src/types';
import { Avatar, Badge, Button, C, Card, Chip, Divider, Field, Icon, ListRow, radius, rupee, type } from '../src/ui';

export default function Account() {
  const router = useRouter();
  const toast = useToast();
  const bottomSpace = useTabBarSpace();
  const market = useMarketplace();
  const { profile, updateProfile, logout } = market;

  const [name, setName] = useState(profile?.name ?? '');
  useEffect(() => { setName(profile?.name ?? ''); }, [profile?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return <Redirect href="/welcome" />;
  const dirty = name.trim() !== profile.name;

  const save = () => {
    if (name.trim().length < 2) return toast.show('Enter your name.', 'warning');
    updateProfile({ name: name.trim() });
    toast.show('Saved', 'success');
  };

  const signOut = () => {
    const go = () => { logout(); router.replace('/welcome'); };
    if (Platform.OS === 'web') return go();
    Alert.alert('Log out?', 'You can sign back in with your mobile number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: go }
    ]);
  };

  return (
    <View style={s.page}>
      <HomeHeader left={<Text style={type.title}>Account</Text>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomSpace + (dirty ? 70 : 0) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Pressable
            onPress={async () => { const uri = await pickImage({ square: true }); if (uri) updateProfile({ avatarUri: uri }); }}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            {profile.avatarUri ? <Image source={{ uri: profile.avatarUri }} style={s.avatar} /> : <Avatar name={profile.name} size={64} />}
            <View style={s.camera}><Icon name="camera" size={12} color={C.white} /></View>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={type.title} numberOfLines={1}>{profile.name}</Text>
            <Text style={type.small}>+91 {profile.phone}</Text>
            <Badge label={profile.role === 'pro' ? 'Service pro' : 'Customer'} tone={profile.role === 'pro' ? 'dark' : 'neutral'} />
          </View>
        </View>

        <Section title="Profile">
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        </Section>

        <View style={{ marginTop: 28 }}>
          <Text style={type.heading}>Location</Text>
          <Text style={[type.small, { marginTop: 2, marginBottom: 10 }]}>
            {profile.role === 'pro'
              ? 'Customers see how far you are. While you are online it updates automatically.'
              : 'Used to find pros near you and as your default service address.'}
          </Text>
          <LocationCard title={profile.role === 'pro' ? 'Your current location' : 'Service address'} />
        </View>

        {profile.role === 'customer'
          ? <View testID="account-customer"><CustomerSections profile={profile} /></View>
          : <View testID="account-pro"><ProSections profile={profile} /></View>}

        <Section title="More" flush>
          <ListRow icon="help-circle-outline" title="Help & support" subtitle="support@realitychain.app" onPress={() => Linking.openURL('mailto:support@realitychain.app').catch(() => {})} />
          <Divider />
          <ListRow icon="shield-outline" title="Privacy" subtitle="Your bookings are only visible to you and your pro" />
          <Divider />
          <ListRow testID="about-row" icon="information-circle-outline" title="About & How it works" subtitle="What to expect, step by step" onPress={() => router.push('/about' as any)} />
          <Divider />
          <ListRow testID="logout" icon="log-out-outline" title="Log out" destructive onPress={signOut} chevron={false} />
        </Section>
      </ScrollView>

      {dirty && (
        <View style={[s.saveBar, { bottom: bottomSpace - 16 }]}>
          <Button label="Discard" variant="secondary" size="md" onPress={() => setName(profile.name)} style={{ flex: 1 }} />
          <Button testID="save-profile" label="Save changes" size="md" onPress={save} style={{ flex: 2 }} />
        </View>
      )}
      <BottomNav />
    </View>
  );
}

/* ----------------------------------------------------------- customer */

function CustomerSections({ profile }: { profile: CustomerProfile }) {
  const toast = useToast();
  const { updateCustomerPlaces, updateEmergencyContacts, updateProfile } = useMarketplace();
  const [placeLabel, setPlaceLabel] = useState('');
  const [placeAddr, setPlaceAddr] = useState('');
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const places = profile.savedPlaces ?? [];
  const contacts = profile.emergencyContacts ?? [];

  return (
    <>
      <Section title="Saved addresses" flush>
        {places.map(p => (
          <View key={p.id}>
            <ListRow
              icon={p.label.toLowerCase() === 'work' ? 'briefcase-outline' : p.label.toLowerCase() === 'home' ? 'home-outline' : 'location-outline'}
              title={p.label}
              subtitle={p.address}
              right={<Pressable onPress={() => updateCustomerPlaces(places.filter(x => x.id !== p.id))} hitSlop={8} accessibilityLabel={`Remove ${p.label}`}><Icon name="trash-outline" size={18} color={C.muted} /></Pressable>}
            />
            <Divider />
          </View>
        ))}
        <View style={s.addForm}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field value={placeLabel} onChangeText={setPlaceLabel} placeholder="Label" style={{ flex: 1 }} />
            <Field value={placeAddr} onChangeText={setPlaceAddr} placeholder="Address" style={{ flex: 2 }} />
          </View>
          <Button
            label="Add address"
            icon="add"
            variant="secondary"
            size="md"
            disabled={!placeLabel.trim() || !placeAddr.trim()}
            onPress={async () => {
              const label = placeLabel.trim();
              const address = placeAddr.trim();
              setPlaceLabel(''); setPlaceAddr('');
              const hit = await geocodeAddress(address);
              updateCustomerPlaces([...places, { id: `${Date.now()}`, label, address, icon: 'location-outline', lat: hit?.lat, lng: hit?.lng }]);
              toast.show(hit ? 'Address saved' : "Address saved — we couldn't pin it on the map", hit ? 'success' : 'warning');
            }}
          />
        </View>
      </Section>

      <Section title="Emergency contacts" subtitle="Used by SOS to text your location. Nothing is sent without you tapping send." flush>
        {contacts.map(c => (
          <View key={c.id}>
            <ListRow
              icon="person-outline"
              title={c.name}
              subtitle={`+91 ${c.phone}`}
              right={<Pressable onPress={() => updateEmergencyContacts(contacts.filter(x => x.id !== c.id))} hitSlop={8} accessibilityLabel={`Remove ${c.name}`}><Icon name="trash-outline" size={18} color={C.muted} /></Pressable>}
            />
            <Divider />
          </View>
        ))}
        <View style={s.addForm}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field value={cName} onChangeText={setCName} placeholder="Name" style={{ flex: 1 }} />
            <Field value={cPhone} onChangeText={v => setCPhone(v.replace(/\D/g, '').slice(0, 10))} placeholder="Mobile" keyboardType="phone-pad" style={{ flex: 1 }} />
          </View>
          <Button
            label="Add contact"
            icon="add"
            variant="secondary"
            size="md"
            disabled={!cName.trim() || cPhone.length !== 10}
            onPress={() => {
              updateEmergencyContacts([...contacts, { id: `${Date.now()}`, name: cName.trim(), phone: cPhone, relation: 'Emergency contact' }]);
              setCName(''); setCPhone('');
              toast.show('Emergency contact added', 'success');
            }}
          />
        </View>
      </Section>

      <Section title="Preferred payment">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['UPI', 'Cash after Service'] as PaymentMethod[]).map(m => (
            <Chip key={m} label={m === 'Cash after Service' ? 'Cash' : m} selected={(profile.preferredPayment ?? 'UPI') === m} onPress={() => updateProfile({ preferredPayment: m })} />
          ))}
        </View>
      </Section>
    </>
  );
}

/* ----------------------------------------------------------- pro */

function ProSections({ profile }: { profile: ProProfile }) {
  const toast = useToast();
  const { updateProfile, toggleProOnline, toggleProGps, addCustomService, removeCustomService, verifyAadhaarDocument } = useMarketplace();
  const [passOpen, setPassOpen] = useState(false);
  const [svcTitle, setSvcTitle] = useState('');
  const [svcRate, setSvcRate] = useState('');
  const [upi, setUpi] = useState(profile.payoutUpi ?? '');
  const [bank, setBank] = useState(profile.bankName ?? '');
  const [acct, setAcct] = useState(profile.accountNumber ?? '');
  const [ifsc, setIfsc] = useState(profile.ifscCode ?? '');

  const skills = (profile.skills || '').split(',').map(x => x.trim()).filter(Boolean);
  const toggleSkill = (k: string) => {
    const next = skills.includes(k) ? skills.filter(x => x !== k) : [...skills, k];
    updateProfile({ skills: next.join(', ') } as Partial<ProProfile>);
  };
  const passActive = profile.subscriptionActive && profile.passExpiresAt && new Date(profile.passExpiresAt).getTime() > Date.now();
  const payoutDirty = upi !== (profile.payoutUpi ?? '') || bank !== (profile.bankName ?? '') || acct !== (profile.accountNumber ?? '') || ifsc !== (profile.ifscCode ?? '');

  return (
    <>
      <Section title="Availability" flush>
        <ListRow
          icon="radio-outline"
          title={profile.isOnline ? 'Online' : 'Offline'}
          subtitle={profile.isOnline ? 'You receive new requests' : 'You are hidden from customers'}
          right={<Switch value={profile.isOnline} onValueChange={v => toggleProOnline(v)} trackColor={{ false: C.lineStrong, true: C.brand }} thumbColor={C.white} />}
        />
        <Divider />
        <ListRow
          icon="navigate-outline"
          title="Share live location"
          subtitle={profile.gpsEnabled !== false ? 'Customers can track you on active jobs' : 'Off — customers only see your last known area'}
          right={<Switch testID="gps-toggle" value={profile.gpsEnabled !== false} onValueChange={v => toggleProGps(v)} trackColor={{ false: C.lineStrong, true: C.brand }} thumbColor={C.white} />}
        />
        <Divider />
        <View style={{ paddingVertical: 12 }}>
          <Text style={[type.smallStrong, { marginBottom: 8 }]}>Service radius</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[5, 10, 25, 50].map(r => (
              <Chip key={r} label={`${r} km`} selected={(profile.serviceRadiusKm ?? 10) === r} onPress={() => updateProfile({ serviceRadiusKm: r } as Partial<ProProfile>)} />
            ))}
          </View>
        </View>
      </Section>

      <Section title="Services you offer" subtitle="You'll see requests that match these first.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.filter(c => c !== 'Other').map(c => (
            <Chip key={c} label={c} selected={skills.includes(c)} onPress={() => toggleSkill(c)} />
          ))}
        </View>
        {(profile.customServices ?? []).length > 0 && (
          <View style={{ marginTop: 12 }}>
            {(profile.customServices ?? []).map(svc => (
              <ListRow
                key={svc.id}
                icon="pricetag-outline"
                title={svc.title}
                subtitle={`From ${rupee(svc.baseRate)}`}
                right={<Pressable onPress={() => removeCustomService(svc.id)} hitSlop={8} accessibilityLabel={`Remove ${svc.title}`}><Icon name="trash-outline" size={18} color={C.muted} /></Pressable>}
              />
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Field value={svcTitle} onChangeText={setSvcTitle} placeholder="Other service, e.g. CCTV repair" style={{ flex: 2 }} />
          <Field value={svcRate} onChangeText={v => setSvcRate(v.replace(/\D/g, ''))} placeholder="₹ from" keyboardType="number-pad" style={{ flex: 1 }} />
        </View>
        <Button
          label="Add service"
          icon="add"
          variant="secondary"
          size="md"
          style={{ marginTop: 10 }}
          disabled={!svcTitle.trim() || !Number(svcRate)}
          onPress={() => {
            addCustomService(svcTitle, Number(svcRate));
            toggleSkill(svcTitle.trim());
            setSvcTitle(''); setSvcRate('');
            toast.show('Service added', 'success');
          }}
        />
      </Section>

      <Section title="Plan" flush>
        <ListRow
          icon="ticket-outline"
          iconTone={passActive ? 'brand' : 'amber'}
          title={passActive ? `${profile.passType} pass active` : `${profile.freeAcceptsRemaining ?? 0} free quotes left`}
          subtitle={passActive ? `Until ${new Date(profile.passExpiresAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Get a pass for unlimited quotes'}
          onPress={() => setPassOpen(true)}
        />
      </Section>

      <Section title="Verification" subtitle="Verified pros get more bookings. Our team reviews documents manually.">
        <DocRow
          title="Government ID"
          status={profile.aadhaarVerified ? 'Verified' : profile.idProofUri ? 'In review' : 'Not added'}
          onPress={async () => {
            const uri = await pickImage();
            if (!uri) return;
            const res = verifyAadhaarDocument(uri);
            toast.show(res.message, 'info');
          }}
        />
        <Divider style={{ marginVertical: 4 }} />
        <DocRow
          title="Trade certificate (optional)"
          status={profile.certificateUri ? 'Added' : 'Not added'}
          onPress={async () => {
            const uri = await pickImage();
            if (uri) { updateProfile({ certificateUri: uri } as Partial<ProProfile>); toast.show('Certificate added', 'success'); }
          }}
        />
      </Section>

      <Section title="Payouts" subtitle="Your UPI ID becomes a scannable payment QR for customers. 10% platform fee on completed jobs.">
        <Field label="UPI ID" value={upi} onChangeText={setUpi} placeholder="name@bank" autoCapitalize="none" />
        <Field label="Bank name" value={bank} onChangeText={setBank} placeholder="e.g. HDFC Bank" style={{ marginTop: 12 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Field label="Account number" value={acct} onChangeText={v => setAcct(v.replace(/\D/g, ''))} keyboardType="number-pad" style={{ flex: 3 }} />
          <Field label="IFSC" value={ifsc} onChangeText={v => setIfsc(v.toUpperCase())} autoCapitalize="characters" maxLength={11} style={{ flex: 2 }} />
        </View>
        {payoutDirty && (
          <Button
            label="Save payout details"
            size="md"
            style={{ marginTop: 12 }}
            onPress={() => {
              if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return toast.show('That IFSC code looks wrong.', 'warning');
              if (upi && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return toast.show('That UPI ID looks wrong.', 'warning');
              updateProfile({ payoutUpi: upi.trim(), bankName: bank.trim(), accountNumber: acct, ifscCode: ifsc } as Partial<ProProfile>);
              toast.show('Payout details saved', 'success');
            }}
          />
        )}
      </Section>

      <PassSheet visible={passOpen} onClose={() => setPassOpen(false)} />
    </>
  );
}

/* ----------------------------------------------------------- bits */

function Section({ title, subtitle, children, flush, testID }: { title: string; subtitle?: string; children: ReactNode; flush?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={{ marginTop: 28 }}>
      <Text style={type.heading}>{title}</Text>
      {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      <Card style={[{ marginTop: 10 }, flush && { paddingVertical: 2 }]}>{children}</Card>
    </View>
  );
}

function DocRow({ title, status, onPress }: { title: string; status: string; onPress: () => void }) {
  const tone = status === 'Verified' || status === 'Added' ? 'brand' : status === 'In review' ? 'amber' : 'neutral';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Badge label={status} tone={tone} />
      </View>
      <Button label={status === 'Not added' ? 'Upload' : 'Replace'} size="md" variant="secondary" onPress={onPress} />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: C.ink, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  addForm: { gap: 10, paddingVertical: 12 },
  saveBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  }
});
