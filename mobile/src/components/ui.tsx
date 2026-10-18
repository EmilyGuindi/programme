import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { Animated, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { navLayout } from '@/theme/nav-layout';
import { haptic, reducedMotion } from '@/feedback';

/** Mise en page de la barre de navigation pour l'écran courant (largeur, police système, zone système).
 *  Sur le web uniquement, `?fs=1.3` simule une police agrandie (captures de contrôle). */
export function useNavLayout() {
  const { width, fontScale } = useWindowDimensions(); const insets = useSafeAreaInsets();
  const forced = Platform.OS === 'web' && typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('fs')) || 0 : 0;
  return navLayout(width, forced || fontScale, insets.bottom);
}
import type { Level } from '@/engine/types';
import { font, layout, radius, size, space, touch, useTheme } from '@/theme/tokens';
import Svg, { Defs, Path as SvgPath, RadialGradient, Rect as SvgRect, Stop } from 'react-native-svg';

const tap = () => haptic('select');

/* ---------- Typographie ---------- */
type TV = 'mega' | 'hero' | 'display' | 'title' | 'h2' | 'h3' | 'body' | 'small' | 'xs' | 'label' | 'overline' | 'eyebrow' | 'num';
export function T({ v = 'body', muted, color, style, children, numberOfLines, maxFontSizeMultiplier }: { v?: TV; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; maxFontSizeMultiplier?: number }) {
  const { c } = useTheme();
  const base: Record<TV, TextStyle> = {
    mega: { fontFamily: font.display, fontSize: size.mega, lineHeight: 58, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
    hero: { fontFamily: font.display, fontSize: size.hero, lineHeight: 44, letterSpacing: -1, fontVariant: ['tabular-nums'] },
    display: { fontFamily: font.display, fontSize: 52, lineHeight: 54, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
    /** Micro-label : casse normale, lisible. */
    overline: { fontFamily: font.semibold, fontSize: size.xs, lineHeight: 16, letterSpacing: 0.1 },
    /** Capitales espacées : uniquement sur les cartes signature. */
    eyebrow: { fontFamily: font.semibold, fontSize: size.xxs, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
    num: { fontFamily: font.display, fontSize: size.xl, lineHeight: 26, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
    title: { fontFamily: font.display, fontSize: size.xxl, lineHeight: 33, letterSpacing: -0.6 },
    h2: { fontFamily: font.displayMedium, fontSize: size.xl, lineHeight: 28, letterSpacing: -0.3 },
    h3: { fontFamily: font.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
    body: { fontFamily: font.regular, fontSize: size.md, lineHeight: 24 },
    small: { fontFamily: font.regular, fontSize: size.sm, lineHeight: 20 },
    xs: { fontFamily: font.regular, fontSize: size.xs, lineHeight: 16 },
    label: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  };
  return <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={maxFontSizeMultiplier ?? (['mega', 'hero', 'display'].includes(v) ? 1.3 : 1.6)} style={[base[v], { color: color || (muted ? c.ink2 : c.ink) }, style]}>{children}</Text>;
}

/* ---------- Mise en page ---------- */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { c } = useTheme(); const ref = useRef<ScrollView>(null);
  // Chaque fois qu'on revient sur un écran (onglet ou retour), il repart en haut.
  useFocusEffect(useCallback(() => { ref.current?.scrollTo({ y: 0, animated: false }); }, []));
  // Espace sous le contenu = hauteur réelle du socle de navigation (barre + zone système) + respiration : le dernier élément reste toujours atteignable.
  const nav = useNavLayout(); const kb = useKeyboardLift();
  const inner = <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter, paddingBottom: nav.contentInset + kb }}>{children}</View>;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.paper }}><Ambient />{scroll ? <ScrollView ref={ref} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}</SafeAreaView>;
}
export function Row({ children, gap = space.s3, between, style }: { children: ReactNode; gap?: number; between?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}
export const Gap = ({ h = space.s3 }: { h?: number }) => <View style={{ height: h }} />;

export function Card({ children, onPress, tone = 'default', style }: { children: ReactNode; onPress?: () => void; tone?: 'default' | 'ink' | 'flat'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const s: ViewStyle = tone === 'ink' ? { backgroundColor: c.stage, borderColor: c.stage } : tone === 'flat' ? { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: c.line2 } : { backgroundColor: c.surface, borderColor: c.surface };
  const body = <View style={[styles.card, s, style]}>{children}</View>;
  return onPress ? <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>{body}</Pressable> : body;
}

/* ---------- Actions ---------- */
export function Button({ label, onPress, kind = 'secondary', small, disabled, block, style, icon }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse'; small?: boolean; disabled?: boolean; block?: boolean; style?: StyleProp<ViewStyle>; icon?: ReactNode }) {
  const { c } = useTheme();
  const bg = kind === 'primary' ? c.accent : kind === 'inverse' ? c.stageInk : kind === 'ghost' ? 'transparent' : c.surface;
  const fg = kind === 'primary' ? c.accentInk : kind === 'inverse' ? c.stage : kind === 'ghost' ? c.accent : kind === 'danger' ? c.stop : c.ink;
  const border = kind === 'primary' ? c.accent : kind === 'ghost' || kind === 'inverse' ? 'transparent' : c.surface2;
  const tall = kind === 'primary' && !small;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} hitSlop={small ? 6 : 0} disabled={disabled} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ minHeight: small ? 44 : tall ? 56 : touch, paddingHorizontal: small ? space.s4 : space.s5, borderRadius: kind === 'ghost' ? radius.r1 : radius.pill, borderWidth: 1, borderColor: border, backgroundColor: kind === 'secondary' ? c.surface2 : bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, block && { alignSelf: 'stretch' }, style]}>
      {icon}<Text style={{ fontFamily: font.semibold, fontSize: small ? size.sm : tall ? 17 : size.md, color: fg }}>{label}</Text>
    </Pressable>
  );
}
/** Case à cocher BYYND. Animation courte (≈ 250 ms) jouée uniquement au geste de l'utilisateur, jamais au chargement
 *  d'une séance déjà cochée ; supprimée si les animations sont réduites. Retour haptique selon le réglage. */
