import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PlanRow } from '@/components/plan-row';
import { Button, Card, Gap, Row, Screen, T, Tag } from '@/components/ui';
import { adapted, phaseOf, weekOf, weekStart } from '@/engine/coach';
import { addDays, clock, DAYS_SHORT, dow, fmtShort, mmss, today } from '@/engine/dates';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

export default function Program() {
  const s = useApp(); const { c } = useTheme();
  const [w, setW] = useState(Math.min(s.program.weeks, Math.max(1, weekOf(s, today()))));
  const ws = weekStart(s, w); const ph = phaseOf(w);
  const days = Array.from({ length: 7 }, (_, i) => adapted(s, addDays(ws, i)));
  const adj = days.flatMap(a => [a.reason && a.date <= today() ? [a.date, a.reason] : null, a.alt ? [a.date, `Pas de HYROX : ${a.title}`] : null]).filter(Boolean) as [string, string][];
  const evs = s.events.filter(e => e.status !== 'annulé').sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Screen>
      <Row between style={{ paddingTop: space.s4, paddingBottom: space.s3 }}><T v="title">Programme</T><Button small kind="ghost" label="Ajouter une course" onPress={() => router.push('/event')} /></Row>
      <Row between>
        <Button small label="‹" disabled={w <= 1} onPress={() => setW(w - 1)} />
        <View style={{ alignItems: 'center' }}><T v="label">{`Semaine ${w} / ${s.program.weeks}`}</T><T v="xs" muted>{`${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))} · Phase ${ph.n}, ${ph.name}`}</T></View>
        <Button small label="›" disabled={w >= s.program.weeks} onPress={() => setW(w + 1)} />
      </Row>
      <Gap />
      <View style={{ gap: space.s2 }}>{days.map(a => <PlanRow key={a.date} a={a} />)}</View>
      <Gap />
      <Card>
        <T v="h3">Adaptations cette semaine</T>
        {adj.length ? adj.map(([d, t]) => <T key={d + t} v="small" style={{ marginTop: 6 }}>{`${DAYS_SHORT[dow(d)]} · ${t}`}</T>) : <T v="small" muted style={{ marginTop: 6 }}>Semaine telle que prévue.</T>}
      </Card>
      <T v="h3" style={{ marginTop: space.s4, marginBottom: space.s2 }}>Courses et événements</T>
      {evs.map(e => (
        <Pressable key={e.id} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} style={{ backgroundColor: c.accentSoft, borderLeftWidth: 4, borderLeftColor: c.accent, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s2 }}>
          <Row between><T v="label" style={{ flex: 1 }}>{e.name}</T><Tag tone="accent">{e.result ? 'résultat' : e.status}</Tag></Row>
          <T v="small" muted>{[fmtShort(e.date), e.time, e.distanceKm ? `${e.distanceKm} km` : '', e.priority, e.result ? `${clock(e.result.time)}${e.distanceKm ? ` (${mmss(e.result.time / e.distanceKm)}/km)` : ''}` : ''].filter(Boolean).join(' · ')}</T>
        </Pressable>
      ))}
    </Screen>
  );
}
