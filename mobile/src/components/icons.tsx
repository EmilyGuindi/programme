import type React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/tokens';

/** Icônes linéaires 22 px, trait 1,8 : un seul jeu pour les accès secondaires et les réglages. */
type N = 'calendar' | 'run' | 'body' | 'dumbbell' | 'path' | 'peak' | 'story' | 'target' | 'bell' | 'link' | 'cycle' | 'data' | 'spark';
export function Icon({ name, size = 22, color }: { name: N; size?: number; color?: string }) {
  const { c } = useTheme(); const s = color || c.ink; const p = { stroke: s, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shapes: Record<N, React.ReactElement> = {
    calendar: <><Rect x={3.5} y={5} width={17} height={15} rx={3} {...p} /><Path d="M3.5 10h17M8 3v4M16 3v4" {...p} /><Path d="M8.5 14.5l2 2 4-4" {...p} /></>,
    run: <><Circle cx={4.5} cy={19} r={1.6} fill={s} /><Path d="M7 18c4 0 3.5-6 8-6s3-6 4.5-8" {...p} strokeDasharray="0.1 3.4" /><Path d="M19.5 10V3.5h-0M19.5 4h4" {...p} /></>,
    body: <><Rect x={3} y={6} width={11} height={11} rx={3.5} {...p} /><Circle cx={8.5} cy={11.5} r={2.2} {...p} /><Path d="M14 14.5h7v3.5h-7" {...p} /></>,
    dumbbell: <><Path d="M7 12h10" {...p} /><Rect x={4} y={8} width={3} height={8} rx={1} {...p} /><Rect x={17} y={8} width={3} height={8} rx={1} {...p} /><Path d="M2 10.5v3M22 10.5v3" {...p} /></>,
    path: <><Circle cx={5} cy={19} r={2} {...p} /><Circle cx={13} cy={12} r={2} {...p} /><Circle cx={8} cy={5} r={2} {...p} /><Path d="M6.5 17.5l5-4M12 10.3L9.2 6.6" {...p} strokeDasharray="0.1 2.6" /></>,
    peak: <><Path d="M2.5 20l7-12 4 6 2.5-3 5.5 9z" {...p} /><Path d="M9.5 8V3l4 1.5-4 1.5" {...p} /></>,
    story: <><Rect x={5} y={3} width={14} height={18} rx={3} {...p} /><Path d="M8 7h8M8 7h3" {...p} /><Path d="M8.5 15l2.5-3 2 2 2.5-3.5" {...p} /></>,
    target: <><Circle cx={11} cy={13} r={8} {...p} /><Circle cx={11} cy={13} r={3.5} {...p} /><Path d="M11 13l9-9M16.5 4h3.5v3.5" {...p} /></>,
    bell: <><Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...p} /><Path d="M10 21h4" {...p} /></>,
    link: <><Rect x={2.5} y={8} width={8} height={8} rx={2.5} {...p} /><Rect x={13.5} y={8} width={8} height={8} rx={2.5} {...p} /><Path d="M10.5 12h3" {...p} /></>,
    cycle: <><Path d="M3 19h4v-4h4v-4h4V7h6" {...p} /><Circle cx={21} cy={7} r={1.6} fill={s} /></>,
    data: <><Rect x={4} y={3.5} width={16} height={5} rx={1.8} {...p} /><Rect x={4} y={9.5} width={16} height={5} rx={1.8} {...p} /><Rect x={4} y={15.5} width={16} height={5} rx={1.8} {...p} /></>,
    spark: <><Path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z" {...p} /><Path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" {...p} /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{shapes[name]}</Svg>;
}
