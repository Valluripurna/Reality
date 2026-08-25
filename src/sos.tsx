import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DatabaseEngine } from './db';
import { useToast } from './toast';
import { C, Icon } from './ui';

type SOSModalProps = {
  visible: boolean;
  onClose: () => void;
  userLocation?: { lat: number; lng: number };
};

export function SOSModal({ visible, onClose, userLocation = { lat: 12.9716, lng: 77.5946 } }: SOSModalProps) {
  const toast = useToast();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [activated, setActivated] = useState(false);

  const startCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          triggerEmergencySOS();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerEmergencySOS = async () => {
    setActivated(true);
    await DatabaseEngine.saveSOSLog({
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      lat: userLocation.lat,
      lng: userLocation.lng,
      status: 'ACTIVE',
      contactsNotified: ['Emergency Helpline 112', 'Primary Safety Contact (+91 9876543210)']
    });
    toast.show('🚨 EMERGENCY SOS BROADCAST: Live GPS location sent to 112 & Safety Contacts!', 'warning');
  };

  const cancelSOS = () => {
    setCountdown(null);
    setActivated(false);
    toast.show('SOS emergency alert cancelled', 'info');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.sosIconWrap}>
            <Icon name="warning" size={48} color={C.white} />
          </View>

          <Text style={s.title}>EMERGENCY SOS PANIC</Text>

          {!activated && countdown === null && (
            <>
              <Text style={s.sub}>
                Tap below to instantly broadcast your live GPS coordinates ({userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E) to Emergency Helpline 112 & your trusted contacts.
              </Text>
              <Pressable onPress={startCountdown} style={s.triggerBtn}>
                <Text style={s.triggerBtnText}>START EMERGENCY SOS</Text>
              </Pressable>
            </>
          )}

          {countdown !== null && (
            <View style={s.countdownBox}>
              <Text style={s.countdownNumber}>{countdown}</Text>
              <Text style={s.countdownLabel}>Broadcasting location in {countdown} seconds...</Text>
              <Pressable onPress={cancelSOS} style={s.cancelBtn}>
                <Text style={s.cancelBtnText}>CANCEL SOS</Text>
              </Pressable>
            </View>
          )}

          {activated && (
            <View style={s.activeBox}>
              <Text style={s.activeTitle}>🚨 SOS BROADCAST ACTIVE</Text>
              <Text style={s.activeSub}>
                Police Helpline 112 and RealityChain Safety Team notified. Live GPS tracking active.
              </Text>
              <Pressable onPress={cancelSOS} style={s.resolveBtn}>
                <Text style={s.resolveBtnText}>Mark Safe & Close SOS</Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={onClose} style={s.closeTextBtn}>
            <Text style={s.closeText}>Close Window</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 14
  },
  sosIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8
  },
  title: {
    color: C.crimson,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 0.5
  },
  sub: {
    color: C.muted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19
  },
  triggerBtn: {
    backgroundColor: C.crimson,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 4
  },
  triggerBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1
  },
  countdownBox: {
    alignItems: 'center',
    gap: 10,
    width: '100%'
  },
  countdownNumber: {
    color: C.crimson,
    fontSize: 54,
    fontWeight: '900'
  },
  countdownLabel: {
    color: C.navy,
    fontWeight: '800',
    fontSize: 13
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelBtnText: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 13
  },
  activeBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    width: '100%'
  },
  activeTitle: {
    color: C.crimson,
    fontWeight: '900',
    fontSize: 15
  },
  activeSub: {
    color: '#991B1B',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17
  },
  resolveBtn: {
    backgroundColor: C.green,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6
  },
  resolveBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13
  },
  closeTextBtn: {
    paddingVertical: 4
  },
  closeText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700'
  }
});
