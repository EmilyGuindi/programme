import type React from 'react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { radius, space, useTheme } from '@/theme/tokens';
import { Row, T } from './ui';

/* ============================================================
   Langage graphique BYYND
   — La coupe : l'angle à 36° du symbole devient un coin coupé sur les surfaces « scène ».
   — Les deux voies : deux traits parallèles (l'écart du Y) servent de rail de progression.
   — Le chevron : le bras du Y marque une étape franchie.
   ============================================================ */

const P1 = 'M12 12 L58 46 L58 114 L43 99 L43 54 L12 31 Z';
const P2 = 'M114 12 L68 46 L68 114 L83 99 L83 54 L114 31 Z';

/** BrandedCard — la carte signature BYYND.
 *  Motif : le symbole officiel (tracés du kit), très grand, rogné à droite, opacité 6 % sur sombre, 10 % sur lime.
 *  Usage réservé : séance du jour, course, record, accomplissement de la semaine, temps fort du coach.
 *  Pas de bordure, pas de halo : la profondeur vient du contraste de surface. */
export function Stage({ children, mark = false, tone = 'ink', style, glow }: { children: ReactNode; cut?: number; mark?: boolean; tone?: 'ink' | 'lime' | 'cobalt' | 'plain'; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  const { c } = useTheme(); const [sz, setSz] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSz({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const lime = tone === 'lime' || tone === 'cobalt'; const bg = lime ? c.accent : tone === 'plain' ? c.surface : c.stage;
  // Cadrage : le symbole s'ancre en bas à droite, sa moitié gauche reste hors du bloc de texte principal.
  const scale = Math.min(2.6, Math.max(1.5, sz.h / 95)); const mw = 102 * scale, mh = 102 * scale;
  return (
    <View onLayout={onLayout} style={[{ padding: space.s5, marginBottom: space.s3, borderRadius: radius.r3, overflow: 'hidden', backgroundColor: bg, borderWidth: tone === 'ink' ? StyleSheet.hairlineWidth : 0, borderColor: c.line }, style]}>
      {sz.w > 0 ? <Svg width={sz.w} height={sz.h} style={{ position: 'absolute', left: 0, top: 0 }}>
        {glow && !lime ? <><Defs><RadialGradient id="g" cx="100%" cy="0%" r="80%"><Stop offset="0" stopColor={c.accent} stopOpacity={0.16} /><Stop offset="1" stopColor={c.accent} stopOpacity={0} /></RadialGradient></Defs><Rect width={sz.w} height={sz.h} fill="url(#g)" /></> : null}
        {mark ? <G opacity={lime ? 0.09 : 0.05} transform={`translate(${sz.w - mw * 0.58},${sz.h - mh * 0.82}) scale(${scale})`}><Path d={P1} fill={lime ? '#0B0D0A' : '#F5F7F2'} transform="translate(-12,-12)" /><Path d={P2} fill={lime ? '#0B0D0A' : '#F5F7F2'} transform="translate(-12,-12)" /></G> : null}
      </Svg> : null}
      {children}
    </View>
  );
}
export const BrandedCard = Stage;

/** Surtitre : capitales espacées sur les scènes, micro-label ailleurs. */
export function Kicker({ children, color, onStage }: { children: string; color?: string; onStage?: boolean }) {
  const { c } = useTheme();
  // Capitales espacées seulement sur les scènes ; ailleurs, un micro-label en casse normale.
  return onStage
    ? <T v="eyebrow" color={color || c.stageInk2}>{children}</T>
    : <T v="small" color={color || c.ink2} style={{ fontWeight: '600' }}>{children}</T>;
}

/** Repère d'étape : chevron (bras du Y). Plein = franchi, cobalt = en cours, contour = à venir. */
export function StepMark({ state, size = 22 }: { state: 'done' | 'current' | 'next' | 'revised'; size?: number }) {
  const { c } = useTheme(); const fill = state === 'done' ? c.ink : state === 'current' ? c.accent : 'none'; const stroke = state === 'next' ? c.ink3 : state === 'revised' ? c.warn : fill;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 18l9-7 9 7v-6l-9-7-9 7z" fill={state === 'revised' ? 'none' : fill} stroke={stroke as string} strokeWidth={state === 'next' || state === 'revised' ? 1.8 : 0} strokeLinejoin="round" />
    </Svg>
  );
}

/** Insigne de palier : hexagone coupé + symbole. Atteint = plein et lumineux ; à venir = contour discret. */
export function Badge({ achieved, size = 56, label }: { achieved: boolean; size?: number; label?: string }) {
  const { c } = useTheme(); const s = size;
  const hex = `M${s * 0.5},${s * 0.04} L${s * 0.92},${s * 0.27} V${s * 0.73} L${s * 0.5},${s * 0.96} L${s * 0.08},${s * 0.73} V${s * 0.27} Z`;
  return (
    <Svg width={s} height={s} accessibilityLabel={label}>
      <Path d={hex} fill={achieved ? c.stage : 'none'} stroke={achieved ? c.accent : c.line2} strokeWidth={achieved ? 2 : 1.5} strokeDasharray={achieved ? undefined : '3 4'} />
      <G transform={`translate(${s * 0.27},${s * 0.27}) scale(${(s * 0.46) / 102}) translate(-12,-12)`}>
        <Path d={P1} fill={achieved ? c.stageInk : c.line2} /><Path d={P2} fill={achieved ? c.accent : c.line2} />
      </G>
    </Svg>
  );
}

/** Niveau de confiance d'un insight : 1 à 3 barres, comme un signal. */
export function Confidence({ level }: { level: 'observation' | 'tendance' | 'confirmée' }) {
  const { c } = useTheme(); const n = level === 'confirmée' ? 3 : level === 'tendance' ? 2 : 1;
  return <Row gap={2} style={{ alignItems: 'flex-end' }}>{[0, 1, 2].map(i => <View key={i} style={{ width: 4, height: 6 + i * 4, borderRadius: 1, backgroundColor: i < n ? (n === 3 ? c.ok : c.accent) : c.line2 }} />)}</Row>;
}

/** Compte à rebours : chiffre + arc de graduations (une par jour, 21 jours max). */
export function Countdown({ days, total = 21, size = 132 }: { days: number; total?: number; size?: number }) {
  const { c } = useTheme(); const n = Math.min(total, Math.max(0, days)); const R = size / 2 - 6;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {Array.from({ length: total }, (_, i) => { const a = (-210 + (240 * i) / (total - 1)) * (Math.PI / 180); const cx = size / 2, cy = size / 2; const r1 = R - (i < total - n ? 0 : 6);
          return <Line key={i} x1={cx + Math.cos(a) * (R - 10)} y1={cy + Math.sin(a) * (R - 10)} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={i < total - n ? c.accent : 'rgba(244,242,238,0.25)'} strokeWidth={3} strokeLinecap="round" />; })}
      </Svg>
      <T v="display" color={c.stageInk} style={{ fontSize: 46, lineHeight: 48 }}>{days === 0 ? 'J' : `J-${days}`}</T>
      <T v="overline" color={c.stageInk2}>{days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : 'jours'}</T>
    </View>
  );
}

/** Profil d'effort kilomètre par kilomètre : hauteur = intensité. */
export function EffortProfile({ km, levels }: { km: number; levels: number[] }) {
  const { c } = useTheme(); const mx = Math.max(...levels, 8);
  return (
    <View>
      <Row gap={4} style={{ alignItems: 'flex-end', height: 64 }}>
        {levels.map((l, i) => <View key={i} style={{ flex: 1, height: 14 + (l / mx) * 50, borderRadius: 3, backgroundColor: l >= 8 ? c.accent : l >= 7 ? 'rgba(77,123,255,0.65)' : 'rgba(244,242,238,0.35)' }} />)}
      </Row>
      <Row between style={{ marginTop: 6 }}><T v="xs" color={c.stageInk2}>km 1</T><T v="xs" color={c.stageInk2}>{`km ${km}`}</T></Row>
    </View>
  );
}

/** Anneau de progression compact (checklists). */
export function Ring({ value, size = 44, label }: { value: number; size?: number; label: string }) {
  const { c } = useTheme(); const r = size / 2 - 4; const L = 2 * Math.PI * r; const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line2} strokeWidth={4} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={v >= 1 ? c.ok : c.accent} strokeWidth={4} fill="none" strokeDasharray={`${L * v} ${L}`} strokeLinecap="round" />
      </Svg>
      <T v="xs" style={{ fontWeight: '700' }}>{label}</T>
    </View>
  );
}

