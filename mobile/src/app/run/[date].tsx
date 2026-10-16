import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Bullets, Disclosure, MoveList } from '@/components/guide';
import { Sheet } from '@/components/sheet';
import { RPE_SCALE, RUN_COOLDOWN, RUN_TERMS, RUN_WARMUP, ZONE_GUIDE } from '@/engine/guides';
import { Button, Card, Choices, Coach, Field, Gap, Input, KV, Row, T, Tick } from '@/components/ui';
import { adapted, ZONE_NAME, zones, zoneText } from '@/engine/coach';
import { fmtDay, num, parseTime } from '@/engine/dates';
import type { RunLog, Zone } from '@/engine/types';
import { getState, update, useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

export default function RunScreen() {
  const { date } = useLocalSearchParams<{ date: string }>(); const s = useApp(); const { c } = useTheme();
  const a = adapted(s, date); const run = a.replaced ? undefined : a.run; const R: RunLog = s.runs[date] || {};
  const [live, setLive] = useState<number | null>(null);
  const set = (patch: Partial<RunLog>) => update(st => { st.runs[date] = { ...(st.runs[date] || {}), ...patch }; });
  if (!run) return <Sheet title={(a.replaced || a).title} sub={fmtDay(date)}><T>{(a.replaced || a).goal}</T></Sheet>;
  const zs = [...new Set(run.steps.map(x => x.zone).filter(Boolean))] as Zone[];
  function save() {
    const km = num(R.km), min = num(R.min);
    update(st => {
      let act = st.activities.find(x => x.date === date && x.type === 'running' && x.source === 'manuel');
      if (!act) { act = { id: 'run-' + date, date, type: 'running', title: run!.title, source: 'manuel', complementary: false, matched: date }; st.activities.push(act); }
      Object.assign(act, { title: run!.title, durationMin: min, distanceKm: km, elevM: num(R.elev), avgHr: num(R.hr), effort: R.rpe ?? null, kind: run!.kind === 'qualite' ? 'qualite' : run!.kind === 'test' ? 'test' : 'facile' });
      if (run!.kind === 'test') { const t = parseTime(R.test); if (t && t > 900) { if (/10 km/.test(run!.title)) st.user.ref.k10 = t; else st.user.ref.k5 = t; } }
    });
    const act = getState().activities.find(x => x.date === date && x.type === 'running' && x.source === 'manuel');
    if (act && !getState().closures?.[act.id]) router.replace({ pathname: '/done/[id]', params: { id: act.id } }); else router.back();
  }
  return (
    <Sheet title={run.title} sub={`${fmtDay(date)} · ${run.dur}`}>
      {a.reason ? <Coach>{a.reason}</Coach> : null}
      <T><T v="label">Objectif : </T>{run.goal}</T><Gap />
      {zs.length ? <Card><T v="h3">Allures cibles</T>{zs.map(z => <KV key={z} k={ZONE_NAME[z]} v={zoneText(s, z)} />)}<T v="xs" muted style={{ marginTop: 8 }}>{`Depuis ${zones(s).src}. En côte ou par vent, suis l'effort : les répétitions se font sur du plat ou en boucle.`}</T></Card> : null}
      {live != null ? (
        <Card tone="ink">
          <View style={{ alignItems: 'center', gap: space.s3, paddingVertical: space.s4 }}>
            <T v="small" color="rgba(244,242,238,.7)">{`Étape ${live + 1} / ${run.steps.length}`}</T>
            <T v="title" color={c.paper} style={{ textAlign: 'center' }}>{run.steps[live].text}</T>
            {run.steps[live].zone ? <><T v="mega" color={c.paper}>{zoneText(s, run.steps[live].zone!).replace(' /km', '')}</T><T v="small" color="rgba(244,242,238,.7)">{ZONE_NAME[run.steps[live].zone!]}</T></> : null}
          </View>
          <Row>{live > 0 ? <Button kind="inverse" label="Précédente" onPress={() => setLive(live - 1)} /> : null}
            <Button kind="primary" style={{ flex: 1 }} label={live < run.steps.length - 1 ? 'Étape suivante' : 'Terminer'} onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              if (live < run.steps.length - 1) setLive(live + 1); else { set({ steps: Object.fromEntries(run.steps.map((_, i) => [i, true])) }); setLive(null); }
            }} /></Row>
        </Card>
      ) : (
        <>
          <Card>{run.steps.map((st, i) => (
            <Row key={i} style={{ paddingVertical: space.s3, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, alignItems: 'flex-start' }}>
              <Tick on={!!R.steps?.[i]} label="Étape faite" onPress={() => set({ steps: { ...(R.steps || {}), [i]: !R.steps?.[i] } })} />
              <View style={{ flex: 1 }}><T>{st.text}</T>{st.zone && st.zone !== 'easy' ? <T v="small" color={c.accent}>{zoneText(s, st.zone)}</T> : null}</View>
            </Row>))}
          </Card>
          <Button kind="primary" block label="Commencer en mode guidé" onPress={() => setLive(0)} />
        </>
      )}
      <T v="overline" muted style={{ marginTop: space.s5, marginBottom: space.s2 }}>Pour bien la faire</T>
      <Disclosure title="Comprendre la séance" sub="Les termes utilisés, expliqués">
        <Bullets items={[...new Set(run.steps.flatMap(st => RUN_TERMS.filter(([re]) => re.test(st.text)).map(([, t]) => t)))].concat(run.kind === 'facile' || run.kind === 'recup' ? ['Le seul piège d\'un footing facile, c\'est d\'aller trop vite. Si tu ne peux pas parler, ralentis : c\'est cette allure lente qui fait progresser ton endurance.'] : [])} />
      </Disclosure>
      <Disclosure title="Avant de partir : échauffement détaillé" sub="Coche au fur et à mesure">
        <T v="small" muted style={{ marginBottom: 8 }}>{run.kind === 'facile' || run.kind === 'recup' ? 'Pour un footing facile, les 5 premières minutes très lentes suffisent. Les éducatifs sont un bonus.' : 'Indispensable avant une séance d\'allure : fais tout.'}</T>
        <MoveList moves={RUN_WARMUP} />
      </Disclosure>
      {zs.map(z => (
        <Disclosure key={'z' + z} title={`Comment courir en ${ZONE_NAME[z].split(' ·')[0].toLowerCase()}`} sub={zoneText(s, z)}>
          <Bullets items={[ZONE_GUIDE[z].feel, ZONE_GUIDE[z].talk, ZONE_GUIDE[z].breath, ZONE_GUIDE[z].tip]} />
        </Disclosure>
      ))}
      <Disclosure title="Après : retour au calme et étirements" sub="10 min">
        <MoveList moves={RUN_COOLDOWN} />
      </Disclosure>
      <Disclosure title="L'échelle d'effort (1 à 10)">
        {RPE_SCALE.map(([n, t]) => <KV key={n} k={t} v={`${n}/10`} />)}
      </Disclosure>
      <T v="h3" style={{ marginTop: space.s5, marginBottom: space.s2 }}>Bilan</T>
      <T v="small" muted style={{ marginBottom: space.s3 }}>Tant que Strava n'est pas connecté, note distance et durée : c'est ce qui fait évoluer tes allures.</T>
      <Row><View style={{ flex: 1 }}><Field label="Distance (km)"><Input keyboardType="decimal-pad" defaultValue={R.km} placeholder="6,2" onChangeText={t => set({ km: t.replace(',', '.') })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Durée (min)"><Input keyboardType="decimal-pad" defaultValue={R.min} placeholder="45" onChangeText={t => set({ min: t.replace(',', '.') })} /></Field></View></Row>
      <Row><View style={{ flex: 1 }}><Field label="Dénivelé (m)"><Input keyboardType="number-pad" defaultValue={R.elev} placeholder="D+" onChangeText={t => set({ elev: t })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="FC moyenne"><Input keyboardType="number-pad" defaultValue={R.hr} placeholder="bpm" onChangeText={t => set({ hr: t })} /></Field></View></Row>
      <Field label="Effort ressenti" hint="1 très facile · 10 maximal"><Choices cols={10} options={Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)] as [number, string])} value={R.rpe} onChange={v => set({ rpe: v })} /></Field>
      {run.kind === 'test' ? <Field label="Temps du test (mm:ss)"><Input defaultValue={R.test} placeholder="29:40" onChangeText={t => set({ test: t })} /></Field> : null}
      <Button kind="primary" block label="Enregistrer la sortie" onPress={save} />
    </Sheet>
  );
}
export const _g = getState;
