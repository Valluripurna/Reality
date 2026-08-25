import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from './toast';
import { C, Icon } from './ui';

type PaymentModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  totalEstimate: number;
  proName?: string;
};

export function PaymentModal({ visible, onClose, onSuccess, totalEstimate, proName = 'Service Pro' }: PaymentModalProps) {
  const toast = useToast();
  const [method, setMethod] = useState<'upi_qr' | 'cash'>('upi_qr');

  const commissionFee = Math.round(totalEstimate * 0.10);
  const proPayout = totalEstimate - commissionFee;

  const handlePaySuccess = () => {
    if (method === 'cash') {
      toast.show(`Cash Payment of ₹${totalEstimate} confirmed! 10% commission (₹${commissionFee}) deducted from Pro wallet.`, 'success');
    } else {
      toast.show(`UPI Payment of ₹${totalEstimate} confirmed! 10% commission (₹${commissionFee}) routed to platform.`, 'success');
    }
    onSuccess();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Service Settle & Payment</Text>
              <Text style={s.sub}>Choose payment method to pay {proName}</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={20} color={C.navy} />
            </Pressable>
          </View>

          {/* Amount Box */}
          <View style={s.amountCard}>
            <Text style={s.amountLabel}>TOTAL AMOUNT DUE</Text>
            <Text style={s.amountVal}>₹{totalEstimate}</Text>

            <View style={s.commissionDivider} />

            <View style={s.commissionRow}>
              <Text style={s.commissionLabel}>Pro Net Payout (90%)</Text>
              <Text style={s.commissionVal}>₹{proPayout}</Text>
            </View>
            <View style={s.commissionRow}>
              <Text style={s.commissionLabel}>Platform Commission (10%)</Text>
              <Text style={s.commissionVal}>₹{commissionFee}</Text>
            </View>
          </View>

          {/* Payment Method Selector (Cash or UPI QR) */}
          <View style={s.tabRow}>
            <Pressable onPress={() => setMethod('upi_qr')} style={[s.tab, method === 'upi_qr' && s.activeTab]}>
              <Text style={[s.tabText, method === 'upi_qr' && s.activeTabText]}>📱 Scan UPI QR Code</Text>
            </Pressable>
            <Pressable onPress={() => setMethod('cash')} style={[s.tab, method === 'cash' && s.activeTab]}>
              <Text style={[s.tabText, method === 'cash' && s.activeTabText]}>💵 Pay Cash to Pro</Text>
            </Pressable>
          </View>

          {/* Method Details */}
          {method === 'upi_qr' ? (
            <View style={s.qrBox}>
              <View style={s.qrGraphic}>
                <Icon name="qr-code" size={120} color={C.navy} />
              </View>
              <Text style={s.qrHint}>Scan Pro's QR Code using Google Pay, PhonePe, Paytm, or BHIM</Text>
            </View>
          ) : (
            <View style={s.cashBox}>
              <Icon name="cash" size={38} color={C.green} />
              <Text style={s.cashTitle}>Hand Exact Cash (₹{totalEstimate}) to Service Pro</Text>
              <Text style={s.cashSub}>10% platform commission fee (₹{commissionFee}) will be automatically settled from Pro's wallet balance.</Text>
            </View>
          )}

          {/* Confirm Button */}
          <Pressable onPress={handlePaySuccess} style={s.payBtn}>
            <Icon name="checkmark-circle" color={C.white} size={20} />
            <Text style={s.payBtnText}>
              {method === 'cash' ? `Confirm Cash Settle (₹${totalEstimate})` : `Confirm UPI Payment Received (₹${totalEstimate})`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 14
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 18
  },
  sub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center'
  },
  amountCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  amountLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1
  },
  amountVal: {
    color: C.navy,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2
  },
  commissionDivider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    width: '100%',
    marginVertical: 10
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 2
  },
  commissionLabel: {
    color: C.muted,
    fontSize: 11
  },
  commissionVal: {
    color: C.navy,
    fontWeight: '800',
    fontSize: 11
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6
  },
  tab: {
    flex: 1,
    backgroundColor: C.paper,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line
  },
  activeTab: {
    backgroundColor: C.navy,
    borderColor: C.navy
  },
  tabText: {
    color: C.navy,
    fontWeight: '800',
    fontSize: 11
  },
  activeTabText: {
    color: C.white
  },
  qrBox: {
    alignItems: 'center',
    paddingVertical: 10
  },
  qrGraphic: {
    padding: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    elevation: 3
  },
  qrHint: {
    color: C.muted,
    fontSize: 11,
    marginTop: 8
  },
  cashBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    marginVertical: 6
  },
  cashTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center'
  },
  cashSub: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  },
  upiBox: {
    backgroundColor: C.paper,
    padding: 14,
    borderRadius: 14,
    gap: 6
  },
  upiLabel: {
    color: C.muted,
    fontSize: 11
  },
  upiCopyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line
  },
  upiVal: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 14
  },
  copyBadge: {
    backgroundColor: C.green,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  copyText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 10
  },
  scannerBox: {
    height: 140,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scannerWindow: {
    alignItems: 'center',
    gap: 6
  },
  scannerText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700'
  },
  payBtn: {
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  payBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 14
  }
});
