import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Sheet } from './sheet';
import { useToast } from './toast';
import { Button, C, Divider, Icon, IconName, KeyValue, radius, rupee, type } from './ui';

type Method = 'UPI' | 'Cash after Service';

type PaymentModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Receives the method used, so the job can record it. */
  onSuccess: (method?: string) => void;
  totalEstimate: number;
  proName?: string;
  /** The pro's own UPI ID, captured from their bid / profile. */
  proUpi?: string;
};

/**
 * Records how a finished job was paid. With UPI, the pro's handle becomes a
 * scannable code that opens any UPI app with the amount filled in. Cash is
 * recorded the same way. RealityChain never moves the money itself.
 */
export function PaymentModal({ visible, onClose, onSuccess, totalEstimate, proName = 'your pro', proUpi }: PaymentModalProps) {
  const toast = useToast();
  const [method, setMethod] = useState<Method>('UPI');
  const [paid, setPaid] = useState(false);
  const fee = Math.round(totalEstimate * 0.1);
  const upiId = proUpi?.trim();
  const upiUrl = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(proName)}&am=${totalEstimate}&cu=INR&tn=${encodeURIComponent('RealityChain service')}`
    : '';

  useEffect(() => {
    if (visible) { setPaid(false); setMethod('UPI'); }
  }, [visible]);

  const openUpi = async () => {
    if (!upiUrl) return toast.show(`${proName} hasn't added a UPI ID yet.`, 'warning');
    try {
      if (!(await Linking.canOpenURL(upiUrl))) return toast.show('No UPI app found on this device.', 'warning');
      await Linking.openURL(upiUrl);
    } catch {
      toast.show("Couldn't open a UPI app.", 'warning');
    }
  };

  const confirm = () => {
    if (paid) return;
    setPaid(true);
    onSuccess(method);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Pay ${rupee(totalEstimate)}`} subtitle={`Agreed price for your job with ${proName}`} scroll testID="payment-sheet">
      <View style={{ gap: 10 }}>
        <Option icon="phone-portrait-outline" title="UPI" body="Scan a code or open PhonePe, GPay, Paytm" selected={method === 'UPI'} onPress={() => setMethod('UPI')} />
        <Option icon="cash-outline" title="Cash" body={`Hand ${rupee(totalEstimate)} to ${proName}`} selected={method === 'Cash after Service'} onPress={() => setMethod('Cash after Service')} />
      </View>

      {method === 'UPI' && (
        upiId ? (
          <View style={s.qrCard} testID="upi-qr">
            <View style={s.qr}><QRCode value={upiUrl} size={156} backgroundColor={C.white} color={C.ink} /></View>
            <Text style={[type.bodyStrong, { textAlign: 'center' }]}>Scan to pay {rupee(totalEstimate)}</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>
              Point any UPI app at this code — the amount and {proName} are already filled in.
            </Text>
            <View style={s.upiPill}><Icon name="at-outline" size={14} color={C.muted} /><Text style={[type.caption, { color: C.ink }]} selectable>{upiId}</Text></View>
            <Button testID="open-upi" label="Open in a UPI app" icon="open-outline" variant="secondary" size="md" onPress={openUpi} />
          </View>
        ) : (
          <View style={[s.qrCard, { alignItems: 'center' }]}>
            <Icon name="alert-circle-outline" size={22} color={C.amberDark} />
            <Text style={[type.small, { textAlign: 'center' }]}>
              {proName} hasn&apos;t added a UPI ID yet. Pay in cash, or ask them to add it under Account → Payouts.
            </Text>
          </View>
        )
      )}

      <View>
        <Divider style={{ marginBottom: 8 }} />
        <KeyValue label={`${proName} receives`} value={rupee(totalEstimate - fee)} />
        <KeyValue label="Platform fee" value={rupee(fee)} />
        <KeyValue label="Agreed total" value={rupee(totalEstimate)} strong />
      </View>

      <Button
        testID="confirm-payment"
        label={paid ? 'Payment recorded' : method === 'UPI' ? "I've paid by UPI" : "I've paid in cash"}
        icon={paid ? 'checkmark-circle' : undefined}
        onPress={confirm}
        disabled={paid}
      />
      <Text style={[type.caption, { textAlign: 'center' }]}>We record the payment so you and your pro have the same receipt. We don&apos;t move money ourselves.</Text>
    </Sheet>
  );
}

function Option({ icon, title, body, selected, onPress }: { icon: IconName; title: string; body: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={[s.option, selected && s.optionOn]}>
      <Icon name={icon} size={22} color={C.ink} />
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text style={type.small}>{body}</Text>
      </View>
      <View style={[s.radio, selected && { borderColor: C.ink }]}>{selected && <View style={s.dot} />}</View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.lineStrong },
  optionOn: { borderColor: C.ink, borderWidth: 1.5, backgroundColor: C.surface },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.ink },
  qrCard: { gap: 10, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  qr: { alignSelf: 'center', padding: 12, borderRadius: 12, backgroundColor: C.white },
  upiPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }
});
