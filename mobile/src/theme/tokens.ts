import { useColorScheme } from 'react-native';

/** Couleurs de marque, issues du kit BYYND. */
export const brand = { blue: '#0047FF', ink: '#111111', stone: '#EAE8E4', white: '#FFFFFF' };

export type Palette = { [K in 'paper'|'surface'|'surface2'|'ink'|'ink2'|'ink3'|'line'|'line2'|'accent'|'accentInk'|'accentSoft'|'ok'|'warn'|'stop'|'okSoft'|'warnSoft'|'stopSoft'|'stage'|'stageInk'|'stageInk2']: string };
const light: Palette = {
  paper: '#F2F1EE', surface: '#FFFFFF', surface2: brand.stone, ink: brand.ink, ink2: '#5E6066', ink3: '#9A9CA1', line: '#E2E0DB', line2: '#CFCCC6',
  /** « Scène » : fond charcoal réservé aux moments expressifs (compétitions, records, indicateur principal). */
  stage: brand.ink, stageInk: '#F4F2EE', stageInk2: 'rgba(244,242,238,0.62)',
  accent: brand.blue, accentInk: '#FFFFFF', accentSoft: '#E3EAFF',
  ok: '#1F8A5B', warn: '#C7791A', stop: '#C23B4C', okSoft: '#E3F3EA', warnSoft: '#FAEEDD', stopSoft: '#F8E3E6',
};
const dark: Palette = {
  paper: brand.ink, surface: '#1A1B1E', surface2: '#232428', ink: brand.stone, ink2: '#A2A3A8', ink3: '#6E7076', line: '#2B2C31', line2: '#3A3B41',
  stage: '#1E2433', stageInk: '#F4F2EE', stageInk2: 'rgba(244,242,238,0.62)',
  accent: '#4D7BFF', accentInk: '#FFFFFF', accentSoft: '#16224A',
  ok: '#4CC27D', warn: '#E9A23B', stop: '#F06478', okSoft: '#1B2E24', warnSoft: '#33271A', stopSoft: '#36202A',
};

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48 } as const;
export const radius = { r1: 8, r2: 14, pill: 999 } as const;
export const font = {
  regular: 'Archivo_400Regular', black: 'Archivo_900Black', medium: 'Archivo_500Medium', semibold: 'Archivo_600SemiBold', bold: 'Archivo_700Bold',
  condensed: 'ArchivoNarrow_600SemiBold', condensedBold: 'ArchivoNarrow_700Bold',
} as const;
export const size = { xxs: 11, xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 40, mega: 64 } as const;
/** Densités : compact pour plannings et réglages, expressif pour performances et moments forts. */
export const density = { compactRow: 52, expressivePad: 24 } as const;
export const touch = 48;

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === 'dark' ? dark : light, dark: scheme === 'dark' };
}