export function Tick({ on, onPress, label, sizePx = 36 }: { on: boolean; onPress: () => void; label: string; sizePx?: number }) {
  const { c } = useTheme(); const v = useRef(new Animated.Value(1)).current; const ring = useRef(new Animated.Value(0)).current;
  const press = () => {
    haptic(on ? 'untick' : 'tick');
    if (!on && !reducedMotion()) {
      v.setValue(0.82); ring.setValue(0);
      Animated.parallel([Animated.spring(v, { toValue: 1, friction: 5, tension: 260, useNativeDriver: true }), Animated.timing(ring, { toValue: 1, duration: 260, useNativeDriver: true })]).start();
    }
    onPress();
  };
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label} hitSlop={Math.max(6, (48 - sizePx) / 2)} onPress={press}
      style={{ width: sizePx, height: sizePx, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: sizePx, height: sizePx, borderRadius: sizePx / 2, borderWidth: 2, borderColor: c.accent, opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }} />
      <Animated.View style={{ width: sizePx, height: sizePx, borderRadius: sizePx / 2, borderWidth: 2, borderColor: on ? c.accent : c.stroke, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center', transform: [{ scale: v }] }}>
        {on ? <Svg width={sizePx * 0.55} height={sizePx * 0.55} viewBox="0 0 24 24"><SvgPath d="M5 12.5l4.3 4.3L19 7.2" stroke={c.accentInk} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- Statuts ---------- */
export function Pill({ level }: { level: Level }) {
  const { c } = useTheme();
  const m = { vert: [c.ok, c.okSoft, 'Vert'], orange: [c.warn, c.warnSoft, 'Orange'], rouge: [c.stop, c.stopSoft, 'Rouge'], inconnu: [c.ink2, c.surface2, 'Check-in à faire'] }[level];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: m[1], borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m[0] }} />
      <Text style={{ fontFamily: font.semibold, fontSize: size.sm, color: m[0] }}>{m[2]}</Text>
    </View>
  );
}
export function Tag({ children, tone }: { children: ReactNode; tone?: 'accent' | 'inverse' }) {
  const { c } = useTheme();
  const col = tone === 'accent' ? c.accent : tone === 'inverse' ? c.paper : c.ink2;
  return <View style={{ borderWidth: 1, borderColor: tone === 'inverse' ? 'rgba(255,255,255,.3)' : c.line, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, alignSelf: 'flex-start' }}><Text style={{ fontFamily: font.semibold, fontSize: size.xs, color: col }}>{children}</Text></View>;
}
export function Coach({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ borderLeftWidth: 4, borderLeftColor: c.accent, backgroundColor: c.surface, borderTopRightRadius: radius.r2, borderBottomRightRadius: radius.r2, paddingVertical: space.s3, paddingHorizontal: space.s4, marginBottom: space.s3 }}><T>{children}</T></View>;
}

