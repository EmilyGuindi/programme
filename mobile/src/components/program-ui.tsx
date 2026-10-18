import { View } from 'react-native';
import { DAYS_SHORT } from '@/engine/dates';
import { deloadWeeks, phasesFor, SLOT_LABEL } from '@/engine/generator';
import type { CompareRow, Issue } from '@/engine/programs';
import { specOf, weekPreview } from '@/engine/programs';
import type { ProgramDef, Slot } from '@/engine/types';
import { radius, space, useTheme } from '@/theme/tokens';
import { Row, T } from './ui';

/** Frise des phases : largeur proportionnelle à la durée, semaines allégées marquées. */
export function PhaseStrip({ p }: { p: ProgramDef }) {
  const { c } = useTheme(); const ph = phasesFor(p); const dl = deloadWeeks(p);
  return (
    <View accessible accessibilityLabel={`Phases : ${ph.map(x => `${x.name}, semaines ${x.from} à ${x.to}`).join(' ; ')}`} style={{ marginBottom: space.s4 }}>
      <View style={{ flexDirection: 'row', gap: 3, height: 10 }}>
        {Array.from({ length: p.weeks }, (_, i) => { const w = i + 1; const k = ph.findIndex(x => w >= x.from && w <= x.to);
          return <View key={w} style={{ flex: 1, borderRadius: 3, backgroundColor: dl.includes(w) ? c.surface2 : [c.accent, c.ok, c.warn, c.ink2, c.ink3][k] || c.ink3, opacity: dl.includes(w) ? 1 : 0.9 }} />; })}
      </View>
      <View style={{ marginTop: space.s3, gap: 6 }}>
        {ph.map((x, i) => <Row key={x.n} gap={space.s3} style={{ alignItems: 'flex-start' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: [c.accent, c.ok, c.warn, c.ink2, c.ink3][i] }} />
          <View style={{ flex: 1 }}><T v="label">{`${x.name}, S${x.from}${x.to !== x.from ? `–S${x.to}` : ''}`}</T><T v="small" muted>{x.goal}</T></View>
        </Row>)}
        {dl.length ? <T v="xs" muted>{`Semaines allégées : ${dl.map(w => `S${w}`).join(', ')}.`}</T> : null}
      </View>
    </View>
  );
}

const SLOT_TONE = (c: ReturnType<typeof useTheme>['c'], sl: Slot) => (sl === 'rest' || sl === 'recup' ? c.surface2 : sl === 'run' || sl === 'long' ? c.accentSoft : c.surface);
/** Semaine type (ou semaine n) : un jour par ligne, contenu et séance de course détaillée. */
export function WeekGrid({ p, week }: { p: ProgramDef; week: number }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4, marginBottom: space.s4 }}>
      {weekPreview(p, week).map(d => (
        <Row key={d.dow} gap={space.s3} style={{ backgroundColor: SLOT_TONE(c, d.slot), borderRadius: radius.r1, paddingVertical: 10, paddingHorizontal: space.s3 }}>
          <T v="label" style={{ width: 36 }}>{DAYS_SHORT[d.dow]}</T>
          <View style={{ flex: 1 }}><T>{d.label}</T>{d.detail ? <T v="small" muted>{d.detail}</T> : null}</View>
        </Row>))}
      <T v="xs" muted>Autour d'une compétition, BYYND allège automatiquement la veille et le lendemain.</T>
    </View>
  );
}

export function Issues({ issues }: { issues: Issue[] }) {
  const { c } = useTheme();
  if (!issues.length) return <View style={{ backgroundColor: c.okSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}><T v="label" color={c.ok}>Aucune réserve</T><T v="small">Les règles de sécurité BYYND sont respectées.</T></View>;
  const order = { block: 0, warn: 1, info: 2 } as const;
  return (
    <View style={{ gap: 6, marginBottom: space.s4 }} accessibilityLiveRegion="polite">
      {[...issues].sort((a, b) => order[a.severity] - order[b.severity]).map(i => {
        const col = i.severity === 'block' ? c.stop : i.severity === 'warn' ? c.warn : c.ink2; const bg = i.severity === 'block' ? c.stopSoft : i.severity === 'warn' ? c.warnSoft : c.surface;
        return <View key={i.code} style={{ backgroundColor: bg, borderRadius: radius.r2, padding: space.s3 }}><T v="xs" color={col} style={{ fontWeight: '700' }}>{i.severity === 'block' ? 'À corriger' : i.severity === 'warn' ? 'Réserve' : 'Info'}</T><T v="small">{i.text}</T></View>;
      })}
    </View>
  );
}

export function CompareTable({ rows, a, b }: { rows: CompareRow[]; a: string; b: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, marginBottom: space.s4 }}>
      <Row gap={space.s2} style={{ paddingBottom: 6 }}><View style={{ flex: 1.1 }} /><T v="xs" muted style={{ flex: 1 }} numberOfLines={2}>{a}</T><T v="xs" color={c.accent} style={{ flex: 1, fontWeight: '700' }} numberOfLines={2}>{b}</T></Row>
      {rows.map(r => <Row key={r.label} gap={space.s2} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line, alignItems: 'flex-start' }}>
        <T v="small" muted style={{ flex: 1.1 }}>{r.label}</T><T v="small" style={{ flex: 1 }}>{r.a}</T><T v="small" style={{ flex: 1, fontWeight: r.a !== r.b ? '700' : '400' }}>{r.b}</T>
      </Row>)}
    </View>
  );
}
export const slotOptions: [Slot, string][] = (Object.keys(SLOT_LABEL) as Slot[]).map(k => [k, SLOT_LABEL[k]]);
export const daysSummary = (p: ProgramDef) => specOf(p).days.map((d, i) => `${DAYS_SHORT[i]} ${SLOT_LABEL[d].toLowerCase()}`).join(', ');
