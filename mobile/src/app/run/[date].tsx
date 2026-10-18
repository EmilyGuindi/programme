import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Bullets, Disclosure, MoveList } from '@/components/guide';
import { Sheet } from '@/components/sheet';
import { BrandedCard, MetricPill } from '@/components/brand';
import { Icon } from '@/components/icons';
import { segments, totalSec } from '@/engine/segments';
import { radius } from '@/theme/tokens';
import { RPE_SCALE, RUN_COOLDOWN, RUN_TERMS, RUN_WARMUP, ZONE_GUIDE } from '@/engine/guides';
import { Button, Card, Choices, Coach, Field, Gap, Input, KV, Row, SectionHeader, T, Tick } from '@/components/ui';
import { adapted, sessionKey, ZONE_NAME, zones, zoneText } from '@/engine/coach';
import { fmtDay, num, parseTime, uid } from '@/engine/dates';
import { isOn, toggleCheck } from '@/engine/session';
import { SessionFooter } from '@/components/session-progress';
import { haptic } from '@/feedback';
import { Pressable } from 'react-native';
import type { RunLog, Zone } from '@/engine/types';
import { getState, update, useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

export default function RunScreen() {
  const { date, finished } = useLocalSearchParams<{ date: string; finished?: string }>(); const s = useApp(); const { c } = useTheme();
  const a = adapted(s, date); const run = a.replaced ? undefined : a.run; const key = sessionKey(s, date); const R: RunLog = s.runs[key] || {};
  const [live, setLive] = useState<number | null>(null);
  const set = (patch: Partial<RunLog>) => update(st => { st.runs[key] = { ...(st.runs[key] || {}), ...patch }; });
  if (!run) return <Sheet title={(a.replaced || a).title} sub={fmtDay(date)}><T>{(a.replaced || a).goal}</T></Sheet>;
  const zs = [...new Set(run.steps.map(x => x.zone).filter(Boolean))] as Zone[];
  function save() {
    const km = num(R.km), min = num(R.min);
    update(st => {
      let act = st.activities.find(x => x.date === date && x.type === 'running' && x.source === 'manuel');
      if (!act) { act = { id: `run-${date}-${uid()}`, date, type: 'running', title: run!.title, source: 'manuel', complementary: false, matched: date }; st.activities.push(act); }
      Object.assign(act, { title: run!.title, durationMin: min, distanceKm: km, elevM: num(R.elev), avgHr: num(R.hr), effort: R.rpe ?? null, kind: run!.kind === 'qualite' ? 'qualite' : run!.kind === 'test' ? 'test' : 'facile' });
      if (run!.kind === 'test') { const t = parseTime(R.test); if (t && t > 900) { if (/10 km/.test(run!.title)) st.user.ref.k10 = t; else st.user.ref.k5 = t; } }
    });
    const act = getState().activities.find(x => x.date === date && x.type === 'running' && x.source === 'manuel');
    if (act && !getState().closures?.[act.id]) router.replace({ pathname: '/done/[id]', params: { id: act.id } }); else router.back();
  }
  const sg = segments(run); const total = Math.round(totalSec(sg) / 60);
  return (
    <Sheet title={run.title} sub={fmtDay(date)} footer={<SessionFooter date={date}><Button kind="primary" block icon={<Icon name="play" size={18} color="#0B0D0A" />} label="Démarrer la séance" onPress={() => router.push({ pathname: '/run-live/[date]', params: { date } })} /></SessionFooter>}>
      {finished ? <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3 }}><T v="label" color={c.accent}>Séance terminée</T><T v="small">Ton temps est noté. La distance et l'allure de ta montre arrivent par Strava ; tu peux aussi les saisir dans « Bilan » plus bas.</T></View> : null}
      <BrandedCard mark>
        <T v="overline" color={c.stageInk2}>{run.kind === 'facile' ? 'Endurance' : run.kind === 'qualite' ? 'Séance d\'allure' : run.kind === 'test' ? 'Test' : 'Récupération'}</T>
        <T v="h2" color={c.stageInk} style={{ marginTop: space.s2 }}>{run.goal}</T>
        <Row gap={8} style={{ marginTop: space.s4, flexWrap: 'wrap' }}>
          <MetricPill icon={<Icon name="clock" size={15} color={c.accent} />} label={`${total} min`} />
          {(zs.filter(z => z !== 'easy')[0] || zs[0]) ? <MetricPill icon={<Icon name="shoe" size={15} color={c.accent} />} label={zoneText(s, (zs.filter(z => z !== 'easy')[0] || zs[0])!)} /> : null}
        </Row>
        {a.reason ? <T v="small" color={c.warn} style={{ marginTop: space.s3 }}>{a.reason}</T> : null}
      </BrandedCard>
      <SectionHeader title="Déroulé" />
      <T v="small" muted style={{ marginTop: -4, marginBottom: space.s2 }}>Touche une étape pour la cocher.</T>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, paddingVertical: space.s2 }}>
        {run.steps.map((st, i) => { const id = `step:${run.kind}:${i + 1}`; const on = isOn(s, date, id); const hot = !!st.zone && st.zone !== 'easy'; return (
          <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Étape ${i + 1} : ${st.text}`} onPress={() => { haptic(on ? 'untick' : 'tick'); update(x => toggleCheck(x, date, id)); }}
            style={({ pressed }) => ({ flexDirection: 'row', gap: space.s3, paddingHorizontal: space.s4, paddingVertical: space.s3, alignItems: 'flex-start', backgroundColor: pressed ? c.surface2 : 'transparent' })}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? c.accent : hot ? c.accent : c.stroke, backgroundColor: on ? c.accent : 'transparent' }}>{on ? <Icon name="check" size={16} color={c.accentInk} /> : <T v="xs" color={hot ? c.accent : c.ink2} style={{ fontWeight: '700' }}>{String(i + 1)}</T>}</View>
            <View style={{ flex: 1 }}><T color={on ? c.ink2 : c.ink}>{st.text}</T>{st.zone ? <T v="small" color={st.zone === 'easy' ? c.ink2 : c.accent}>{`${zoneText(s, st.zone)}, ${ZONE_NAME[st.zone].toLowerCase()}`}</T> : null}</View>
          </Pressable>); })}
      </View>
      <T v="xs" muted style={{ marginTop: space.s2 }}>{`Allures calculées depuis ${zones(s).src}. En côte ou par vent, suis l'effort.`}</T>
      <SectionHeader title="Pour bien la faire" />
      <Disclosure title="Comprendre la séance" sub="Les termes utilisés, expliqués">
        <Bullets items={[...new Set(run.steps.flatMap(st => RUN_TERMS.filter(([re]) => re.test(st.text)).map(([, t]) => t)))].concat(run.kind === 'facile' || run.kind === 'recup' ? ['Le seul piège d\'un footing facile, c\'est d\'aller trop vite. Si tu ne peux pas parler, ralentis : c\'est cette allure lente qui fait progresser ton endurance.'] : [])} />
      </Disclosure>
      <Disclosure title="Avant de partir : échauffement détaillé" sub="Coche au fur et à mesure">
        <T v="small" muted style={{ marginBottom: 8 }}>{run.kind === 'facile' || run.kind === 'recup' ? 'Pour un footing facile, les 5 premières minutes très lentes suffisent. Les éducatifs sont un bonus.' : 'Indispensable avant une séance d\'allure : fais tout.'}</T>
        <MoveList moves={RUN_WARMUP} date={date} prefix="rwarm" />
      </Disclosure>
      {zs.map(z => (
        <Disclosure key={'z' + z} title={`Comment courir en ${ZONE_NAME[z].toLowerCase()}`} sub={zoneText(s, z)}>
          <Bullets items={[ZONE_GUIDE[z].feel, ZONE_GUIDE[z].talk, ZONE_GUIDE[z].breath, ZONE_GUIDE[z].tip]} />
        </Disclosure>
      ))}
      <Disclosure title="Après : retour au calme et étirements" sub="10 min">
        <MoveList moves={RUN_COOLDOWN} date={date} prefix="rcool" />
      </Disclosure>
      <Disclosure title="L'échelle d'effort (1 à 10)">
        {RPE_SCALE.map(([n, t]) => <KV key={n} k={t} v={`${n}/10`} />)}
      </Disclosure>
      <SectionHeader title="Bilan" />
      <T v="small" muted style={{ marginBottom: space.s3 }}>Tant que Strava n'est pas connecté, note distance et durée : c'est ce qui fait évoluer tes allures.</T>
      <Row><View style={{ flex: 1 }}><Field label="Distance (km)"><Input keyboardType="decimal-pad" defaultValue={R.km} placeholder="6,2" onChangeText={t => set({ km: t.replace(',', '.') })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Durée (min)"><Input keyboardType="decimal-pad" defaultValue={R.min} placeholder="45" onChangeText={t => set({ min: t.replace(',', '.') })} /></Field></View></Row>
      <Row><View style={{ flex: 1 }}><Field label="Dénivelé (m)"><Input keyboardType="number-pad" defaultValue={R.elev} placeholder="D+" onChangeText={t => set({ elev: t })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="FC moyenne"><Input keyboardType="number-pad" defaultValue={R.hr} placeholder="bpm" onChangeText={t => set({ hr: t })} /></Field></View></Row>
      <Field label="Effort ressenti" hint="de 1, très facile, à 10, maximal"><Choices cols={10} options={Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)] as [number, string])} value={R.rpe} onChange={v => set({ rpe: v })} /></Field>
      {run.kind === 'test' ? <Field label="Temps du test (mm:ss)"><Input defaultValue={R.test} placeholder="29:40" onChangeText={t => set({ test: t })} /></Field> : null}
      <Button kind="primary" block label="Enregistrer la sortie" onPress={save} />
    </Sheet>
  );
}
export const _g = getState;
