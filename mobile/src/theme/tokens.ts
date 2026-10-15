import { useColorScheme } from 'react-native';

/** Couleurs de marque, issues du kit BYYND. */
export const brand = { blue: '#0047FF', ink: '#111111', stone: '#EAE8E4', white: '#FFFFFF' };

export type Palette = { [K in 'paper'|'surface'|'surface2'|'ink'|'ink2'|'line'|'line2'|'accent'|'accentInk'|'accentSoft'|'ok'|'warn'|'stop'|'okSoft'|'warnSoft'|'stopSoft']: string };
const light: Palette = {
  paper: '#F2F1EE', surface: '#FFFFFF', surface2: brand.stone, ink: brand.ink, ink2: '#66686E', line: '#E2E0DB', line2: '#CFCCC6',
  accent: brand.blue, accentInk: '#FFFFFF', accentSoft: '#E3EAFF',
  ok: '#1F8A5B', warn: '#C7791A', stop: '#C23B4C', okSoft: '#E3F3EA', warnSoft: '#FAEEDD', stopSoft: '#F8E3E6',
};
const dark: Palette = {
  paper: brand.ink, surface: '#1A1B1E', surface2: '#232428', ink: brand.stone, ink2: '#A2A3A8', line: '#2B2C31', line2: '#3A3B41',
  accent: '#4D7BFF', accentInk: '#FFFFFF', accentSoft: '#16224A',
  ok: '#4CC27D', warn: '#E9A23B', stop: '#F06478', okSoft: '#1B2E24', warnSoft: '#33271A', stopSoft: '#36202A',
};

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48 } as const;
export const radius = { r1: 8, r2: 14, pill: 999 } as const;
export const font = {
  regular: 'Archivo_400Regular', black: 'Archivo_900Black', medium: 'Archivo_500Medium', semibold: 'Archivo_600SemiBold', bold: 'Archivo_700Bold',
  condensed: 'ArchivoNarrow_600SemiBold', condensedBold: 'ArchivoNarrow_700Bold',
} as const;
export const size = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 40, mega: 64 } as const;
export const touch = 48;

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === 'dark' ? dark : light, dark: scheme === 'dark' };
}
