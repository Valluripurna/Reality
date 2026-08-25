import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

export function RealityChainLogo({ size = 'medium', showText = true }: { size?: 'small' | 'medium' | 'large'; showText?: boolean }) {
  const getDimension = () => {
    if (size === 'small') return { box: 34, icon: 18, font: 15 };
    if (size === 'large') return { box: 56, icon: 30, font: 24 };
    return { box: 42, icon: 22, font: 18 };
  };

  const dim = getDimension();

  return (
    <View style={s.container}>
      {/* Static Logo Shield Badge */}
      <View
        style={[
          s.logoBadge,
          {
            width: dim.box,
            height: dim.box,
            borderRadius: dim.box / 2.8
          }
        ]}
      >
        <Icon name="sparkles" color={C.white} size={dim.icon} />
      </View>

      {showText && (
        <View style={{ marginLeft: size === 'small' ? 8 : 10 }}>
          <Text style={[s.logoText, { fontSize: dim.font }]}>
            Reality<Text style={s.logoTextHighlight}>Chain</Text>
          </Text>
          <Text style={s.tagline}>AI ON-DEMAND SERVICES</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.3)'
  },
  logoBadge: {
    backgroundColor: C.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  logoText: {
    fontWeight: '900',
    color: C.navy,
    letterSpacing: -0.5
  },
  logoTextHighlight: {
    color: C.purple
  },
  tagline: {
    fontSize: 9,
    fontWeight: '900',
    color: C.indigo,
    letterSpacing: 1.2,
    marginTop: -2
  }
});
