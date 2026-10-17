import * as Haptics from 'expo-haptics';
import { useCallback, useRef, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Level } from '@/engine/types';
import { font, radius, size, space, touch, useTheme } from '@/theme/tokens';
import Svg, { Path as SvgPath } from 'react-native-svg';

const tap = () => Haptics.selectionAsync().catch(() => {});

/* ---------- Typographie ---------- */
type TV = 'mega' | 'hero' | 'display' | 'title' | 'h2' | 'h3' | 'body' | 'small' | 'xs' | 'label' | 'overline' | 'num';
export function T({ v = 'body', muted, color, style, children, numberOfLines }: { v?: TV; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  const { c } = useTheme();
  const base: Record<TV, TextStyle> = {
    mega: { fontFamily: font.display, fontSize: size.mega, lineHeight: 58, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
    hero: { fontFamily: font.display, fontSize: size.hero, lineHeight: 44, letterSpacing: -1, fontVariant: ['tabular-nums'] },
    display: { fontFamily: font.display, fontSize: 52, lineHeight: 54, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: font.semibold, fontSize: size.xxs, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
    num: { fontFamily: font.display, fontSize: size.xl, lineHeight: 26, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
    title: { fontFamily: font.display, fontSize: size.xxl, lineHeight: 33, letterSpacing: -0.6 },
    h2: { fontFamily: font.displayMedium, fontSize: size.xl, lineHeight: 28, letterSpacing: -0.3 },
    h3: { fontFamily: font.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
    body: { fontFamily: font.regular, fontSize: size.md, lineHeight: 24 },
    small: { fontFamily: font.regular, fontSize: size.sm, lineHeight: 20 },
    xs: { fontFamily: font.regular, fontSize: size.xs, lineHeight: 16 },
    label: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  };
  return <Text numberOfLines={numberOfLines} style={[base[v], { color: color || (muted ? c.ink2 : c.ink) }, style]}>{children}</Text>;
}

/* ---------- Mise en page ---------- */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { c } = useTheme(); const ref = useRef<ScrollView>(null);
  // Chaque fois qu'on revient sur un écran (onglet ou retour), il repart en haut.
  useFocusEffect(useCallback(() => { ref.current?.scrollTo({ y: 0, animated: false }); }, []));
  const inner = <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center', paddingHorizontal: space.s5 - 4, paddingBottom: 132 }}>{children}</View>;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.paper }}>{scroll ? <ScrollView ref={ref} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}</SafeAreaView>;
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
export function Button({ label, onPress, kind = 'secondary', small, disabled, block, style }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse'; small?: boolean; disabled?: boolean; block?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = kind === 'primary' ? c.accent : kind === 'inverse' ? c.stageInk : kind === 'ghost' ? 'transparent' : c.surface;
  const fg = kind === 'primary' ? c.accentInk : kind === 'inverse' ? c.stage : kind === 'ghost' ? c.accent : kind === 'danger' ? c.stop : c.ink;
  const border = kind === 'primary' ? c.accent : kind === 'ghost' || kind === 'inverse' ? 'transparent' : c.line2;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ minHeight: small ? 40 : touch, paddingHorizontal: small ? space.s4 : space.s5, borderRadius: radius.r1, borderWidth: 1, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, block && { alignSelf: 'stretch' }, style]}>
      <Text style={{ fontFamily: font.semibold, fontSize: small ? size.sm : size.md, color: fg }}>{label}</Text>
    </Pressable>
  );
}
export function Tick({ on, onPress, label, sizePx = 36 }: { on: boolean; onPress: () => void; label: string; sizePx?: number }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} hitSlop={8}
      onPress={() => { Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); }}
      style={{ width: sizePx, height: sizePx, borderRadius: sizePx / 2, borderWidth: 2, borderColor: on ? c.ok : c.line2, backgroundColor: on ? c.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Text style={{ color: c.paper, fontFamily: font.bold, fontSize: 16 }}>✓</Text> : null}
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
            style={{ flexGrow: 1, flexBasis: cols ? `${100 / cols - 2}%` : 64, minHeight: cols && cols > 6 ? 44 : touch, borderRadius: radius.r1, borderWidth: 1, borderColor: on ? c.ink : c.line2, backgroundColor: on ? c.ink : c.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: size.md, color: on ? c.paper : c.ink }}>{l}</Text>
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
  return <View style={{ marginBottom: space.s4 }}><Row gap={6} style={{ marginBottom: 6 }}><T v="label">{label}</T>{hint ? <T v="small" muted>{hint}</T> : null}</Row>{children}</View>;
}
export function Input(props: TextInputProps & { big?: boolean }) {
  const { c } = useTheme();
  return <TextInput placeholderTextColor={c.ink2} {...props} style={[{ minHeight: props.big ? 64 : touch, borderWidth: 1, borderColor: c.line2, backgroundColor: c.surface, borderRadius: radius.r1, paddingHorizontal: 14, color: c.ink, fontFamily: props.big ? font.condensed : font.regular, fontSize: props.big ? 36 : size.md }, props.style]} />;
}
export function Stat({ items }: { items: [string, string][] }) {
  const { c } = useTheme();
  return <Row gap={space.s3}>{items.map(([v, l]) => <View key={l} style={{ flex: 1, backgroundColor: c.surface2, borderRadius: radius.r1, padding: space.s3 }}><T v="h2" style={{ fontFamily: font.condensed, fontVariant: ['tabular-nums'] }}>{v}</T><T v="xs" muted>{l}</T></View>)}</Row>;
}
export function KV({ k, v }: { k: string; v: string }) {
  const { c } = useTheme();
  return <Row between style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line }}><T v="small">{k}</T><T v="label" style={{ fontVariant: ['tabular-nums'] }}>{v}</T></Row>;
}

const styles = StyleSheet.create({ card: { borderWidth: 1, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3 } });


/* ---------- Éléments de liste compacts (réglages, plannings, accès secondaires) ---------- */
export function ListGroup({ children, title }: { children: ReactNode; title?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: space.s5, marginTop: space.s2 }}>
      {title ? <T v="small" muted style={{ marginBottom: space.s2, marginLeft: space.s1, fontWeight: '600' }}>{title}</T> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
export function ListRow({ title, sub, left, right, onPress, last, chevron = true }: { title: string; sub?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void; last?: boolean; chevron?: boolean }) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 56, paddingHorizontal: space.s4, paddingVertical: space.s3 }}>
      {left}
      <View style={{ flex: 1 }}><T v="label">{title}</T>{sub ? <T v="small" muted numberOfLines={2}>{sub}</T> : null}</View>
      {right}
      {onPress && chevron ? <Chevron /> : null}
    </View>
  );
  return (
    <View>
      {onPress ? <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : 'transparent' })}>{body}</Pressable> : body}
      {!last ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: left ? 56 : space.s4, marginRight: space.s4 }} /> : null}
    </View>
  );
}
/** Interrupteur cohérent pour tous les réglages. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} hitSlop={10} onPress={() => { tap(); onChange(!value); }}
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
  return <Pressable accessibilityRole="button" accessibilityLabel={`Retour : ${label}`} hitSlop={12} onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}><T v="h3" color={c.accent} style={{ lineHeight: 22 }}>‹</T><T v="label" color={c.accent}>{label}</T></Pressable>;
}

/** Chevron de navigation BYYND : fin, à l'angle du logo. */
export function Chevron({ color, size = 14, open }: { color?: string; size?: number; open?: boolean }) {
  const { c } = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 14 14" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><SvgPath d="M5 2.5L9.5 7 5 11.5" stroke={color || c.ink3} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
