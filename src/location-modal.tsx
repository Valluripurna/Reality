import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, Icon } from './ui';

export type LocationPreset = {
  name: string;
  area: string;
  lat: number;
  lng: number;
};

export const locationPresets: LocationPreset[] = [
  { name: 'Koramangala', area: 'Bengaluru South · 560034', lat: 12.9716, lng: 77.5946 },
  { name: 'Indiranagar', area: 'Bengaluru East · 560038', lat: 12.9784, lng: 77.6408 },
  { name: 'HSR Layout', area: 'Bengaluru South · 560102', lat: 12.9121, lng: 77.6445 },
  { name: 'Whitefield', area: 'Bengaluru East · 560066', lat: 12.9698, lng: 77.7499 },
  { name: 'MG Road / Central', area: 'Central Bengaluru · 560001', lat: 12.9756, lng: 77.6066 }
];

type Props = {
  visible: boolean;
  onSelectLocation: (loc: { locationName: string; lat: number; lng: number }) => void;
};

export function LocationPromptModal({ visible, onSelectLocation }: Props) {
  const [customText, setCustomText] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={s.iconBg}>
              <Icon name="location" color={C.green} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Set Service Location</Text>
              <Text style={s.sub}>Required to connect customer & nearby service pros</Text>
            </View>
          </View>

          <View style={s.searchBox}>
            <Icon name="search" color={C.muted} size={18} />
            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="Search area or landmark..."
              placeholderTextColor={C.muted}
              style={s.input}
            />
            {customText.length > 0 && (
              <Pressable
                onPress={() => {
                  onSelectLocation({
                    locationName: `${customText}, Bengaluru`,
                    lat: 12.9716,
                    lng: 77.5946
                  });
                }}
                style={s.applyBtn}
              >
                <Text style={s.applyBtnText}>Set</Text>
              </Pressable>
            )}
          </View>

          <Text style={s.sectionTitle}>POPULAR NEARBY SERVICE HUBS</Text>

          <View style={{ gap: 8 }}>
            {locationPresets.map((loc, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  onSelectLocation({
                    locationName: `${loc.name}, Bengaluru`,
                    lat: loc.lat,
                    lng: loc.lng
                  });
                }}
                style={s.presetCard}
              >
                <View style={s.presetPin}>
                  <Icon name="navigate" color={C.green} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.presetName}>{loc.name}</Text>
                  <Text style={s.presetSub}>{loc.area}</Text>
                </View>
                <Icon name="chevron-forward" color={C.muted} size={18} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    gap: 14
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: C.navy
  },
  sub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    gap: 8
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: C.navy,
    fontWeight: '600'
  },
  applyBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8
  },
  applyBtnText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 12
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: C.muted,
    letterSpacing: 0.6,
    marginTop: 6
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.paper,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12
  },
  presetPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  presetName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.navy
  },
  presetSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 1
  }
});
