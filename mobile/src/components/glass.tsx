import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glass, radius, useTheme } from '@/theme/tokens';

/** Surface flottante (navigation, contrôles, action principale fixe) : opaque, élevée par l'ombre, jamais transparente. */
export function GlassSurface({ children, style, r = radius.r3, intensity = glass.blur }: { children: ReactNode; style?: StyleProp<ViewStyle>; r?: number; intensity?: number }) {
  const { c } = useTheme();
  // Décision V4 : surfaces flottantes 100 % opaques. Rien ne doit transparaître derrière un contrôle.
  return (
    <View style={[{ borderRadius: r, backgroundColor: c.nav, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line2, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 }, style]}>
      {children}
    </View>
  );
}
