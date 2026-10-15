import { useColorScheme } from 'react-native';

const light = {
  paper: '#F4F2EE', surface: '#FFFFFF', surface2: '#ECE9E3', ink: '#15161A', ink2: '#6B6E76', line: '#E3E0DA', line2: '#D3CFC7',
  accent: '#2946F0', accentInk: '#FFFFFF', accentSoft: '#E6EAFE',
  ok: '#1F8A5B', warn: '#C7791A', stop: '#C23B4C', okSoft: '#E3F3EA', warnSoft: '#FAEEDD', stopSoft: '#F8E3E6',
};
const dark: typeof light = {
  paper: '#121316', surface: '#1B1D22', surface2: '#23262C', ink: '#F2F1ED', ink2: '#A3A6AE', line: '#2C2F36', line2: '#3A3E47',
  accent: '#7B8CFF', accentInk: '#0F1120', accentSoft: '#242A4A',
  ok: '#4CC27D', warn: '#E9A23B', stop: '#F06478', okSoft: '#1B2E24', warnSoft: '#33271A', stopSoft: '#36202A',
};
export type Palette = typeof light;
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48 } as const;
export const radius = { r1: 8, r2: 14, pill: 999 } as const;
export const font = {
  regular: 'Archivo_400Regular', medium: 'Archivo_500Medium', semibold: 'Archivo_600SemiBold', bold: 'Archivo_700Bold',
  condensed: 'ArchivoNarrow_600SemiBold', condensedBold: 'ArchivoNarrow_700Bold',
} as const;
export const size = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 40, mega: 64 } as const;
export const touch = 48;

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === 'dark' ? dark : light, dark: scheme === 'dark' };
}
