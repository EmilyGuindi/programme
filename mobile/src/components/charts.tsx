import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SText } from 'react-native-svg';
import { fmtShort, mmss, parseISO } from '@/engine/dates';
import type { Measurement } from '@/engine/types';
import { font, useTheme } from '@/theme/tokens';
import { T } from './ui';

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(320);
  return [w, (e) => setW(Math.max(200, e.nativeEvent.layout.width))];
}

export function WeightChart({ ms, trend, goal, start, onSelect, selected, hideTrend }: { ms: Measurement[]; trend: number[]; goal?: number; start: string; onSelect?: (i: number) => void; selected?: number | null; hideTrend?: boolean }) {
  const { c } = useTheme(); const [W, onLayout] = useWidth();
  if (!ms.length) return <T muted style={{ textAlign: 'center', padding: 24 }}>Pas encore de pesée.</T>;
  const H = 200, pl = 34, pr = 12, pt = 16, pb = 26;
  const xs = ms.map(m => parseISO(m.date).getTime()); const x0 = Math.min(...xs, parseISO(start).getTime()), x1 = Math.max(...xs, x0 + 30 * 864e5);
  const ys = ms.map(m => m.weight); const goalIn = goal != null && Math.min(...ys) - goal <= 2.5; const mn = Math.min(...ys, goalIn ? goal! : 999) - 0.8, mx = Math.max(...ys) + 0.8;
  const X = (x: number) => pl + ((W - pl - pr) * (x - x0)) / (x1 - x0), Y = (v: number) => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  const grid: number[] = []; for (let v = Math.ceil(mn); v <= mx; v++) grid.push(v);
  const step = Math.max(1, Math.ceil(grid.length / 5));
  return (
    <View onLayout={onLayout}>
      <Svg width={W} height={H}>
        {grid.filter((_, i) => i % step === 0).map(v => [<Line key={'l' + v} x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={c.line} />, <SText key={'t' + v} x={pl - 4} y={Y(v) + 4} fontSize={10} fontFamily={font.regular} textAnchor="end" fill={c.ink2}>{v}</SText>])}
        {goal != null && !goalIn ? <SText x={W - pr} y={H - pb + 2} fontSize={10} textAnchor="end" fill={c.accent}>{`objectif ${String(goal).replace('.', ',')} kg ↓`}</SText> : null}
        {goal != null && goalIn ? [<Line key="g" x1={pl} x2={W - pr} y1={Y(goal)} y2={Y(goal)} stroke={c.accent} strokeDasharray="4 4" />, <SText key="gt" x={W - pr} y={Y(goal) - 5} fontSize={10} textAnchor="end" fill={c.accent}>{`objectif ${goal}`}</SText>] : null}
        <Polyline points={ms.map((m, i) => `${X(xs[i])},${Y(m.weight)}`).join(' ')} fill="none" stroke={hideTrend ? c.accent : c.ink2} strokeWidth={hideTrend ? 2.5 : 1.5} />
        {hideTrend ? null : <Polyline points={ms.map((_, i) => `${X(xs[i])},${Y(trend[i])}`).join(' ')} fill="none" stroke={c.accent} strokeWidth={3} strokeLinejoin="round" />}
        {ms.map((m, i) => <Circle key={m.id} cx={X(xs[i])} cy={Y(m.weight)} r={selected === i ? 7 : 5} fill={selected === i ? c.accent : c.surface} stroke={c.ink} strokeWidth={1.5} onPress={() => onSelect?.(i)} />)}
        <SText x={pl} y={H - 6} fontSize={10} fill={c.ink2}>{fmtShort(ms[0].date)}</SText>
        <SText x={W - pr} y={H - 6} fontSize={10} textAnchor="end" fill={c.ink2}>{fmtShort(ms[ms.length - 1].date)}</SText>
      </Svg>
    </View>
  );
}

