import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

type DispatchModalProps = {
  visible: boolean;
  onDispatchComplete: () => void;
  serviceKind: string;
  estimate: number;
  aiLaborCost?: number;
  aiPartsCost?: number;
  distanceKm?: number;
};

export function DispatchModal({
  visible,
  onDispatchComplete,
  serviceKind,
  estimate,
  aiLaborCost = 180,
  aiPartsCost = 40,
  distanceKm = 2.4
}: DispatchModalProps) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(400);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 60,
        useNativeDriver: true
      }).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true })
        ])
      );
      pulseLoop.start();

      const timer = setTimeout(() => {
        pulseLoop.stop();
        onDispatchComplete();
      }, 3500);

      return () => {
        clearTimeout(timer);
        pulseLoop.stop();
      };
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={s.backdrop}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle Pill */}
          <View style={s.handlePill} />

          {/* Animated Radar Pulse Header */}
          <View style={s.radarContainer}>
            <Animated.View style={[s.radarPulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={s.radarCore}>
              <Icon name="navigate" size={28} color={C.white} />
            </View>
          </View>

          <Text style={s.statusTitle}>MATCHING NEARBY PRO</Text>
          <Text style={s.statusSub}>Searching 14 verified {serviceKind} Service Pros in your area...</Text>

          {/* AI Algorithm Info Card */}
          <View style={s.algoCard}>
            <View style={s.algoHeaderRow}>
              <Icon name="calculator" size={18} color={C.green} />
              <Text style={s.algoTitle}>Live AI Pricing Algorithm</Text>
            </View>

            <View style={s.divider} />

            <View style={s.row}>
              <Text style={s.label}>Base AI Labor ({serviceKind})</Text>
              <Text style={s.val}>₹{aiLaborCost}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>AI Parts & Materials</Text>
              <Text style={s.val}>₹{aiPartsCost}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Distance Travel ({distanceKm} km @ ₹10/km)</Text>
              <Text style={s.val}>+₹{Math.round(distanceKm * 10)}</Text>
            </View>

            <View style={s.divider} />

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Guaranteed Estimate Total</Text>
              <Text style={s.totalVal}>₹{estimate}</Text>
            </View>
          </View>

          {/* Dispatch Progress Steps */}
          <View style={s.stepProgressRow}>
            <View style={[s.stepDot, s.stepActive]} />
            <View style={[s.stepLine, s.stepLineActive]} />
            <View style={[s.stepDot, s.stepActive]} />
            <View style={s.stepLine} />
            <View style={s.stepDot} />
          </View>
          <Text style={s.progressLabel}>Generating Security Arrival PIN & Assigning Route...</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    alignItems: 'center',
    gap: 12
  },
  handlePill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    marginBottom: 6
  },
  radarContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4
  },
  radarPulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.mint,
    borderWidth: 2,
    borderColor: '#A7F3D0'
  },
  radarCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6
  },
  statusTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.8
  },
  statusSub: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center'
  },
  algoCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    gap: 6,
    marginVertical: 4
  },
  algoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  algoTitle: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 14
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    color: C.muted,
    fontSize: 12
  },
  val: {
    color: C.navy,
    fontWeight: '800',
    fontSize: 12
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2
  },
  totalLabel: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 14
  },
  totalVal: {
    color: C.green,
    fontWeight: '900',
    fontSize: 20
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CBD5E1'
  },
  stepActive: {
    backgroundColor: C.green
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: '#CBD5E1'
  },
  stepLineActive: {
    backgroundColor: C.green
  },
  progressLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700'
  }
});
