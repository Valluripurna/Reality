import { BrandLockup } from './brand';

/** Backwards-compatible name for the shared RealityChain brand lockup. */
export function RealityChainLogo({ size = 'medium', showText = true }: { size?: 'small' | 'medium' | 'large'; showText?: boolean }) {
  if (!showText) return null;
  return <BrandLockup size={size} />;
}