/* ---------- Saisie ---------- */
export function Choices<V extends string | number>({ options, value, onChange, cols }: { options: [V, string][]; value: V | null | undefined; onChange: (v: V | null) => void; cols?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([v, l]) => {
        const on = value === v;
        return (
          <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(on ? null : v); }}
            accessibilityLabel={l}
            style={{ flexGrow: 1, flexBasis: cols ? `${100 / cols - 2}%` : 'auto', minWidth: cols ? undefined : 56, minHeight: cols && cols > 6 ? 44 : touch, borderRadius: radius.r1, borderWidth: on ? 0 : 1, borderColor: c.stroke, backgroundColor: on ? c.ink : c.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: cols && cols > 6 ? 2 : 10, paddingVertical: 4 }}>
            <Text numberOfLines={cols && cols > 6 ? 1 : 2} maxFontSizeMultiplier={1.3} style={{ fontFamily: font.semibold, fontSize: cols && cols > 6 ? size.sm : 15, lineHeight: cols && cols > 6 ? 18 : 19, textAlign: 'center', color: on ? c.paper : c.ink }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function Segmented<V extends string>({ options, value, onChange }: { options: [V, string][]; value: V; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.r1, padding: 3, gap: 3 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return <Pressable key={v} onPress={() => { tap(); onChange(v); }} style={{ flex: 1, minHeight: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent' }}><Text style={{ fontFamily: font.semibold, fontSize: size.sm, color: on ? c.ink : c.ink2 }}>{l}</Text></Pressable>;
      })}
    </View>
  );
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <View style={{ marginBottom: space.s4 }}><View style={{ marginBottom: space.s2 }}><T v="label">{label}</T>{hint ? <T v="small" muted>{hint}</T> : null}</View>{children}</View>;
}
export function Input(props: TextInputProps & { big?: boolean }) {
  const { c } = useTheme();
  return <TextInput placeholderTextColor={c.ink2} {...props} style={[{ minWidth: 0, minHeight: props.big ? 64 : touch, borderWidth: 1, borderColor: c.line2, backgroundColor: c.surface, borderRadius: radius.r1, paddingHorizontal: 14, color: c.ink, fontFamily: props.big ? font.condensed : font.regular, fontSize: props.big ? 36 : size.md }, props.style]} />;
}
export function Stat({ items }: { items: [string, string][] }) {
  const { c } = useTheme();
  return <Row gap={space.s3}>{items.map(([v, l]) => <View key={l} style={{ flex: 1, backgroundColor: c.surface2, borderRadius: radius.r1, padding: space.s3 }}><T v="h2" style={{ fontFamily: font.condensed, fontVariant: ['tabular-nums'] }}>{v}</T><T v="xs" muted>{l}</T></View>)}</Row>;
}
export function KV({ k, v }: { k: string; v: string }) {
  const { c } = useTheme();
  return <Row between style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line }}><T v="small">{k}</T><T v="label" style={{ fontVariant: ['tabular-nums'] }}>{v}</T></Row>;
}

const styles = StyleSheet.create({ card: { borderWidth: 1, borderRadius: radius.r2, padding: layout.pad, marginBottom: layout.gap } });


