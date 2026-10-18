/* ============================================================
   BYYND — design tokens
   Direction : dark performance (fond quasi noir, accent lime), profondeur en verre maîtrisée.
   Thème unique sombre : l'identité ne dépend plus du réglage système.
   ============================================================ */

/** Couleurs de marque. Le cobalt reste dans le kit d'origine ; l'app passe au lime.
 *  Usages du lime, et seulement ceux-là : action principale · élément sélectionné · progression importante ·
 *  moment de marque (compétition, cycle) · accomplissement. Jamais pour « fait » ou « récupération OK » :
 *  ces états ont leurs couleurs sémantiques (ok, warn, stop) et une forme qui les distingue sans couleur. */
export const brand = { lime: '#B8F20D', limeMuted: '#91C51A', limeSoft: '#DFFF83', ink: '#0B0D0A', white: '#F5F7F2', cobalt: '#0047FF', stone: '#EAE8E4', blue: '#0047FF' };

export type Palette = { [K in 'paper' | 'paper2' | 'surface' | 'surface2' | 'ink' | 'ink2' | 'ink3' | 'line' | 'line2' | 'accent' | 'accentInk' | 'accentSoft' | 'ok' | 'warn' | 'stop' | 'info' | 'okSoft' | 'warnSoft' | 'stopSoft' | 'stage' | 'stageInk' | 'stageInk2' | 'glass' | 'glassBorder' | 'disabled' | 'stroke' | 'nav' | 'series1' | 'series2' | 'series3' | 'series4']: string };

const dark: Palette = {
  paper: '#0B0D0A', paper2: '#11150F',
  surface: '#171B15', surface2: '#20261D',
  ink: '#F5F7F2', ink2: '#A3AD9D', ink3: '#8C9688', // ink3 ≥ 5:1 sur toutes les surfaces
  line: 'rgba(245,247,242,0.07)', line2: 'rgba(245,247,242,0.14)',
  accent: brand.lime, accentInk: '#0B0D0A', accentSoft: 'rgba(184,242,13,0.12)',
  ok: '#4FD1A1', warn: '#F2B33D', stop: '#FF7A6B', info: '#7AB7FF',
  okSoft: 'rgba(79,209,161,0.14)', warnSoft: 'rgba(242,179,61,0.14)', stopSoft: 'rgba(255,122,107,0.14)',
  stage: '#11150F', stageInk: '#F5F7F2', stageInk2: '#A3AD9D',
  glass: 'rgba(23,27,21,0.72)', glassBorder: 'rgba(245,247,242,0.12)',
  disabled: '#3A4136',
  /** Contours porteurs de sens (jour prévu, champs) : ≥ 3:1 sur les surfaces. */ stroke: '#737D70',
  /** Barre de navigation : opaque, légèrement au-dessus du fond. */ nav: '#161A14',
  series1: brand.lime, series2: '#7AB7FF', series3: '#F2B33D', series4: '#A3AD9D',
};

/** Espacements : base 4, rythme 8. */
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48 } as const;
export const radius = { r1: 12, r2: 20, r3: 24, pill: 999 } as const;
/** Grille de mise en page : une seule source pour les marges et les retraits.
 *  gutter = marge latérale des écrans et des feuilles · pad = retrait intérieur des cartes · padHero = cartes signature
 *  gap = entre deux cartes d'un même groupe · section = entre deux groupes · row = hauteur minimale d'une ligne de liste
 *  icon = colonne d'icône des listes (le texte s'aligne toujours au même retrait) */
export const layout = { gutter: 20, pad: 16, padHero: 20, gap: 12, section: 28, row: 56, icon: 24 } as const;
export const font = {
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
  display: 'InterTight_700Bold', displayHeavy: 'InterTight_800ExtraBold', displayMedium: 'InterTight_600SemiBold',
  // alias historiques
  condensed: 'InterTight_700Bold', condensedBold: 'InterTight_800ExtraBold', black: 'InterTight_800ExtraBold',
} as const;
/** Échelle typographique unique. */
export const size = { xxs: 11, xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 40, mega: 56 } as const;
export const density = { compactRow: 52, expressivePad: 24 } as const;
export const glass = { blur: 24, radius: 24 } as const;
export const motion = { fast: 140, base: 220, slow: 360 } as const;
export const touch = 48;

export function useTheme() { return { c: dark, dark: true }; }
