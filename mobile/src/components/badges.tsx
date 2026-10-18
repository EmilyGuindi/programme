import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { AchCat, AchStatus } from '@/engine/achievements';
import { useTheme } from '@/theme/tokens';

/* ============================================================
   Insignes BYYND — une famille, cinq silhouettes.
   La silhouette dit la catégorie (lisible sans couleur), le pictogramme précise, l'état se lit au remplissage.
   Géométrie reprise du symbole : coupe à l'angle (compétitions), deux voies parallèles (running), chevron (régularité).
   - verrouillé  : contour pointillé, pictogramme atténué
   - en cours    : contour plein discret
   - atteint     : surface sombre, contour et pictogramme lime
   - majeur      : plein lime + couronne de repères ; seul niveau qui porte le Y BYYND
   ============================================================ */

const SHAPE: Record<AchCat, (p: object) => React.ReactElement> = {
  running: p => <Circle cx={32} cy={32} r={26} {...p} />,
  force: p => <Path d="M32 5.5 55 18.75v26.5L32 58.5 9 45.25v-26.5z" {...p} />,
  competition: p => <Path d="M8 8h37l11 15v33H8z" {...p} />,
  regularite: p => <Path d="M18 7h28l11 11v25c0 5-3 8.5-7.5 10.2L32 59.5l-17.5-6.3C10 51.5 7 48 7 43V18z" {...p} />,
  recuperation: p => <Rect x={7} y={7} width={50} height={50} rx={19} {...p} />,
};
const GLYPH: Record<AchCat, (p: object, fill: string) => React.ReactElement> = {
  running: p => <><Path d="M23.5 45 29 19.5M40.5 45 35 19.5" {...p} /><Path d="M32 41v-3.5M32 31v-3.5" {...p} strokeWidth={2.4} /></>,
  force: (p, f) => <><Path d="M17 32h30" {...p} /><Rect x={20} y={24.5} width={5} height={15} rx={1.6} fill={f} /><Rect x={39} y={24.5} width={5} height={15} rx={1.6} fill={f} /><Path d="M15 28.5v7M49 28.5v7" {...p} /></>,
  competition: (p, f) => <><Path d="M22 47V17" {...p} /><Path d="M22 18h19l-5 7 5 7H22z" {...p} fill={f} /></>,
  regularite: (_p, f) => <>{[19.5, 27.5, 35.5, 43.5].map((x, i) => <Rect key={i} x={x - 2.5} y={22} width={5} height={20} rx={2.5} fill={f} />)}</>,
  recuperation: (p, f) => <Path d="M37.5 19.5a13.5 13.5 0 1 0 7.2 19.8 10.5 10.5 0 0 1-7.2-19.8z" {...p} fill={f} />,
};
const Y1 = 'M12 12 L58 46 L58 114 L43 99 L43 54 L12 31 Z', Y2 = 'M114 12 L68 46 L68 114 L83 99 L83 54 L114 31 Z';

export function AchBadge({ cat, status, major, size = 56, label }: { cat: AchCat; status: AchStatus; major?: boolean; size?: number; label?: string }) {
  const { c } = useTheme();
  const got = status === 'unlocked'; const big = got && !!major;
  const line = got ? (big ? c.accent : c.accent) : status === 'progress' ? c.stroke : c.line2;
  const shapeP = { fill: big ? c.accent : got ? c.surface2 : 'none', stroke: line, strokeWidth: got ? 2 : 1.6, strokeDasharray: status === 'locked' ? '3 3.5' : undefined, strokeLinejoin: 'round' as const };
  const ink = big ? c.accentInk : got ? c.accent : status === 'progress' ? c.ink2 : c.ink3;
  const glyphP = { stroke: ink, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="-8 -8 80 80" accessibilityLabel={label}>
      {big ? <G>{Array.from({ length: 12 }, (_, i) => { const a = (i * 30 - 90) * Math.PI / 180; return <Path key={i} d={`M${32 + Math.cos(a) * 35} ${32 + Math.sin(a) * 35}L${32 + Math.cos(a) * 39} ${32 + Math.sin(a) * 39}`} stroke={c.accent} strokeWidth={2.4} strokeLinecap="round" />; })}</G> : null}
      {SHAPE[cat](shapeP)}
      <G opacity={status === 'locked' ? 0.6 : 1}>{GLYPH[cat](glyphP, ink)}</G>
      {big ? <G transform="translate(27.5 47) scale(0.09) translate(-12 -12)"><Path d={Y1} fill={c.accentInk} /><Path d={Y2} fill={c.accentInk} /></G> : null}
    </Svg>
  );
}