/* ---------- Éléments de liste compacts (réglages, plannings, accès secondaires) ---------- */
export function ListGroup({ children, title, action, onAction }: { children: ReactNode; title?: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: layout.gap }}>
      {title ? <SectionHeader title={title} action={action} onAction={onAction} /> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/* ---------- Grille et composition ---------- */
/** Titre de section : aligné sur le bord des cartes, même espacement partout (section au-dessus, 8 en dessous). */
export function SectionHeader({ title, action, onAction, first }: { title: string; action?: string; onAction?: () => void; first?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: first ? 0 : layout.section - layout.gap, marginBottom: space.s2, minHeight: 24 }}>
      <T v="label" color={c.ink2} style={{ fontSize: 14, lineHeight: 20 }}>{title}</T>
      {action && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={action} hitSlop={12} onPress={() => { tap(); onAction(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}><T v="small" color={c.accent} style={{ fontWeight: '600' }}>{action}</T><Chevron color={c.accent} size={12} /></Pressable> : null}
    </View>
  );
}
/** Statut court en pastille : remplace « Titre · statut ». Une seule par élément. */
export function Chip({ label, tone = 'neutral', style }: { label: string; tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'stage' | 'lime'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const m = { neutral: [c.surface2, c.ink2], accent: [c.accentSoft, c.accent], ok: [c.okSoft, c.ok], warn: [c.warnSoft, c.warn], stage: ['rgba(245,247,242,0.08)', c.stageInk2], lime: ['rgba(11,13,10,0.12)', c.accentInk] }[tone];
  return <View style={[{ alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: m[0], alignItems: 'center', justifyContent: 'center' }, style]}><Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: size.xs, lineHeight: 16, color: m[1] }}>{label}</Text></View>;
}
/** Métadonnées secondaires : séparées par l'espace, jamais par « · ». Passent à la ligne proprement. */
export function Meta({ items, color, style }: { items: (string | null | false | undefined)[]; color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme(); const xs = items.filter(Boolean) as string[];
  if (!xs.length) return null;
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2 }, style]}>{xs.map(x => <T key={x} v="small" color={color || c.ink2}>{x}</T>)}</View>;
}
/** Carte d'information pressable : retrait, rayon et chevron identiques partout. */
export function Panel({ children, onPress, accessibilityLabel, style, chevron = !!onPress }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; chevron?: boolean }) {
  const { c } = useTheme();
  const body = (pressed = false) => <View style={[{ backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, padding: layout.pad, marginBottom: layout.gap, flexDirection: 'row', alignItems: 'center', gap: space.s3 }, style]}><View style={{ flex: 1 }}>{children}</View>{chevron ? <Chevron /> : null}</View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { tap(); onPress(); }}>{({ pressed }) => body(pressed)}</Pressable> : body();
}
export function ListRow({ title, sub, left, right, onPress, last, chevron = true, leftWidth = layout.icon }: { title: string; sub?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void; last?: boolean; chevron?: boolean; leftWidth?: number }) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: layout.row, paddingHorizontal: layout.pad, paddingVertical: space.s3 }}>
      {left ? <View style={{ width: leftWidth, alignItems: leftWidth > layout.icon ? 'flex-start' : 'center' }}>{left}</View> : null}
      <View style={{ flex: 1 }}><T v="label">{title}</T>{sub ? <T v="small" muted numberOfLines={3}>{sub}</T> : null}</View>
      {right}
      {onPress && chevron ? <Chevron /> : null}
    </View>
  );
  return (
    <View>
      {onPress ? <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : 'transparent' })}>{body}</Pressable> : body}
      {!last ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line2, marginLeft: left ? layout.pad + leftWidth + space.s3 : layout.pad }} /> : null}
    </View>
  );
}
/** Interrupteur cohérent pour tous les réglages. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} hitSlop={12} onPress={() => { tap(); onChange(!value); }}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? c.accent : c.line2, justifyContent: 'center' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? c.accentInk : c.ink, transform: [{ translateX: value ? 20 : 0 }] }} />
    </Pressable>
  );
}
/** Barre de progression fine, segmentée si besoin. */
export function Meter({ value, segments, color, track }: { value: number; segments?: number; color?: string; track?: string }) {
  const { c } = useTheme(); const v = Math.max(0, Math.min(1, value));
  if (segments) return <View style={{ flexDirection: 'row', gap: 3 }}>{Array.from({ length: segments }, (_, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < Math.round(v * segments) ? color || c.accent : track || c.line2 }} />)}</View>;
  return <View style={{ height: 6, borderRadius: 3, backgroundColor: track || c.line2 }}><View style={{ width: `${v * 100}%`, height: 6, borderRadius: 3, backgroundColor: color || c.accent }} /></View>;
}
export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line2, marginLeft: inset }} />;
}

/** Retour discret, cohérent sur tous les écrans de détail. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Retour : ${label}`} hitSlop={12} onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44, opacity: pressed ? 0.6 : 1 })}><View style={{ transform: [{ rotate: '180deg' }] }}><Chevron color={c.accent} size={16} /></View><T v="label" color={c.accent}>{label}</T></Pressable>;
}

/** Chevron de navigation BYYND : fin, à l'angle du logo. */
export function Chevron({ color, size = 14, open }: { color?: string; size?: number; open?: boolean }) {
  const { c } = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 14 14" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><SvgPath d="M5 2.5L9.5 7 5 11.5" stroke={color || c.ink3} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

/** Lumière d'ambiance : un voile vert olive très sombre en haut de l'écran, la seule « atmosphère » de l'app. */
export function Ambient() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420 }}>
      <Svg width="100%" height="100%"><Defs><RadialGradient id="amb" cx="50%" cy="0%" rx="85%" ry="100%"><Stop offset="0" stopColor="#3A5A0C" stopOpacity={0.55} /><Stop offset="0.55" stopColor="#1A260B" stopOpacity={0.35} /><Stop offset="1" stopColor="#0B0D0A" stopOpacity={0} /></RadialGradient></Defs><SvgRect width="100%" height="100%" fill="url(#amb)" /></Svg>
    </View>
  );
}

/** Hauteur dont il faut remonter le contenu quand le clavier est ouvert.
 *  Android affiche l'app bord à bord : la fenêtre ne rétrécit plus, le clavier recouvre le bas de l'écran.
 *  On décale donc la barre d'action d'autant, moins la zone système déjà réservée en bas par SafeAreaView. iOS : géré par KeyboardAvoidingView. */
export function useKeyboardLift() {
  const insets = useSafeAreaInsets(); const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const a = Keyboard.addListener('keyboardDidShow', e => setH(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  return Math.max(0, h - insets.bottom);
}
