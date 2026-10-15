import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { brand, font, useTheme } from '@/theme/tokens';

const P1 = 'M12 12 L58 46 L58 114 L43 99 L43 54 L12 31 Z';
const P2 = 'M114 12 L68 46 L68 114 L83 99 L83 54 L114 31 Z';

/** Symbole BYYND : deux trajectoires qui se rejoignent et montent au-delà. */
export function Symbol({ size = 24, color }: { size?: number; color?: string }) {
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
      <Rect width={512} height={512} rx={112} fill={brand.blue} />
      <Path d={P1} fill="#FFFFFF" transform="translate(104,112) scale(2.42)" />
      <Path d={P2} fill="#FFFFFF" transform="translate(104,112) scale(2.42)" />
    </Svg>
  );
}

/** Logo complet : symbole + wordmark. */
export function Wordmark({ height = 22, mono }: { height?: number; mono?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.42 }}>
      <Symbol size={height * 1.15} color={mono || c.accent} />
      <Text style={{ fontFamily: font.black, fontSize: height, lineHeight: height * 1.15, letterSpacing: -height * 0.05, color: mono || c.ink }}>BYYND</Text>
    </View>
  );
}
export const Logo = AppMark;
