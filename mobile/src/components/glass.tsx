import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glass, radius, useTheme } from '@/theme/tokens';

/** Surface de verre : réservée aux éléments flottants (navigation, contrôles, panneaux compacts).
 *  Teinte sombre opaque à 72 % sous le flou : le texte reste lisible même si le flou n'est pas disponible. */
export function GlassSurface({ children, style, r = radius.r3, intensity = glass.blur }: { children: ReactNode; style?: StyleProp<ViewStyle>; r?: number; intensity?: number }) {
  const { c } = useTheme();
  const blurOk = Platform.OS === 'ios' || Platform.OS === 'android';
  return (
    <View style={[{ borderRadius: r, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.glassBorder }, style]}>
      {blurOk ? <BlurView intensity={intensity} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass }]} />
      {children}
    </View>
  );
}
