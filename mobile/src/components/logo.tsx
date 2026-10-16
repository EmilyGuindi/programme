import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { brand, font, useTheme } from '@/theme/tokens';
import { WORDMARK_D, WORDMARK_W } from './wordmark-path';

const P1 = 'M12 12 L58 46 L58 114 L43 99 L43 54 L12 31 Z';
const P2 = 'M114 12 L68 46 L68 114 L83 99 L83 54 L114 31 Z';

/** Symbole BYYND : deux trajectoires qui se rejoignent et montent au-delà. */
export function BrandMark({ size = 24, color }: { size?: number; color?: string }) {
  const { c } = useTheme();
  const fill = color || c.accent;
  return (
    <Svg width={size} height={size} viewBox="12 12 102 102" accessibilityLabel="BYYND">
      <Path d={P1} fill={fill} /><Path d={P2} fill={fill} />
    </Svg>
  );
}

/** Icône d'app (carré arrondi bleu, symbole blanc). */
export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="BYYND">
      <Rect width={512} height={512} rx={112} fill={brand.ink} />
      <Path d={P1} fill="#FFFFFF" transform="translate(104,112) scale(2.42)" />
      <Path d={P2} fill="#FFFFFF" transform="translate(104,112) scale(2.42)" />
    </Svg>
  );
}

/** Logo complet : symbole + wordmark vectorisé (identique sur tous les appareils). */
export function Wordmark({ height = 18, tagline = false, onDark = false }: { height?: number; tagline?: boolean; onDark?: boolean }) {
  const { c } = useTheme();
  const sym = height * 1.55, gap = height * 0.55, w = (WORDMARK_W / 100) * height;
  const ink = onDark ? '#FFFFFF' : c.ink;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
        <BrandMark size={sym} color={c.accent} />
        <Svg width={w} height={height} viewBox={`0 0 ${WORDMARK_W} 100`}><Path d={WORDMARK_D} fill={ink} fillRule="evenodd" /></Svg>
      </View>
      {tagline ? <Text style={{ fontFamily: font.regular, fontSize: height * 0.62, letterSpacing: height * 0.22, color: onDark ? 'rgba(255,255,255,.75)' : c.ink2, marginTop: height * 0.35, marginLeft: sym + gap }}>Go beyond.</Text> : null}
    </View>
  );
}
export const Logo = AppMark;
