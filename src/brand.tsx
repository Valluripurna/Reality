import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from './ui';

/**
 * The RealityChain mark: a bold "R" whose leg lands on the baseline and rises
 * again as a check — a record, verified.
 *
 * Geometry lives in a 100×100 box and is shared with
 * scripts/generate-brand-assets.js, which rasterises the app icon, adaptive
 * icon, splash and favicon from the very same numbers.
 */
export const MARK = {
  stroke: 10.5,
  rPath: 'M23 75 V25 H42 A13 13 0 0 1 42 51 H23 M36 51 L51 75',
  tickPath: 'M51 75 L77 49'
};

type MarkProps = {
  size?: number;
  /** Draw the mark on an ink tile (app-icon style). */
  tile?: boolean;
  /** Colour of the R. Defaults to white on a tile, ink otherwise. */
  color?: string;
};

export function BrandMark({ size = 40, tile = false, color }: MarkProps) {
  const rColor = color ?? (tile ? C.white : C.ink);
  return (
    <View accessibilityLabel="RealityChain" accessibilityRole="image" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {tile && <Rect x={0} y={0} width={100} height={100} rx={24} fill={C.ink} />}
        <Path
          d={MARK.rPath}
          stroke={rColor}
          strokeWidth={MARK.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          transform={tile ? 'translate(50 50) scale(0.78) translate(-50 -50)' : undefined}
        />
        <Path
          d={MARK.tickPath}
          stroke={C.brandBright}
          strokeWidth={MARK.stroke}
          strokeLinecap="round"
          fill="none"
          transform={tile ? 'translate(50 50) scale(0.78) translate(-50 -50)' : undefined}
        />
      </Svg>
    </View>
  );
}

export function Wordmark({ size = 20, color = C.ink }: { size?: number; color?: string }) {
  return (
    <Text style={[styles.wordmark, { fontSize: size, color }]} accessibilityRole="header">
      RealityChain
    </Text>
  );
}

/** Mark + wordmark lockup used in headers and auth screens. */
export function BrandLockup({ size = 'medium', inverted = false }: { size?: 'small' | 'medium' | 'large'; inverted?: boolean }) {
  const d = size === 'small' ? { mark: 28, text: 17, gap: 8 } : size === 'large' ? { mark: 44, text: 26, gap: 12 } : { mark: 34, text: 20, gap: 10 };
  return (
    <View style={styles.lockup}>
      <BrandMark size={d.mark} tile={!inverted} color={inverted ? C.white : undefined} />
      <View style={{ width: d.gap }} />
      <Wordmark size={d.text} color={inverted ? C.white : C.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontWeight: '700', letterSpacing: -0.6 }
});