export function BarChart({ labels, values, unit }: { labels: string[]; values: number[]; unit: string }) {
  const { c } = useTheme(); const [W, onLayout] = useWidth();
  const H = 150, pl = 6, pb = 22, pt = 18; const mx = Math.max(...values, 1); const bw = (W - pl * 2) / Math.max(values.length, 1);
  return (
    <View onLayout={onLayout}>
      <Svg width={W} height={H}>
        {values.map((v, i) => { const h = ((H - pt - pb) * v) / mx; return [
          <Rect key={'r' + i} x={pl + i * bw + (bw - Math.min(28, bw - 6)) / 2} y={H - pb - h} width={Math.min(28, Math.max(4, bw - 6))} height={h} rx={4} fill={c.ink} />,
          <SText key={'v' + i} x={pl + i * bw + bw / 2} y={H - pb - h - 4} fontSize={10} textAnchor="middle" fill={c.ink2}>{String(v).replace('.', ',')}</SText>,
          <SText key={'l' + i} x={pl + i * bw + bw / 2} y={H - 6} fontSize={10} textAnchor="middle" fill={c.ink2}>{labels[i]}</SText>]; })}
        <SText x={pl} y={10} fontSize={10} fill={c.ink2}>{unit}</SText>
      </Svg>
    </View>
  );
}

/** Allure dans le temps : plus haut = plus rapide. Repères mesurés pleins, footings en creux, objectif en pointillés. */
export function PaceChart({ refs, easy, goal, start }: { refs: { d: string; p: number }[]; easy: { d: string; p: number }[]; goal: number; start: string }) {
  const { c } = useTheme(); const [W, onLayout] = useWidth();
  const H = 190, pl = 40, pr = 12, pt = 14, pb = 24;
  const all = [...refs, ...easy]; const xs = all.map(p => parseISO(p.d).getTime());
  const x0 = Math.min(...xs, parseISO(start).getTime()), x1 = Math.max(...xs, x0 + 21 * 864e5);
  const ps = [...all.map(p => p.p), goal]; const fast = Math.min(...ps) - 10, slow = Math.max(...ps) + 10;
  const X = (t: number) => pl + ((W - pl - pr) * (t - x0)) / (x1 - x0); const Y = (p: number) => pt + ((H - pt - pb) * (p - fast)) / (slow - fast);
  const ticks = [fast + 10, (fast + slow) / 2, slow - 10];
  const rp = refs.map(p => [X(parseISO(p.d).getTime()), Y(p.p)]);
  return (
    <View onLayout={onLayout}>
      <Svg width={W} height={H}>
        {ticks.map(v => [<Line key={'l' + v} x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={c.line} />, <SText key={'t' + v} x={pl - 5} y={Y(v) + 4} fontSize={10} textAnchor="end" fill={c.ink2}>{mmss(v)}</SText>])}
        <Line x1={pl} x2={W - pr} y1={Y(goal)} y2={Y(goal)} stroke={c.accent} strokeDasharray="4 4" />
        <SText x={W - pr} y={Y(goal) - 5} fontSize={10} textAnchor="end" fill={c.accent}>objectif 5'30</SText>
        {easy.map((p, i) => <Circle key={'e' + i} cx={X(parseISO(p.d).getTime())} cy={Y(p.p)} r={4} fill={c.surface} stroke={c.ink2} strokeWidth={1.5} />)}
        {rp.length > 1 ? <Polyline points={rp.map(p => p.join(',')).join(' ')} fill="none" stroke={c.accent} strokeWidth={2.5} /> : null}
        {rp.map((p, i) => <Circle key={'r' + i} cx={p[0]} cy={p[1]} r={5.5} fill={c.accent} />)}
        <SText x={pl} y={H - 6} fontSize={10} fill={c.ink2}>{fmtShort(start)}</SText>
        <SText x={W - pr} y={H - 6} fontSize={10} textAnchor="end" fill={c.ink2}>{fmtShort(new Date(x1).toISOString().slice(0, 10))}</SText>
      </Svg>
    </View>
  );
}
