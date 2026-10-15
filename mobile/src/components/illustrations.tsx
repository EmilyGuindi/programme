import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/tokens';

/** Illustrations BYYND : traits épais, angles francs, cobalt sur fond doux. Aucune donnée affichée. */
type P = { size?: number };
function useCols() { const { c } = useTheme(); return { a: c.accent, ink: c.ink, soft: c.accentSoft, bg: c.surface }; }

export function IlluRegularity({ size = 72 }: P) {
  const { a, ink, bg } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Rect x={10} y={14} width={52} height={46} rx={10} fill={bg} stroke={ink} strokeWidth={3} />
      <Path d="M10 28h52" stroke={ink} strokeWidth={3} />
      <Path d="M24 9v10M48 9v10" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      {[[22, 38], [36, 38], [50, 38], [22, 50], [36, 50]].map(([x, y], i) => <Path key={i} d={`M${x - 5} ${y}l3.5 3.5 6.5-7`} stroke={a} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      <Circle cx={50} cy={50} r={3} fill={ink} opacity={0.25} />
    </Svg>
  );
}
export function IlluBody({ size = 72 }: P) {
  const { a, ink, bg } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Rect x={6} y={16} width={34} height={34} rx={10} fill={bg} stroke={ink} strokeWidth={3} />
      <Circle cx={23} cy={33} r={7} fill="none" stroke={ink} strokeWidth={3} />
      <Circle cx={23} cy={33} r={2} fill={ink} />
      <Path d="M40 44h26v10H40" fill={a} />
      {[46, 52, 58, 64].map((x, i) => <Path key={x} d={`M${x} 44v${i % 2 ? 3 : 5}`} stroke={bg} strokeWidth={2} strokeLinecap="round" />)}
    </Svg>
  );
}
export function IlluRun({ size = 72 }: P) {
  const { a, ink } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Circle cx={12} cy={58} r={5} fill={ink} />
      <Path d="M18 56c12-2 10-16 22-18s10 8 16-4" stroke={a} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="0.1 8" />
      <Path d="M56 36V10" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M57 11h12l-4 6 4 6H57z" fill={a} />
    </Svg>
  );
}
export function IlluStrength({ size = 72 }: P) {
  const { a, ink } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Path d="M20 36h32" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <Rect x={10} y={24} width={8} height={24} rx={2.5} fill={a} />
      <Rect x={54} y={24} width={8} height={24} rx={2.5} fill={a} />
      <Rect x={4} y={29} width={6} height={14} rx={2} fill={ink} />
      <Rect x={62} y={29} width={6} height={14} rx={2} fill={ink} />
      <Path d="M30 18l6-6 6 6" stroke={a} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 58l6-6 6 6" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.3} />
    </Svg>
  );
}

export function IlluGoals({ size = 72 }: P) {
  const { a, ink, bg } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Circle cx={32} cy={38} r={24} fill={bg} stroke={ink} strokeWidth={3} />
      <Circle cx={32} cy={38} r={14} fill="none" stroke={ink} strokeWidth={3} />
      <Circle cx={32} cy={38} r={5} fill={a} />
      <Path d="M33 37L60 10" stroke={a} strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M52 8l9 1 1 9" stroke={a} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function IlluConnect({ size = 72 }: P) {
  const { a, ink, bg } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Rect x={6} y={24} width={26} height={24} rx={8} fill={bg} stroke={ink} strokeWidth={3} />
      <Rect x={40} y={24} width={26} height={24} rx={8} fill={a} />
      <Path d="M24 36h24" stroke={ink} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="4 5" />
      <Path d="M47 30l5 6-5 6" stroke={bg} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function IlluBell({ size = 72 }: P) {
  const { a, ink, bg } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Path d="M18 48V34a18 18 0 0 1 36 0v14l5 6H13z" fill={bg} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M30 58a6 6 0 0 0 12 0" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={52} cy={18} r={8} fill={a} />
      <Path d="M36 12v4" stroke={ink} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
export function IlluCycle({ size = 72 }: P) {
  const { a, ink } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Path d="M10 56h12V44h12V32h12V20h16" stroke={ink} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={62} cy={20} r={6} fill={a} />
      <Path d="M10 64h52" stroke={a} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 6" />
    </Svg>
  );
}
export function IlluData({ size = 72 }: P) {
  const { a, ink, bg } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Rect x={14} y={10} width={44} height={14} rx={5} fill={bg} stroke={ink} strokeWidth={3} />
      <Rect x={14} y={29} width={44} height={14} rx={5} fill={bg} stroke={ink} strokeWidth={3} />
      <Rect x={14} y={48} width={44} height={14} rx={5} fill={a} />
      <Circle cx={22} cy={17} r={2.5} fill={ink} /><Circle cx={22} cy={36} r={2.5} fill={ink} /><Circle cx={22} cy={55} r={2.5} fill={bg} />
    </Svg>
  );
}
export function IlluNews({ size = 72 }: P) {
  const { a, ink } = useCols();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Path d="M30 8l5 15 15 5-15 5-5 15-5-15-15-5 15-5z" fill={a} />
      <Path d="M54 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={ink} />
      <Path d="M16 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={ink} opacity={0.4} />
    </Svg>
  );
}
