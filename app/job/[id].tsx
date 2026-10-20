import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatWhen } from '../../src/format';
import { phoneKey, useMarketplace } from '../../src/marketplace';
import { NearbyMap } from '../../src/nearby-map';
import { ScreenHeader, SOSButton } from '../../src/navigation';
import { PaymentModal } from '../../src/payment';
import { SwipeButton } from '../../src/swipe-button';
import { useToast } from '../../src/toast';
import { nextStage, PaymentMethod, ServiceJob } from '../../src/types';
import { Avatar, Badge, Button, C, Card, Divider, EmptyState, Field, Icon, IconButton, KeyValue, radius, rupee, type } from '../../src/ui';

const TRACK = ['Assigned', 'On the way', 'In progress', 'Completed'] as const;

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const market = useMarketplace();
  const { profile, jobs, getJob, syncGlobalJobs } = market;
  const [payOpen, setPayOpen] = useState(false);

  const job = useMemo(() => getJob(String(id ?? '')), [getJob, id, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quotes and stage changes arrive from other phones; poll while open.
  useEffect(() => {
    let alive = true;
    const tick = () => alive && syncGlobalJobs().catch(() => {});
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPro = profile?.role === 'pro';
  const home = isPro ? '/pro' : '/bookings';

  if (!job) {
    return (
      <View style={s.page}>
        <ScreenHeader title="Booking" fallback={home} />
        <EmptyState
          icon="document-outline"
          title="Booking not found"
          body="It may have been removed, or it belongs to another account. Bookings are only visible to the people on them."
          action="Go back"
          onAction={() => router.replace(home as any)}
        />
      </View>
    );
  }

  const mineAsPro = isPro && phoneKey(job.proPhone) === phoneKey(profile?.phone);
  const done = job.stage === 'Completed';
  const cancelled = job.stage === 'Cancelled';
  const tracking = !cancelled && job.stage !== 'Matching';

  return (
    <View style={s.page}>
      <ScreenHeader title={job.kind} fallback={home} right={<View style={{ marginRight: 8 }}><SOSButton /></View>} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StatusBlock job={job} isPro={isPro} />

        {tracking && !done && (
          <View style={{ marginTop: 16 }}>
            <NearbyMap
              height={200}
              center={job.lat != null && job.lng != null ? { lat: job.lat, lng: job.lng } : null}
              activeRoutePro={{
                name: isPro ? 'You' : job.proName ?? 'Pro',
                // A pro sees their own live position; a customer sees the last position the pro's phone reported.
                from: isPro && profile?.liveLat != null && profile?.liveLng != null
                  ? { lat: profile.liveLat, lng: profile.liveLng }
                  : job.proLat != null && job.proLng != null ? { lat: job.proLat, lng: job.proLng } : null
              }}
            />
          </View>
        )}

        {isPro
          ? <ProView job={job} mine={mineAsPro} />
          : <CustomerView job={job} onPay={() => setPayOpen(true)} />}

        <Text style={[type.heading, { marginTop: 28, marginBottom: 10 }]}>Job details</Text>
        <Card style={{ gap: 10 }}>
          <Text style={type.bodyStrong}>{job.title}</Text>
          {job.detail ? <Text style={type.small}>{job.detail}</Text> : null}
          {job.imageUri ? <Image source={{ uri: job.imageUri }} style={s.photo} /> : null}
          <Divider />
          {job.address ? <KeyValue label="Address" value={job.address} /> : null}
          <KeyValue label="Priority" value={job.urgency} />
          <KeyValue label="Posted" value={formatWhen(job.createdAt)} />
          {job.paymentRef ? <KeyValue label="Receipt" value={job.paymentRef} /> : null}
        </Card>

        {!isPro && (
          <Button label="View full record" icon="document-text-outline" variant="ghost" onPress={() => router.push(`/event/${job.eventId}`)} style={{ marginTop: 12 }} />
        )}
      </ScrollView>

      <PaymentModal
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        totalEstimate={job.estimate}
        proName={job.proName}
        proUpi={job.proUpi}
        onSuccess={method => {
          market.markPaid(job.id, (method as PaymentMethod) ?? 'UPI');
          setPayOpen(false);
          toast.show('Payment recorded. Receipt saved to your record.', 'success');
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------- status */

function StatusBlock({ job, isPro }: { job: ServiceJob; isPro: boolean }) {
  const idx = TRACK.indexOf(job.stage as (typeof TRACK)[number]);
  const who = job.proName ?? 'Your pro';
  const quotes = job.bids?.length ?? 0;
  const [title, body] = (() => {
    switch (job.stage) {
      case 'Matching': return isPro
        ? ['New request', `${job.customerName ?? 'A customer'} needs help. Send your price${job.budget ? ` or accept their ₹${job.budget}` : ''}.`]
        : [quotes ? `${quotes} quote${quotes > 1 ? 's' : ''} received` : 'Finding pros near you', quotes ? 'Compare and accept a price you both agree on. Nothing is charged yet.' : 'Pros nearby are reviewing your request and will send their own price. This page updates on its own.'];
      case 'Assigned': return [isPro ? 'You got the job' : `${who} accepted`, isPro ? 'Start your route when you leave.' : `${who} will head over shortly.`];
      case 'On the way': return [isPro ? 'On your way' : `${who} is on the way`, isPro ? 'Ask the customer for their 4-digit PIN when you arrive.' : 'Share your PIN only once they are at your door.'];
      case 'In progress': return ['Work in progress', isPro ? 'Swipe to finish once the job is done.' : 'The PIN was confirmed and the clock is running.'];
      case 'Completed': return ['Job complete', job.paidAt ? `Paid ${rupee(job.estimate)}${job.actualDurationFormatted ? ` · took ${job.actualDurationFormatted}` : ''}` : isPro ? 'Waiting for the customer to pay.' : 'Pay your pro to close the booking.'];
      case 'Cancelled': return ['Booking cancelled', job.cancelledAt ? `Cancelled ${formatWhen(job.cancelledAt)}` : 'This booking was cancelled.'];
    }
  })();

  return (
    <View style={{ paddingTop: 16 }}>
      <Text style={type.display}>{title}</Text>
      <Text style={[type.small, { marginTop: 6 }]}>{body}</Text>
      {job.stage !== 'Matching' && job.stage !== 'Cancelled' && (
        <View style={s.track}>
          {TRACK.map((step, i) => (
            <View key={step} style={{ flex: 1 }}>
              <View style={[s.trackBar, i <= idx && { backgroundColor: i === idx && job.stage !== 'Completed' ? C.ink : C.brand }]} />
              <Text style={[s.trackLabel, i <= idx && { color: C.ink, fontWeight: '600' }]} numberOfLines={1}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------- customer */

function CustomerView({ job, onPay }: { job: ServiceJob; onPay: () => void }) {
  const toast = useToast();
  const { acceptProBid, declineProBid, cancelJob, rate } = useMarketplace();
  const canCancel = job.stage === 'Matching' || job.stage === 'Assigned';

  const confirmCancel = () => {
    const doIt = () => {
      const res = cancelJob(job.id);
      toast.show(res.ok ? 'Booking cancelled' : res.reason ?? 'Could not cancel', res.ok ? 'info' : 'warning');
    };
    if (Platform.OS === 'web') return doIt();
    Alert.alert('Cancel this booking?', job.proName ? `${job.proName} will be told the job is off.` : 'Pros will stop seeing your request.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: doIt }
    ]);
  };

  return (
    <>
      {job.stage === 'Matching' && (
        <View style={{ marginTop: 20, gap: 10 }}>
          {(job.bids ?? []).length === 0 ? (
            <Card style={s.waiting}>
              <View style={s.pulse}><Icon name="hourglass-outline" size={20} color={C.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>Waiting for quotes</Text>
                <Text style={type.small}>
                  Pros will send their own price. {job.budget ? `You suggested ₹${job.budget}.` : 'You can agree on it together — the PIN is created only then.'}
                </Text>
              </View>
            </Card>
          ) : (
            [...(job.bids ?? [])].sort((a, b) => a.bidAmount - b.bidAmount).map((bid, i) => (
              <Card key={bid.proPhone} style={{ gap: 12 }}>
                <View style={s.rowCenter}>
                  <Avatar name={bid.proName} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={s.rowCenter}>
                      <Text style={type.bodyStrong}>{bid.proName}</Text>
                      {i === 0 && (job.bids?.length ?? 0) > 1 ? <Badge label="Lowest" tone="brand" /> : null}
                    </View>
                    <Text style={type.small} numberOfLines={2}>{bid.note}</Text>
                  </View>
                  <Text style={type.title}>{rupee(bid.bidAmount)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    label="Decline"
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => { declineProBid(job.id, bid.proPhone); toast.show('Quote declined', 'info'); }}
                  />
                  <Button
                    testID={`accept-${bid.proPhone}`}
                    label="Accept"
                    variant="brand"
                    size="md"
                    style={{ flex: 1.4 }}
                    onPress={() => {
                      const ok = acceptProBid(job.id, bid.proPhone, bid.proName, bid.bidAmount);
                      toast.show(ok ? `${bid.proName} is booked. Your PIN is ready.` : 'That quote is no longer available.', ok ? 'success' : 'warning');
                    }}
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      )}

      {['Assigned', 'On the way', 'In progress'].includes(job.stage) && job.estimate > 0 && (
        <AgreedPrice amount={job.estimate} />
      )}

      {job.proName && job.stage !== 'Matching' && job.stage !== 'Cancelled' && (
        <PersonCard name={job.proName} role="Your pro" phone={job.proPhone} />
      )}

      {(job.stage === 'Assigned' || job.stage === 'On the way') && job.arrivalPin && (
        <View style={s.pin}>
          <Text style={s.pinLabel}>Arrival PIN</Text>
          <View style={s.pinDigits}>
            {job.arrivalPin.split('').map((d, i) => <View key={i} style={s.pinCell}><Text style={s.pinDigit}>{d}</Text></View>)}
          </View>
          <Text style={s.pinHint}>Give this to {job.proName ?? 'your pro'} only when they're with you. It starts the job.</Text>
        </View>
      )}

      {job.stage === 'Completed' && (
        <Card style={{ marginTop: 16, gap: 4 }}>
          <KeyValue label="Agreed price" value={rupee(job.estimate)} strong />
          {job.actualDurationFormatted ? <KeyValue label="Time on job" value={job.actualDurationFormatted} /> : null}
          <KeyValue label="Payment" value={job.paidAt ? `${job.paymentMethod} · ${formatWhen(job.paidAt)}` : 'Due'} />
          {!job.paidAt && <Button testID="pay-button" label={`Pay ${rupee(job.estimate)}`} onPress={onPay} style={{ marginTop: 12 }} />}
        </Card>
      )}

      {job.stage === 'Completed' && job.paidAt && (
        <Card style={{ marginTop: 12 }}>
          <Text style={type.bodyStrong}>{job.rating ? 'Thanks for rating' : `How was ${job.proName ?? 'the service'}?`}</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => { rate(job.id, n); toast.show('Thanks for the feedback', 'success'); }} accessibilityRole="button" accessibilityLabel={`${n} stars`} hitSlop={6}>
                <Icon name={n <= (job.rating ?? 0) ? 'star' : 'star-outline'} size={32} color={n <= (job.rating ?? 0) ? C.amber : C.lineStrong} />
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {canCancel && (
        <Button label="Cancel booking" variant="ghost" onPress={confirmCancel} style={{ marginTop: 12 }} />
      )}
    </>
  );
}

/* ------------------------------------------------------------- pro */

function ProView({ job, mine }: { job: ServiceJob; mine: boolean }) {
  const toast = useToast();
  const { profile, submitProBid, acceptBudget, advance } = useMarketplace();
  const myBid = job.bids?.find(b => phoneKey(b.proPhone) === phoneKey(profile?.phone));
  const [amount, setAmount] = useState(String(myBid?.bidAmount ?? job.budget ?? ''));
  const [note, setNote] = useState(myBid?.note ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  if (job.stage === 'Matching') {
    return (
      <Card style={{ marginTop: 20, gap: 12 }}>
        <View style={s.rowCenter}>
          <Text style={[type.heading, { flex: 1 }]}>{myBid ? 'Your quote' : 'Send your price'}</Text>
          {myBid ? <Badge label={`Sent · ${rupee(myBid.bidAmount)}`} tone="brand" /> : null}
        </View>
        {job.budget ? (
          <View style={s.budget}>
            <Icon name="pricetag-outline" size={18} color={C.brandDark} />
            <Text style={[type.small, { flex: 1, color: C.brandDark }]}>
              The customer suggested <Text style={{ fontWeight: '700' }}>{rupee(job.budget)}</Text>. Accept it, or quote your own price.
            </Text>
          </View>
        ) : null}
        {job.budget ? (
          <Button
            testID="accept-budget"
            label={`Accept customer's ${rupee(job.budget)}`}
            variant="brand"
            onPress={() => {
              const res = acceptBudget(job.id);
              toast.show(res.ok ? 'Booked at the agreed price. Ask for the PIN on arrival.' : res.reason ?? 'Could not accept', res.ok ? 'success' : 'warning');
            }}
          />
        ) : null}
            <Field testID="quote-amount" label="Your price" prefix="₹" value={amount} onChangeText={v => setAmount(v.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" hint={job.budget ? 'Or quote a different amount.' : 'Set a fair price for this job.'} />
        <Field label="Message (optional)" value={note} onChangeText={setNote} placeholder="e.g. Can come in 30 mins, parts included" maxLength={140} />
        {profile?.role === 'pro' && !profile.payoutUpi ? (
          <Text style={[type.caption, { color: C.muted }]}>
            Add your UPI ID under Account → Payouts so the customer can scan and pay you. Cash works too.
          </Text>
        ) : null}
        <Button
          testID="send-quote"
          label={myBid ? 'Update quote' : 'Send quote'}
          variant={job.budget ? 'secondary' : 'brand'}
          onPress={() => {
            const res = submitProBid(job.id, Number(amount), note);
            toast.show(res.ok ? 'Quote sent. The customer can see it now.' : res.reason ?? 'Could not send quote', res.ok ? 'success' : 'warning');
          }}
        />
      </Card>
    );
  }

  if (!mine) {
    return <Card style={{ marginTop: 20 }}><Text style={type.small}>This job went to another pro.</Text></Card>;
  }

  const label = job.stage === 'Assigned' ? 'Swipe to start route' : job.stage === 'On the way' ? 'Swipe to start work' : 'Swipe to finish job';
  const go = () => {
    if (job.stage === 'On the way' && pin.length !== 4) {
      toast.show("Enter the customer's 4-digit PIN first.", 'warning');
      return;
    }
    setBusy(true);
    const target = nextStage(job.stage);
    const ok = advance(job.id, pin);
    setBusy(false);
    if (!ok) {
      toast.show(job.stage === 'On the way' ? "That PIN doesn't match. Ask the customer again." : 'Could not update this job.', 'warning');
      return;
    }
    setPin('');
    toast.show(target === 'Completed' ? 'Job finished. The customer will pay you now.' : `Status: ${target}`, 'success');
  };

  return (
    <>
      {job.estimate > 0 && <AgreedPrice amount={job.estimate} />}
      <PersonCard
        name={job.customerName ?? 'Customer'}
        role="Customer"
        phone={job.customerPhone}
        address={job.address}
        destination={job.lat != null && job.lng != null ? { lat: job.lat, lng: job.lng } : null}
      />
      {job.stage !== 'Completed' && job.stage !== 'Cancelled' && (
        <View style={{ marginTop: 16, gap: 12 }}>
          {job.stage === 'On the way' && (
            <Field
              testID="pin-input"
              label="Customer's arrival PIN"
              value={pin}
              onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="• • • •"
              inputStyle={{ letterSpacing: 8, fontSize: 20, fontWeight: '600' }}
            />
          )}
          <SwipeButton label={label} busy={busy} disabled={job.stage === 'On the way' && pin.length !== 4} onSwipeComplete={go} />
        </View>
      )}
      {job.stage === 'Completed' && (
        <Card style={{ marginTop: 16 }}>
          <KeyValue label="Job value" value={rupee(job.estimate)} strong />
          <KeyValue label="Platform fee (10%)" value={`− ${rupee(Math.round(job.estimate * 0.1))}`} />
          <KeyValue label="You earn" value={rupee(job.estimate - Math.round(job.estimate * 0.1))} strong />
          <KeyValue label="Payment" value={job.paidAt ? `Paid by ${job.paymentMethod}` : 'Waiting for customer'} />
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------- shared */

function AgreedPrice({ amount }: { amount: number }) {
  return (
    <Card style={[s.rowCenter, { marginTop: 16 }]}>
      <View style={{ flex: 1 }}>
        <Text style={type.caption}>Agreed price</Text>
        <Text style={type.bodyStrong}>{rupee(amount)}</Text>
      </View>
      <Badge label="Locked in" tone="brand" />
    </Card>
  );
}

function PersonCard({ name, role, phone, address, destination }: { name: string; role: string; phone?: string; address?: string; destination?: { lat: number; lng: number } | null }) {
  const toast = useToast();
  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { toast.show("Couldn't open that on this device.", 'warning'); }
  };
  return (
    <Card style={{ marginTop: 16, gap: 12 }}>
      <View style={s.rowCenter}>
        <Avatar name={name} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>{role}</Text>
          <Text style={type.bodyStrong}>{name}</Text>
        </View>
        {phone ? (
          <>
            <IconButton icon="chatbubble-outline" label={`Message ${name}`} onPress={() => open(`sms:+91${phone}`)} />
            <IconButton icon="call" label={`Call ${name}`} tone="dark" onPress={() => open(`tel:+91${phone}`)} />
          </>
        ) : null}
      </View>
      {address ? (
        <View style={[s.rowCenter, { gap: 8 }]}>
          <Icon name="location-outline" size={16} color={C.muted} />
          <Text style={[type.small, { flex: 1 }]} numberOfLines={2}>{address}</Text>
          {destination ? (
            <Button
              testID="navigate-customer"
              label="Navigate"
              icon="navigate-outline"
              size="md"
              variant="secondary"
              onPress={() => open(`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`)}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  content: { paddingHorizontal: 20 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flexDirection: 'row', gap: 6, marginTop: 18 },
  trackBar: { height: 4, borderRadius: 2, backgroundColor: C.surface2 },
  trackLabel: { fontSize: 11, color: C.faint, marginTop: 6 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderColor: C.surface },
  budget: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.brandSoft, borderRadius: 12, padding: 12 },
  pulse: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  pin: { marginTop: 16, backgroundColor: C.ink, borderRadius: radius.lg, padding: 18 },
  pinLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  pinDigits: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pinCell: { width: 52, height: 60, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  pinDigit: { color: C.white, fontSize: 28, fontWeight: '700' },
  pinHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, marginTop: 12 },
  stars: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photo: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: C.surface }
});

