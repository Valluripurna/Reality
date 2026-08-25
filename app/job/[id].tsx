import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Animated, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useMarketplace } from '../../src/marketplace';
import { Button, C, Icon } from '../../src/ui';
import { useToast } from '../../src/toast';
import { BottomNav, TopHeaderBar } from '../../src/navigation';
import { NearbyMap } from '../../src/nearby-map';
import { SwipeButton } from '../../src/swipe-button';
import { PaymentModal } from '../../src/payment';

const stages = ['Assigned', 'On the way', 'In progress', 'Completed'];

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { jobs, advance, rate, profile } = useMarketplace();
  const [pin, setPin] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const job = jobs.find(j => j.id === id);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.09, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true })
      ])
    ).start();
  }, []);

  if (!job) return null;

  const current = stages.indexOf(job.stage);
  const isPro = profile?.role === 'pro';

  const action = () => {
    const ok = advance(job.id, pin);
    if (!ok) {
      Alert.alert('Arrival PIN required', 'Ask the customer for their 4-digit arrival PIN before starting work.');
      toast.show('Valid customer PIN needed to start work', 'warning');
    } else {
      toast.show(`Service status updated by Pro to ${job.stage}`, 'success');
    }
  };

  const handleRate = (rating: number) => {
    rate(job.id, rating);
    toast.show(`Thank you! Submitted ${rating} star rating`, 'success');
  };

  return (
    <SafeAreaView style={s.page}>
      <TopHeaderBar />
      <ScrollView contentContainerStyle={s.content}>
        <Button label="Back to home" onPress={() => router.replace(isPro ? '/pro' : '/')} icon="arrow-back" secondary />

        <Text style={s.kicker}>LIVE SERVICE TRACKING & ROUTE</Text>
        <Text style={s.title}>{job.title}</Text>

        {/* Live Vector Map Route View */}
        <NearbyMap
          height={200}
          activeRoutePro={{
            name: job.proName ?? 'Service Pro',
            distanceKm: job.distanceKm,
            eta: job.eta ?? '8 min'
          }}
        />

        {/* Issue Photo Attachment Preview if available */}
        {job.imageUri && (
          <View style={s.imageCard}>
            <Text style={s.imageCardLabel}>ATTACHED ISSUE PHOTO</Text>
            <Image source={{ uri: job.imageUri }} style={s.issuePhoto} />
          </View>
        )}

        {/* Service Pro details */}
        <View style={s.pro}>
          <Animated.View style={[s.proIcon, { transform: [{ scale: pulse }] }]}>
            <Icon name="construct" color={C.white} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={s.proName}>{job.proName}</Text>
            <Text style={s.proMeta}>Verified {job.kind} Pro · ETA {job.eta}</Text>
          </View>
          <Pressable onPress={() => toast.show(`Calling ${job.proName}...`, 'info')}>
            <Icon name="call" color={C.green} size={22} />
          </Pressable>
        </View>

        {/* Stage Progress */}
        <Text style={s.stageTitle}>{job.stage}</Text>
        <Text style={s.stageText}>
          {job.stage === 'Completed'
            ? 'The work has been verified and closed exclusively by your Service Pro.'
            : 'Every service milestone is timestamped and saved in the persistent database.'}
        </Text>

        <View style={s.progress}>
          {stages.map((stage, i) => (
            <View key={stage} style={{ flex: 1, alignItems: 'center' }}>
              <View style={[s.progressDot, i <= current && s.done]}>
                {i <= current && <Icon name="checkmark" size={14} color={C.white} />}
              </View>
              {i < stages.length - 1 && <View style={[s.progressLine, i < current && s.lineDone]} />}
              <Text style={s.progressText}>{stage}</Text>
            </View>
          ))}
        </View>

        {/* Estimate details */}
        <View style={s.estimate}>
          <Text style={s.estimateLabel}>Transparent Market Price Estimate</Text>
          <Text style={s.estimateCost}>₹{job.estimate}</Text>
          <Text style={s.estimateHint}>Base market rate + distance fee + AI complexity parsing</Text>
        </View>

        {/* Customer Arrival PIN Card */}
        {!isPro && job.stage !== 'Completed' && (
          <View style={s.pinCard}>
            <Text style={s.pinLabel}>YOUR ARRIVAL VERIFICATION PIN</Text>
            <Text style={s.pinCode}>{job.arrivalPin}</Text>
            <Text style={s.pinHint}>Share this code ONLY after your service pro arrives. It verifies work commencement.</Text>
          </View>
        )}

        {/* Completion Receipt Breakdown Card */}
        {job.stage === 'Completed' && (
          <View style={s.receiptCard}>
            <View style={s.receiptHeader}>
              <Icon name="checkmark-circle" size={24} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={s.receiptTitle}>Service Completed & Verified</Text>
                <Text style={s.receiptSub}>Completed by {job.proName}</Text>
              </View>
            </View>
            <View style={s.receiptDivider} />
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Actual Work Duration</Text>
              <Text style={[s.receiptVal, { color: C.indigo }]}>{job.actualDurationFormatted ?? '45 mins'}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Total Amount Paid</Text>
              <Text style={s.receiptVal}>₹{job.estimate}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Payment Method</Text>
              <Text style={[s.receiptVal, { color: C.green }]}>UPI / Wallet</Text>
            </View>
          </View>
        )}

        {/* Rating card */}
        {job.stage === 'Completed' && !isPro && (
          <View style={s.rating}>
            <Text style={s.ratingTitle}>{job.rating ? 'Thanks for your feedback!' : `Rate ${job.proName}'s service`}</Text>
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} onPress={() => handleRate(n)}>
                  <Icon
                    name={n <= (job.rating ?? 0) ? 'star' : 'star-outline'}
                    size={29}
                    color={n <= (job.rating ?? 0) ? '#E6A92D' : '#AEB8B2'}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Action Section - Interactive Swipe-to-Action Slider for Pro */}
        <View style={{ marginTop: 22 }}>
          {job.stage === 'Completed' ? (
            <View style={{ gap: 10 }}>
              <Button
                label={`Pay Total Amount (₹${job.estimate})`}
                onPress={() => setPayModalOpen(true)}
                icon="card"
              />
              <Button
                label="View Event Timeline"
                onPress={() => router.replace(`/event/${job.eventId}`)}
                icon="shield-checkmark"
                secondary
              />
            </View>
          ) : isPro ? (
            <>
              {job.stage === 'On the way' && (
                <TextInput
                  value={pin}
                  onChangeText={setPin}
                  placeholder="Enter 4-digit arrival PIN"
                  placeholderTextColor="#9AA39F"
                  keyboardType="number-pad"
                  maxLength={4}
                  style={s.pinInput}
                />
              )}

              <SwipeButton
                label={
                  job.stage === 'Assigned'
                    ? 'Slide to Start Route'
                    : job.stage === 'On the way'
                    ? 'Slide to Confirm Arrival & PIN'
                    : 'Slide to Complete Job'
                }
                color={job.stage === 'In progress' ? C.crimson : C.green}
                onSwipeComplete={() => {
                  action();
                  if (job.stage === 'Assigned') {
                    toast.show('📢 Push Alert: Pro has started route to customer location!', 'info');
                  } else if (job.stage === 'On the way') {
                    toast.show('📢 Push Alert: Pro has arrived! Customer PIN verified.', 'success');
                  } else {
                    toast.show('📢 Push Alert: Job completed! Receipt generated.', 'success');
                    setPayModalOpen(true);
                  }
                }}
              />
            </>
          ) : (
            <View style={s.wait}>
              <Icon name="time" size={18} color={C.green} />
              <Text style={s.waitText}>Live GPS active. Waiting for updates from {job.proName}...</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* UPI QR Payment Modal with 10% Platform Commission Calculation */}
      <PaymentModal
        visible={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        onSuccess={() => setPayModalOpen(false)}
        totalEstimate={job.estimate}
        proName={job.proName}
      />

      <BottomNav />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper },
  content: { padding: 18, paddingBottom: 130 },
  kicker: { color: C.green, fontWeight: '900', fontSize: 11, letterSpacing: 1.2, marginTop: 16 },
  title: { color: C.navy, fontWeight: '900', fontSize: 26, marginTop: 5 },
  imageCard: { marginTop: 12, backgroundColor: C.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.line },
  imageCardLabel: { color: C.green, fontWeight: '900', fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  issuePhoto: { width: '100%', height: 140, borderRadius: 10 },
  pro: { backgroundColor: C.white, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 13 },
  proIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  proName: { color: C.navy, fontSize: 16, fontWeight: '900' },
  proMeta: { color: C.muted, fontSize: 12, marginTop: 2 },
  stageTitle: { color: C.navy, fontSize: 20, fontWeight: '900', marginTop: 18 },
  stageText: { color: C.muted, lineHeight: 18, marginTop: 4, fontSize: 12 },
  progress: { flexDirection: 'row', marginTop: 18, marginBottom: 18 },
  progressDot: { height: 28, width: 28, backgroundColor: '#DDE5E0', borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  done: { backgroundColor: C.green },
  progressLine: { position: 'absolute', height: 2, backgroundColor: '#DDE5E0', width: '100%', left: '50%', top: 13, zIndex: 1 },
  lineDone: { backgroundColor: C.green },
  progressText: { color: C.muted, textAlign: 'center', fontSize: 10, marginTop: 7, width: 74 },
  estimate: { backgroundColor: C.mint, borderRadius: 16, padding: 14 },
  estimateLabel: { color: C.muted, fontWeight: '700', fontSize: 12 },
  estimateCost: { color: C.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  estimateHint: { color: C.green, fontSize: 12, fontWeight: '700' },
  pinCard: { backgroundColor: '#FFF5D9', borderRadius: 15, padding: 14, marginTop: 12 },
  pinLabel: { color: '#9B6B00', fontWeight: '900', fontSize: 10, letterSpacing: 1.1 },
  pinCode: { color: C.navy, fontSize: 27, fontWeight: '900', letterSpacing: 7, marginTop: 4 },
  pinHint: { color: '#7D682B', fontSize: 11, lineHeight: 16 },
  receiptCard: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 14, gap: 8 },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptTitle: { color: C.navy, fontWeight: '900', fontSize: 15 },
  receiptSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  receiptDivider: { height: 1, backgroundColor: C.line, marginVertical: 4 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { color: C.muted, fontSize: 12 },
  receiptVal: { color: C.navy, fontSize: 12, fontWeight: '800' },
  pinInput: { height: 50, borderRadius: 14, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, paddingHorizontal: 14, marginBottom: 9, color: C.ink, fontWeight: '800', letterSpacing: 5 },
  wait: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 15, minHeight: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  waitText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  rating: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 12 },
  ratingTitle: { color: C.navy, fontWeight: '900', fontSize: 15 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 10 }
});