/** Les deux voies : double rail vertical (l'écart du Y). */
export function Rail({ done, height }: { done: boolean; height: number | string }) {
  const { c } = useTheme(); const col = done ? c.ink : c.line2;
  return <Row gap={3} style={{ height: height as any }}><View style={{ width: 2, height: '100%', backgroundColor: col }} /><View style={{ width: 2, height: '100%', backgroundColor: done ? c.accent : c.line2 }} /></Row>;
}
export const _r = { Rect, radius };

/* ============================================================
   États BYYND — un seul vocabulaire, identique sur tous les écrans.
   Forme d'abord (lisible sans couleur), couleur ensuite.
   - prévu      : tige vide (le fût du Y)
   - fait       : le symbole plein
   - adapté     : tige à moitié pleine
   - optionnel  : tige en pointillés
   - repos      : trait horizontal
   - course     : carré à coin coupé, cobalt
   - manqué     : tige vide barrée, atténuée (jamais rouge)
   - en attente : tige vide avec point central
   - synchronisé: symbole plein + point cobalt
   ============================================================ */
export type Status = 'planned' | 'done' | 'adapted' | 'optional' | 'rest' | 'race' | 'raceDone' | 'missed' | 'pending' | 'synced' | 'none';
export const STATUS_LABEL: Record<Status, string> = { planned: 'prévu', done: 'fait', adapted: 'adapté', optional: 'optionnel', rest: 'repos', race: 'compétition', raceDone: 'compétition terminée', missed: 'non fait', pending: 'à confirmer', synced: 'synchronisé', none: '' };
export function StatusMark({ status, size = 18, color, onStage }: { status: Status; size?: number; color?: string; onStage?: boolean }) {
  const { c } = useTheme(); const ink = color || (onStage ? c.stageInk : c.ink); const faint = onStage ? c.stageInk2 : c.ink3;
  const w = size, h = size * 1.2;
  const stem = (extra: any = {}) => <Rect x={w * 0.36} y={h * 0.1} width={w * 0.28} height={h * 0.8} rx={w * 0.14} fill="none" stroke={ink} strokeWidth={1.6} {...extra} />;
  const mark = (fill: string) => <G transform={`translate(${w * 0.05},${h * 0.12}) scale(${(w * 0.9) / 102}) translate(-12,-12)`}><Path d={P1} fill={fill} /><Path d={P2} fill={fill} /></G>;
  let body: React.ReactNode = null;
  if (status === 'planned') body = stem();
  else if (status === 'optional') body = stem({ strokeDasharray: '2.2 2.2', stroke: faint });
  else if (status === 'done') body = mark(ink);
  else if (status === 'synced') body = <>{mark(ink)}<Circle cx={w * 0.9} cy={h * 0.12} r={w * 0.13} fill={c.accent} /></>;
  else if (status === 'adapted') body = <>{stem()}<Rect x={w * 0.36} y={h * 0.5} width={w * 0.28} height={h * 0.4} rx={w * 0.14} fill={c.warn} /></>;
  else if (status === 'rest') body = <Rect x={w * 0.2} y={h * 0.46} width={w * 0.6} height={2} rx={1} fill={faint} />;
  else if (status === 'race') { const s = w * 0.7, x = (w - s) / 2, y = (h - s) / 2, k = s * 0.32; body = <Path d={`M${x},${y} H${x + s - k} L${x + s},${y + k} V${y + s} H${x} Z`} fill={c.accent} />; }
  else if (status === 'missed') body = <>{stem({ stroke: faint })}<Line x1={w * 0.2} y1={h * 0.8} x2={w * 0.8} y2={h * 0.2} stroke={faint} strokeWidth={1.4} strokeLinecap="round" /></>;
  else if (status === 'pending') body = <>{stem()}<Circle cx={w / 2} cy={h / 2} r={w * 0.07} fill={c.accent} /></>;
  return <Svg width={w} height={h} accessibilityLabel={STATUS_LABEL[status]}>{body}</Svg>;
}


/** Pastille de métrique en verre (durée, kcal, allure…), posée sur une carte signature. */
export function MetricPill({ icon, label, onLime }: { icon?: React.ReactNode; label: string; onLime?: boolean }) {
  const { c } = useTheme();
  return (
    <Row gap={6} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: onLime ? 'rgba(11,13,10,0.12)' : 'rgba(245,247,242,0.08)', borderWidth: 0.5, borderColor: onLime ? 'rgba(11,13,10,0.18)' : 'rgba(245,247,242,0.14)' }}>
      {icon}<T v="small" color={onLime ? c.accentInk : c.ink} style={{ fontWeight: '600' }}>{label}</T>
    </Row>
  );
}
