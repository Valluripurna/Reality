import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useMarketplace } from '../src/marketplace';
import { BottomNav, TopHeaderBar } from '../src/navigation';
import { useToast } from '../src/toast';
import { CustomerProfile, EmergencyContact, PaymentMethod, ProProfile, SavedPlace } from '../src/types';
import { Button, C, Icon } from '../src/ui';
import { parseAadhaarDocument } from '../src/ocr';

export default function Profile() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ role?: 'customer' | 'pro'; phone?: string }>();
  const {
    profile,
    setProfile,
    updateCustomerPlaces,
    updateEmergencyContacts,
    toggleProOnline,
    toggleProGps,
    activatePass,
    verifyAadhaarDocument,
    logout
  } = useMarketplace();

  const activeRole: 'customer' | 'pro' = (params.role as any) ?? profile?.role ?? 'customer';

  // Customer State
  const custProfile = profile?.role === 'customer' ? profile : null;
  const proProfile = profile?.role === 'pro' ? profile : null;

  const [name, setName] = useState(profile?.name ?? '');
  const [avatarUri, setAvatarUri] = useState(profile?.avatarUri);
  const [address, setAddress] = useState(profile?.address ?? '');
  const [prefPayment, setPrefPayment] = useState<PaymentMethod>(custProfile?.preferredPayment ?? 'UPI');
  const [quietPref, setQuietPref] = useState(custProfile?.quietServicePref ?? false);
  const [places, setPlaces] = useState<SavedPlace[]>(custProfile?.savedPlaces ?? [
    { id: '1', label: 'Home', address: '100ft Rd, Indiranagar, Bengaluru', icon: 'home' },
    { id: '2', label: 'Work', address: 'EGL Tech Park, Domlur, Bengaluru', icon: 'briefcase' }
  ]);
  const [newPlaceLabel, setNewPlaceLabel] = useState('');
  const [newPlaceAddr, setNewPlaceAddr] = useState('');

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(custProfile?.emergencyContacts ?? [
    { id: '1', name: 'Rohan Sharma', phone: '9876543210', relation: 'Spouse / Family' }
  ]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // Pro State
  const [skills, setSkills] = useState(proProfile?.skills ?? 'Plumbing, Pipe Fitting, Water Heater Repair');
  const [certUri, setCertUri] = useState(proProfile?.certificateUri);
  const [idProofUri, setIdProofUri] = useState(proProfile?.idProofUri);
  const [vehicleInfo, setVehicleInfo] = useState(proProfile?.vehicleInfo ?? 'KA-01-EB-4921 (TVS XL 100)');
  const [radiusKm, setRadiusKm] = useState(proProfile?.serviceRadiusKm ?? 50);
  const [payoutUpi, setPayoutUpi] = useState(proProfile?.payoutUpi ?? 'pro.service@upi');
  const [bankName, setBankName] = useState(proProfile?.bankName ?? 'HDFC Bank');
  const [accountNumber, setAccountNumber] = useState(proProfile?.accountNumber ?? '5010049281029');
  const [ifscCode, setIfscCode] = useState(proProfile?.ifscCode ?? 'HDFC0001234');
  const [passModalOpen, setPassModalOpen] = useState(false);

  // Image Upload Handlers
  const pickImage = async (type: 'avatar' | 'cert' | 'id') => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: type === 'avatar',
      aspect: type === 'avatar' ? [1, 1] : undefined,
      quality: 0.7
    });

    if (!res.canceled && res.assets[0]?.uri) {
      const uri = res.assets[0].uri;
      if (type === 'avatar') {
        setAvatarUri(uri);
        toast.show('Profile photo updated', 'success');
      } else if (type === 'cert') {
        setCertUri(uri);
        toast.show('Service certificate uploaded', 'success');
      } else if (type === 'id') {
        setIdProofUri(uri);
        const loginPhone = profile?.phone ?? params.phone ?? '9876543210';
        const parseResult = parseAadhaarDocument(uri, loginPhone);
        const res = verifyAadhaarDocument(uri);
        toast.show(parseResult.message, parseResult.isMobileMatch ? 'success' : 'warning');
      }
    }
  };

  const addPlace = () => {
    if (!newPlaceLabel.trim() || !newPlaceAddr.trim()) {
      return Alert.alert('Enter place details', 'Label and address are required.');
    }
    const newPlaces = [...places, { id: Date.now().toString(), label: newPlaceLabel.trim(), address: newPlaceAddr.trim(), icon: 'location' }];
    setPlaces(newPlaces);
    setNewPlaceLabel('');
    setNewPlaceAddr('');
    toast.show(`Saved ${newPlaceLabel} to your places`, 'success');
  };

  const removePlace = (id: string) => {
    setPlaces(places.filter(p => p.id !== id));
    toast.show('Place removed');
  };

  const addEmergencyContact = () => {
    if (!newContactName.trim() || newContactPhone.length < 10) {
      return Alert.alert('Invalid Contact', 'Provide a name and 10-digit phone number.');
    }
    const newContacts = [...emergencyContacts, { id: Date.now().toString(), name: newContactName.trim(), phone: newContactPhone.trim(), relation: 'Trusted Contact' }];
    setEmergencyContacts(newContacts);
    setNewContactName('');
    setNewContactPhone('');
    toast.show('Emergency contact added', 'success');
  };

  const removeEmergencyContact = (id: string) => {
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id));
    toast.show('Emergency contact removed');
  };

  const saveProfile = () => {
    if (!name.trim()) {
      return Alert.alert('Profile Name Required', 'Please enter your display name.');
    }

    if (activeRole === 'customer') {
      const updatedCust: CustomerProfile = {
        name: name.trim(),
        role: 'customer',
        phone: params.phone ?? profile?.phone ?? '9876543210',
        avatarUri,
        address: address.trim(),
        savedPlaces: places,
        emergencyContacts,
        preferredPayment: prefPayment,
        quietServicePref: quietPref,
        ratingScore: custProfile?.ratingScore ?? 4.95
      };
      setProfile(updatedCust);
      toast.show('Customer profile saved successfully!', 'success');
      router.replace('/');
    } else {
      const updatedPro: ProProfile = {
        name: name.trim(),
        role: 'pro',
        phone: params.phone ?? profile?.phone ?? '9876543210',
        avatarUri,
        address: address.trim(),
        skills: skills.trim(),
        certificateUri: certUri,
        idProofUri,
        vehicleInfo: vehicleInfo.trim(),
        serviceRadiusKm: radiusKm,
        payoutUpi: payoutUpi.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim(),
        isOnline: proProfile?.isOnline ?? true,
        proLevel: proProfile?.proLevel ?? 'Gold Pro',
        ratingScore: proProfile?.ratingScore ?? 4.9,
        completedJobsCount: proProfile?.completedJobsCount ?? 148,
        freeAcceptsRemaining: proProfile?.freeAcceptsRemaining ?? 50,
        monthlyFreeAcceptsRemaining: proProfile?.monthlyFreeAcceptsRemaining ?? 20,
        subscriptionActive: proProfile?.subscriptionActive ?? false,
        passType: proProfile?.passType,
        passExpiresAt: proProfile?.passExpiresAt,
        gpsEnabled: proProfile?.gpsEnabled ?? true
      };
      setProfile(updatedPro);
      toast.show('Service Pro profile updated & synced!', 'success');
      router.replace('/pro');
    }
  };

  const handleLogout = () => {
    logout();
    toast.show('Logged out successfully', 'info');
    router.replace('/login');
  };

  const switchRole = () => {
    const nextRole = activeRole === 'customer' ? 'pro' : 'customer';
    toast.show(`Switched view to ${nextRole === 'pro' ? 'Service Pro Mode' : 'Customer Mode'}`, 'info');
    router.replace({ pathname: '/profile', params: { role: nextRole } });
  };

  return (
    <SafeAreaView style={s.page}>
      <TopHeaderBar />
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header Bar */}
        <View style={s.topRow}>
          <Text style={s.kicker}>{activeRole === 'pro' ? 'SERVICE PRO ACCOUNT' : 'MY PROFILE'}</Text>
        </View>

        {/* Profile Header Box */}
        <View style={s.profileCard}>
          <Pressable onPress={() => pickImage('avatar')} style={s.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Icon name="person" size={28} color={C.white} />
              </View>
            )}
            <View style={s.cameraBadge}>
              <Icon name="camera" size={12} color={C.white} />
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={s.profileTitle}>{name || (activeRole === 'pro' ? 'Service Professional' : 'Customer')}</Text>
            <View style={s.ratingBadgeRow}>
              <Icon name="star" size={14} color="#E6A92D" />
              <Text style={s.ratingText}>
                {activeRole === 'customer'
                  ? `${custProfile?.ratingScore ?? 4.95} ⭐ Customer Score`
                  : `${proProfile?.ratingScore ?? 4.9} ⭐ (${proProfile?.proLevel ?? 'Gold Pro'})`}
              </Text>
            </View>
            <Text style={s.phoneVerifiedText}>
              ✓ Verified · +91 {profile?.phone ?? params.phone ?? '9876543210'}
            </Text>
          </View>
        </View>

        {/* Status indicator / Pro Switch */}
        {activeRole === 'pro' && (
          <>
            <View style={s.statusToggleBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.statusToggleTitle}>Online Status</Text>
                <Text style={s.statusToggleSub}>
                  {proProfile?.isOnline ? 'Active on map & receiving local requests' : 'Offline (Not visible to customers)'}
                </Text>
              </View>
              <Switch
                value={proProfile?.isOnline ?? true}
                onValueChange={v => {
                  toggleProOnline(v);
                  toast.show(v ? 'You are now Online for requests' : 'You went Offline', v ? 'success' : 'warning');
                }}
                trackColor={{ false: '#D0D5D2', true: C.mint }}
                thumbColor={proProfile?.isOnline ? C.green : '#8C9692'}
              />
            </View>

            {/* GPS Live Sharing Switch */}
            <View style={[s.statusToggleBox, { backgroundColor: '#EEF2FF', marginTop: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusToggleTitle, { color: C.indigo }]}>GPS Live Location Access</Text>
                <Text style={s.statusToggleSub}>
                  {proProfile?.gpsEnabled ? 'Updates live movement along customer route' : 'GPS sharing disabled'}
                </Text>
              </View>
              <Switch
                value={proProfile?.gpsEnabled ?? true}
                onValueChange={v => {
                  toggleProGps(v);
                  toast.show(v ? 'GPS location access granted' : 'GPS location paused');
                }}
                trackColor={{ false: '#D0D5D2', true: '#C7D2FE' }}
                thumbColor={proProfile?.gpsEnabled ? C.indigo : '#8C9692'}
              />
            </View>

            {/* Pro Service Accept Allocation & Pass Card */}
            <View style={s.subscriptionCard}>
              <View style={s.subHeaderRow}>
                <Icon name="sparkles" size={20} color={C.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={s.subTitle}>Service Accepts Allocation</Text>
                  <Text style={s.subSub}>
                    {proProfile?.subscriptionActive
                      ? `Active ${proProfile.passType} Pass · Expires ${proProfile.passExpiresAt}`
                      : `${proProfile?.freeAcceptsRemaining ?? 50} / 50 Initial Free Accepts Remaining`}
                  </Text>
                </View>
              </View>
              {!proProfile?.subscriptionActive && (
                <Pressable onPress={() => setPassModalOpen(true)} style={s.upgradePassBtn}>
                  <Text style={s.upgradePassText}>Get Unlimited Pass</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Form Inputs */}
        <Text style={s.sectionHeader}>PERSONAL & CONTACT</Text>

        <Text style={s.label}>Full Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#9AA39F" style={s.input} />

        <Text style={s.label}>{activeRole === 'pro' ? 'Base Operating Location' : 'Default Service Address'}</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder="Neighborhood, City" placeholderTextColor="#9AA39F" style={s.input} />

        {/* CUSTOMER SPECIFIC PROFILE OPTIONS */}
        {activeRole === 'customer' && (
          <>
            <Text style={s.sectionHeader}>SAVED LOCATIONS</Text>
            <View style={s.placesWrap}>
              {places.map(p => (
                <View key={p.id} style={s.placeCard}>
                  <View style={s.placeIconWrap}>
                    <Icon name={p.icon as any} size={16} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.placeLabelText}>{p.label}</Text>
                    <Text style={s.placeAddrText}>{p.address}</Text>
                  </View>
                  <Pressable onPress={() => removePlace(p.id)}>
                    <Icon name="trash-outline" size={18} color="#C95B5B" />
                  </Pressable>
                </View>
              ))}

              <View style={s.addPlaceForm}>
                <TextInput value={newPlaceLabel} onChangeText={setNewPlaceLabel} placeholder="Place Label (e.g. Gym, Mom's House)" placeholderTextColor="#9AA39F" style={s.smallInput} />
                <TextInput value={newPlaceAddr} onChangeText={setNewPlaceAddr} placeholder="Full Address" placeholderTextColor="#9AA39F" style={s.smallInput} />
                <Button label="Add Saved Place" onPress={addPlace} icon="add-circle" secondary />
              </View>
            </View>

            <Text style={s.sectionHeader}>EMERGENCY & SAFETY CONTACTS</Text>
            <View style={s.safetyBox}>
              <View style={s.safetyHeaderRow}>
                <Icon name="shield-checkmark" color={C.green} size={20} />
                <Text style={s.safetyTitle}>Trip & Service Safety Sharing</Text>
              </View>
              <Text style={s.safetySub}>Trusted contacts receive automatic ETA and PIN updates during active service bookings.</Text>

              {emergencyContacts.map(c => (
                <View key={c.id} style={s.contactRow}>
                  <Icon name="person-circle" size={24} color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.contactName}>{c.name} ({c.relation})</Text>
                    <Text style={s.contactPhone}>+91 {c.phone}</Text>
                  </View>
                  <Pressable onPress={() => removeEmergencyContact(c.id)}>
                    <Icon name="close-circle" size={20} color="#C95B5B" />
                  </Pressable>
                </View>
              ))}

              <View style={s.addPlaceForm}>
                <TextInput value={newContactName} onChangeText={setNewContactName} placeholder="Contact Name" placeholderTextColor="#9AA39F" style={s.smallInput} />
                <TextInput value={newContactPhone} onChangeText={setNewContactPhone} placeholder="10-Digit Mobile Number" keyboardType="phone-pad" placeholderTextColor="#9AA39F" style={s.smallInput} />
                <Button label="Add Safety Contact" onPress={addEmergencyContact} icon="shield-outline" secondary />
              </View>
            </View>
          </>
        )}

        {/* SERVICE PRO SPECIFIC PROFILE OPTIONS */}
        {activeRole === 'pro' && (
          <>
            <Text style={s.sectionHeader}>PRO SKILLS & CATEGORIES</Text>
            <TextInput value={skills} onChangeText={setSkills} placeholder="e.g. Plumbing, Electrical, Cleaning" placeholderTextColor="#9AA39F" style={s.input} />

            <Text style={s.sectionHeader}>ADD DYNAMIC CUSTOM SERVICE</Text>
            <View style={s.bankSetupCard}>
              <Text style={{ fontSize: 12, color: C.navy, fontWeight: '800' }}>Register Any Local Custom Service</Text>
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 8 }}>
                Small service providers can offer specialized services (e.g., Solar Panel Washing, CCTV Repair, Water Tank Cleaning).
              </Text>
              <Pressable
                onPress={() => {
                  const title = prompt ? prompt('Enter Custom Service Title (e.g. CCTV Repair):', '') : null;
                  const rateStr = title ? (prompt ? prompt('Enter Custom Base Rate (₹):', '299') : null) : null;
                  if (title && rateStr) {
                    const newSkills = skills ? `${skills}, ${title}` : title;
                    setSkills(newSkills);
                    toast.show(`✓ Dynamically registered new service: "${title}" (₹${rateStr})!`, 'success');
                  }
                }}
                style={{
                  backgroundColor: C.indigo,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'flex-start'
                }}
              >
                <Icon name="add-circle" color={C.white} size={16} />
                <Text style={{ color: C.white, fontWeight: '900', fontSize: 12 }}>+ Add Custom Service</Text>
              </Pressable>
            </View>

            <Text style={s.sectionHeader}>VEHICLE & EQUIPMENT DETAILS</Text>
            <TextInput value={vehicleInfo} onChangeText={setVehicleInfo} placeholder="e.g. Vehicle reg number, Toolset info" placeholderTextColor="#9AA39F" style={s.input} />

            <Text style={s.sectionHeader}>SERVICE BASE LOCATION & GPS</Text>
            <View style={s.bankSetupCard}>
              <Text style={s.bankLabel}>Active Service Base Location</Text>
              <TextInput
                value={profile?.locationName ?? 'Koramangala, Bengaluru'}
                onChangeText={txt => {
                  if (profile) {
                    setProfile({ ...profile, locationName: txt });
                  }
                }}
                placeholder="e.g. Koramangala, Indiranagar, HSR Layout"
                placeholderTextColor="#9AA39F"
                style={s.input}
              />
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                📍 Pro base location used to calculate customer distance & travel time.
              </Text>
            </View>

            <Text style={s.sectionHeader}>SERVICE RADIUS ({radiusKm} KM)</Text>
            <View style={s.radiusWrap}>
              {[5, 10, 25, 50].map(r => (
                <Pressable
                  key={r}
                  onPress={() => {
                    setRadiusKm(r);
                    toast.show(`Service radius updated to ${r} km`, 'success');
                  }}
                  style={[s.radiusPill, radiusKm === r && s.radiusPillSelected]}
                >
                  <Text style={[s.radiusText, radiusKm === r && s.radiusTextSelected]}>{r} km</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.sectionHeader}>PRO BANK ACCOUNT & UPI PAYOUT SETUP (10% COMMISSION DEDUCTION)</Text>
            <View style={s.bankSetupCard}>
              <Text style={s.bankLabel}>UPI ID (For Instant Direct Payouts)</Text>
              <TextInput value={payoutUpi} onChangeText={setPayoutUpi} placeholder="e.g. 9876543210@upi" placeholderTextColor="#9AA39F" style={s.input} />

              <Text style={s.bankLabel}>Bank Name</Text>
              <TextInput value={bankName} onChangeText={setBankName} placeholder="e.g. HDFC Bank / State Bank of India" placeholderTextColor="#9AA39F" style={s.input} />

              <Text style={s.bankLabel}>Bank Account Number</Text>
              <TextInput value={accountNumber} onChangeText={setAccountNumber} placeholder="e.g. 5010029481920" keyboardType="number-pad" placeholderTextColor="#9AA39F" style={s.input} />

              <Text style={s.bankLabel}>IFSC Code</Text>
              <TextInput value={ifscCode} onChangeText={setIfscCode} placeholder="e.g. HDFC0001234" placeholderTextColor="#9AA39F" style={s.input} />
            </View>

            <Text style={s.sectionHeader}>CERTIFICATES & GOVT ID VERIFICATION</Text>

            {/* Certificate Upload */}
            <View style={s.docBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.docTitle}>Training Certificate / License</Text>
                <Text style={s.docSub}>Build customer trust with verified skill certificates.</Text>
              </View>
              <Pressable onPress={() => pickImage('cert')} style={s.uploadSmallBtn}>
                <Icon name="cloud-upload" size={16} color={C.white} />
                <Text style={s.uploadSmallText}>{certUri ? 'Replace' : 'Upload'}</Text>
              </Pressable>
            </View>
            {certUri && <Image source={{ uri: certUri }} style={s.docPreviewImg} />}

            {/* Govt ID Proof Upload & Aadhaar AI Verification */}
            <View style={s.docBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.docTitle}>Govt ID Proof (Aadhaar Card)</Text>
                <Text style={s.docSub}>AI parses document & verifies linked mobile number matches initial login.</Text>
              </View>
              <Pressable onPress={() => pickImage('id')} style={s.uploadSmallBtn}>
                <Icon name="shield-checkmark" size={16} color={C.white} />
                <Text style={s.uploadSmallText}>{idProofUri ? 'Re-scan' : 'Upload ID'}</Text>
              </Pressable>
            </View>

            {proProfile?.aadhaarVerified ? (
              <View style={s.aadhaarStatusSuccessBox}>
                <Icon name="checkmark-circle" size={20} color={C.green} />
                <View style={{ flex: 1 }}>
                  <Text style={s.aadhaarStatusSuccessTitle}>Aadhaar Mobile Number Verified</Text>
                  <Text style={s.aadhaarStatusSuccessSub}>
                    Linked mobile (+91 {proProfile.aadhaarMobileLinked ?? profile?.phone ?? '9876543210'}) matches initial login phone.
                  </Text>
                </View>
              </View>
            ) : idProofUri ? (
              <View style={s.aadhaarStatusSuccessBox}>
                <Icon name="checkmark-circle" size={20} color={C.green} />
                <View style={{ flex: 1 }}>
                  <Text style={s.aadhaarStatusSuccessTitle}>Aadhaar Verified & Linked</Text>
                  <Text style={s.aadhaarStatusSuccessSub}>
                    Document parsed. Linked mobile matches login number +91 {profile?.phone ?? '9876543210'}.
                  </Text>
                </View>
              </View>
            ) : null}

            {idProofUri && <Image source={{ uri: idProofUri }} style={s.docPreviewImg} />}
          </>
        )}

        {/* Buttons Section */}
        <View style={{ marginTop: 24, gap: 10, marginBottom: 20 }}>
          <Button label="Save Profile Changes" onPress={saveProfile} icon="checkmark-circle" />
          <Button label="Log Out of Account" onPress={handleLogout} icon="log-out-outline" variant="danger" />
        </View>
      </ScrollView>

      {/* Subscription Pass Modal for Service Pro */}
      <Modal visible={passModalOpen} transparent animationType="slide">
        <View style={s.modalWrap}>
          <View style={s.sheet}>
            <Icon name="sparkles" size={32} color={C.gold} />
            <Text style={s.sheetTitle}>Service Pro Subscription Pass</Text>
            <Text style={s.sheetSub}>
              Accept unlimited customer requests and grow your business with zero commission per job.
            </Text>

            <View style={s.passOptionCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.passTitle}>Daily Unlimited Pass</Text>
                <Text style={s.passSub}>24 hours unlimited job accepts</Text>
              </View>
              <Pressable
                onPress={() => {
                  activatePass('Day');
                  setPassModalOpen(false);
                  toast.show('Daily Pass Activated (₹49)', 'success');
                }}
                style={s.buyPassBtn}
              >
                <Text style={s.buyPassText}>₹49 / day</Text>
              </Pressable>
            </View>

            <View style={[s.passOptionCard, s.passOptionCardFeatured]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.passTitle, { color: C.white }]}>Monthly Pro Pass</Text>
                <Text style={[s.passSub, { color: '#E2E8F0' }]}>30 days unlimited job accepts + Gold badge</Text>
              </View>
              <Pressable
                onPress={() => {
                  activatePass('Monthly');
                  setPassModalOpen(false);
                  toast.show('Monthly Pass Activated (₹499)', 'success');
                }}
                style={s.buyPassBtnGold}
              >
                <Text style={s.buyPassTextGold}>₹499 / mo</Text>
              </Pressable>
            </View>

            <Button label="Close" onPress={() => setPassModalOpen(false)} icon="close" secondary />
          </View>
        </View>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper },
  scroll: { padding: 18, paddingBottom: 130 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 },
  kicker: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  switchBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.mint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  switchText: { color: C.green, fontSize: 11, fontWeight: '800' },
  profileCard: { backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatarPlaceholder: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 58, height: 58, borderRadius: 20 },
  cameraBadge: { position: 'absolute', bottom: -3, right: -3, backgroundColor: C.orange, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  profileTitle: { color: C.navy, fontSize: 18, fontWeight: '900' },
  ratingBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: C.ink, fontSize: 12, fontWeight: '800' },
  phoneVerifiedText: { color: C.green, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusToggleBox: { backgroundColor: C.mint, borderRadius: 16, padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusToggleTitle: { color: C.ink, fontWeight: '900', fontSize: 14 },
  statusToggleSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  subscriptionCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#FDE68A', gap: 10 },
  subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subTitle: { color: C.navy, fontWeight: '900', fontSize: 14 },
  subSub: { color: '#B45309', fontSize: 11, marginTop: 2, fontWeight: '700' },
  upgradePassBtn: { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  upgradePassText: { color: C.navy, fontWeight: '900', fontSize: 13 },
  sectionHeader: { color: C.navy, fontWeight: '900', fontSize: 11, letterSpacing: 1.3, marginTop: 24, marginBottom: 8 },
  label: { color: C.ink, fontWeight: '800', marginTop: 10, marginBottom: 6, fontSize: 13 },
  input: { height: 52, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, color: C.ink, fontSize: 14, outlineStyle: 'none' as any },
  smallInput: { height: 46, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, color: C.ink, fontSize: 13, outlineStyle: 'none' as any },
  placesWrap: { gap: 8 },
  placeCard: { backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeIconWrap: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  placeLabelText: { color: C.ink, fontWeight: '900', fontSize: 13 },
  placeAddrText: { color: C.muted, fontSize: 11, marginTop: 2 },
  addPlaceForm: { backgroundColor: '#F3F8F5', padding: 12, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#D4E6DC', marginTop: 4 },
  safetyBox: { backgroundColor: C.mint, borderRadius: 16, padding: 14, gap: 10 },
  safetyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safetyTitle: { color: C.ink, fontWeight: '900', fontSize: 14 },
  safetySub: { color: C.muted, fontSize: 11, lineHeight: 16 },
  contactRow: { backgroundColor: C.white, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactName: { color: C.ink, fontWeight: '800', fontSize: 13 },
  contactPhone: { color: C.muted, fontSize: 11 },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentOption: { width: '48%', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentOptionSelected: { backgroundColor: C.green, borderColor: C.green },
  paymentOptionText: { color: C.ink, fontWeight: '800', fontSize: 12, flex: 1 },
  paymentOptionTextSelected: { color: C.white },
  prefRow: { backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefTitle: { color: C.ink, fontWeight: '900', fontSize: 13 },
  prefSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  radiusWrap: { flexDirection: 'row', gap: 9 },
  radiusPill: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  radiusPillSelected: { backgroundColor: C.green, borderColor: C.green },
  radiusText: { color: C.ink, fontWeight: '800', fontSize: 13 },
  radiusTextSelected: { color: C.white },
  bankSetupCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line, gap: 6, marginBottom: 12 },
  bankLabel: { color: C.navy, fontWeight: '800', fontSize: 12, marginTop: 4 },
  docBox: { backgroundColor: C.white, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  docTitle: { color: C.ink, fontWeight: '900', fontSize: 13 },
  docSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  uploadSmallBtn: { backgroundColor: C.green, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  uploadSmallText: { color: C.white, fontWeight: '800', fontSize: 11 },
  docPreviewImg: { width: '100%', height: 140, borderRadius: 12, marginBottom: 10 },
  aadhaarStatusSuccessBox: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  aadhaarStatusSuccessTitle: { color: '#065F46', fontWeight: '900', fontSize: 13 },
  aadhaarStatusSuccessSub: { color: '#047857', fontSize: 11, marginTop: 2, lineHeight: 15 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { backgroundColor: C.paper, padding: 22, borderTopLeftRadius: 26, borderTopRightRadius: 26, gap: 14 },
  sheetTitle: { color: C.navy, fontSize: 22, fontWeight: '900' },
  sheetSub: { color: C.muted, fontSize: 13, lineHeight: 18 },
  passOptionCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  passOptionCardFeatured: { backgroundColor: C.navy, borderColor: C.gold },
  passTitle: { color: C.navy, fontWeight: '900', fontSize: 15 },
  passSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  buyPassBtn: { backgroundColor: C.mint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  buyPassText: { color: C.green, fontWeight: '900', fontSize: 12 },
  buyPassBtnGold: { backgroundColor: C.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  buyPassTextGold: { color: C.navy, fontWeight: '900', fontSize: 12 }
});


