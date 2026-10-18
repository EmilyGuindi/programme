import { resultValue } from '@/engine/race';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BarChart, PaceChart, WeightChart } from '@/components/charts';
import { Disclosure } from '@/components/guide';
import { Insights } from '@/components/insights';
import { coverage, energy, type EnergyCat } from '@/engine/energy';
import { fillCaloriesNow, useServer } from '@/store/store';
import { Badge, Kicker, Rail, Stage, StepMark } from '@/components/brand';
import { Icon } from '@/components/icons';
import { availableRecaps, buildRecap } from '@/engine/recap';
import { Bullets } from '@/components/guide';
import { bodyJourney, chapters, runningJourney, type Step } from '@/engine/journey';
import { achievementsMemo, CAT_LABEL, type AchCat } from '@/engine/achievements';
import { MilestoneRow } from '@/components/achievement-ui';
import { AchBadge } from '@/components/badges';
import { recordsUntil } from '@/engine/records';
import { BrandMark } from '@/components/logo';
import { sportDay } from '@/engine/dates';
import { Pressable } from 'react-native';
import { ActivityRow } from '@/components/plan-row';
import { BackLink, Button, Chevron, Card, Chip, Gap, SectionHeader, KV, ListGroup, ListRow, Meter, Row, Screen, Segmented, Stat, T } from '@/components/ui';
import { adapted, doneOn, mandatoryStats, programName, runInsight, trend, weekOf, weekStart, weightInsight, weightSeries, ZONE_EFFORT, ZONE_NAME, zones, zoneText } from '@/engine/coach';
import { addDays, clock, fmtShort, mmss, num, today } from '@/engine/dates';
import { EX } from '@/engine/library';
import { useApp } from '@/store/store';
import { eventState } from '@/engine/status';
import { layout, radius, space, useTheme } from '@/theme/tokens';

export default function Detail() {
  const { view } = useLocalSearchParams<{ view: string }>();
  return (
    <Screen>
      <View style={{ paddingTop: space.s3, paddingBottom: space.s2 }}><BackLink label="Progression" onPress={() => router.back()} /></View>
      {view === 'regularity' ? <Regularity /> : view === 'physique' ? <Physique /> : view === 'running' ? <Running /> : view === 'journey' ? <Journey /> : view === 'records' ? <Records /> : view === 'recaps' ? <Recaps /> : view === 'energy' ? <Energy /> : <Strength />}
    </Screen>
  );
}

function Regularity() {
  const s = useApp(); const { c } = useTheme(); const t = today();
  const weeks = []; for (let w = 1; w <= s.program.weeks; w++) { if (weekStart(s, w) > addDays(t, 7)) break; weeks.push(w); }
  const color = (d: string) => { const a = adapted(s, d); if (a.type === 'event') return c.accent; if (doneOn(s, d)) return a.reason ? c.warn : c.ok; if (d < t && a.mandatory && !a.skipped) return c.stopSoft; if (a.mandatory) return c.line2; if (a.optional) return c.accentSoft; return c.surface2; };
  const st = mandatoryStats(s, s.program.start, t);
  return (
    <>
      <T v="title">Régularité</T><Gap />
      {weeks.map(w => <Row key={w} gap={3} style={{ marginBottom: 4 }}><T v="xs" muted style={{ width: 32 }}>{`S${w}`}</T>{Array.from({ length: 7 }, (_, i) => <View key={i} style={{ flex: 1, height: 22, borderRadius: 4, backgroundColor: color(addDays(weekStart(s, w), i)) }} />)}</Row>)}
      <Row gap={12} style={{ flexWrap: 'wrap', marginTop: space.s2 }}>{[['faite', c.ok], ['adaptée', c.warn], ['manquée', c.stopSoft], ['prévue', c.line2], ['optionnelle', c.accentSoft], ['course', c.accent]].map(([l, col]) => <Row key={l} gap={4}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: col }} /><T v="xs" muted>{l}</T></Row>)}</Row>
      <Gap h={space.s4} />
      <Stat items={[[`${st.done}`, 'faites'], [`${st.planned - st.done}`, 'manquées'], [`${Object.keys(s.checkins).length}`, 'check-ins']]} />
      <Insights domains={['régularité', 'récupération', 'douleurs']} />
      <Gap /><T v="small" muted>Une séance manquée ne se rattrape pas : c'est la semaine suivante qui s'ajuste.</T>
    </>
  );
}

function Physique() {
  const s = useApp(); const { c } = useTheme(); const [f, setF] = useState<'4s' | '3m' | 'all'>('all'); const [sel, setSel] = useState<number | null>(null);
  const all = weightSeries(s); const t = today(); const last = all[all.length - 1]; const first = all[0];
  const ms = all.length >= 6 ? (f === '4s' ? all.filter(m => m.date >= addDays(t, -28)) : f === '3m' ? all.filter(m => m.date >= addDays(t, -90)) : all) : all;
  const showTrend = ms.length >= 4; const tr = trend(ms);
  const fmt = (v?: number | null) => (v == null ? '–' : v.toFixed(1).replace('.', ','));
  const delta = last && first && last !== first ? last.weight - first.weight : null;
  const hasCompo = all.some(m => m.fatPct != null || m.muscleKg != null);
  return (
    <>
      <T v="overline" muted>Poids et composition</T>
      {last ? <>
        <Row gap={6} style={{ alignItems: 'flex-end', marginTop: space.s2 }}><T v="display">{fmt(last.weight)}</T><T muted style={{ paddingBottom: 8 }}>kg</T></Row>
        <T muted>{`Pesée du ${fmtShort(last.date)}${delta != null ? `, ${delta <= 0 ? '−' : '+'}${fmt(Math.abs(delta))} kg depuis le ${fmtShort(first.date)}` : ''}`}</T>
      </> : <T style={{ marginTop: space.s2 }}>Aucune pesée pour l'instant.</T>}
      <Button kind="primary" block style={{ marginTop: space.s4 }} label="Ajouter une pesée" onPress={() => router.push('/measure')} />
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, marginTop: space.s5 }}>
        <Row between style={{ marginBottom: space.s2, paddingHorizontal: 4 }}>
          <T v="label">Évolution</T>
          {showTrend ? <Row gap={10}><Row gap={4}><View style={{ width: 12, height: 2, backgroundColor: c.ink2 }} /><T v="xs" muted>pesées</T></Row><Row gap={4}><View style={{ width: 12, height: 3, backgroundColor: c.accent }} /><T v="xs" muted>tendance</T></Row></Row> : <T v="xs" muted>{`${all.length} pesée${all.length > 1 ? 's' : ''}`}</T>}
        </Row>
        {all.length >= 2 ? <WeightChart ms={ms} trend={showTrend ? tr : ms.map(m => m.weight)} goal={s.user.goals.weightTarget} start={s.program.start} selected={sel} onSelect={setSel} hideTrend={!showTrend} />
          : <T v="small" muted style={{ padding: space.s4, textAlign: 'center' }}>La courbe apparaît dès la deuxième pesée.</T>}
        {sel != null && ms[sel] ? <T v="small" style={{ textAlign: 'center' }}>{`${fmtShort(ms[sel].date)}, ${fmt(ms[sel].weight)} kg${showTrend ? `, tendance ${fmt(tr[sel])} kg` : ''}`}</T> : null}
        {all.length >= 6 ? <View style={{ marginTop: space.s2 }}><Segmented options={[['4s', '4 sem.'], ['3m', '3 mois'], ['all', 'Tout']]} value={f} onChange={setF} /></View> : null}
      </View>
      <T v="small" muted style={{ marginTop: space.s2 }}>{showTrend ? weightInsight(s) : 'La tendance lissée s\'affichera à partir de 4 pesées : avant, elle serait trompeuse.'}</T>
      <ListGroup title="Historique">
        {[...all].reverse().map((m, i, arr) => <ListRow key={m.id} last={i === arr.length - 1} title={`${fmt(m.weight)} kg`} sub={[fmtShort(m.date), m.fatPct != null ? `MG ${fmt(m.fatPct)} %` : '', m.muscleKg != null ? `muscle ${fmt(m.muscleKg)} kg` : '', m.waist != null ? `taille ${fmt(m.waist)} cm` : '', m.note || ''].filter(Boolean).join(', ')} onPress={() => router.push({ pathname: '/measure', params: { id: m.id } })} />)}
      </ListGroup>
      {hasCompo ? <T v="xs" muted>Masse grasse et masse musculaire : estimations de la balance (impédance). Quelques centaines de grammes d'écart ne prouvent rien.</T> : null}
    </>
  );
}
function Running() {
  const s = useApp(); const { c } = useTheme(); const z = zones(s); const t = today();
  const recs = recordsUntil(s, t); const best10 = recs.find(r => r.id === 'run-10k'); const best5 = recs.find(r => r.id === 'run-5k');
  const runs = s.activities.filter(a => a.type === 'running' && !a.complementary && a.distanceKm && a.durationMin).sort((a, b) => a.date.localeCompare(b.date));
  const races = s.events.filter(e => e.result && e.type === 'course').sort((a, b) => a.date.localeCompare(b.date)); // OCR et HYROX hors analyses running
  const next = s.events.filter(e => e.type === 'course' && ['upcoming', 'today'].includes(eventState(s, e, t))).sort((a, b) => a.date.localeCompare(b.date))[0];
  const refPts = [...races.filter(e => e.distanceKm).map(e => ({ d: e.date, p: e.result!.time / e.distanceKm!, kind: 'course' as const })), ...runs.filter(r => r.kind === 'test').map(r => ({ d: r.date, p: (r.durationMin! * 60) / r.distanceKm!, kind: 'test' as const }))].sort((a, b) => a.d.localeCompare(b.d));
  const easy = runs.filter(r => (r.kind || 'facile') === 'facile').map(r => ({ d: r.date, p: (r.durationMin! * 60) / r.distanceKm! }));
  const wk: Record<number, number> = {}; runs.forEach(r => { const w = weekOf(s, r.date); wk[w] = (wk[w] || 0) + (r.distanceKm || 0); }); const ws = Object.keys(wk).map(Number).sort((a, b) => a - b).slice(-10);
  return (
    <>
      <T v="overline" muted>Référence mesurée</T>
      {best10 ? <>
        <Row gap={6} style={{ alignItems: 'flex-end', marginTop: space.s2 }}><T v="display">{mmss(best10.raw / 10)}</T><T muted style={{ paddingBottom: 8 }}>/km sur 10 km</T></Row>
        <T muted>{`${clock(best10.raw)}, ${fmtShort(best10.date)}${best5 ? `, 5 km : ${best5.value}` : ''}`}</T>
      </> : <>
        <T v="h2" style={{ marginTop: space.s2 }}>Pas encore de chrono mesuré</T>
        <T muted style={{ marginTop: 4 }}>{next ? `${next.name}, le ${fmtShort(next.date)}, sera ta première référence.` : 'Ton premier test ou ta première course deviendra ta référence.'}</T>
      </>}
      <View style={{ flexDirection: 'row', gap: space.s3, marginTop: space.s4 }}>
        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3 }}><T v="overline" muted>Objectif</T><T v="num" style={{ marginTop: 4 }}>5'30 /km</T><T v="xs" muted>sur 10 km, effort maîtrisé</T></View>
        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3 }}><T v="overline" muted>{best10 ? 'Écart' : 'Estimation initiale'}</T><T v="num" style={{ marginTop: 4 }} color={best10 ? undefined : c.ink3}>{best10 ? `${mmss(Math.max(0, best10.raw / 10 - 330))} /km` : `≈ ${mmss(z.p10)} /km`}</T><T v="xs" muted>{best10 ? 'à gagner' : 'hypothèse, pas un résultat'}</T></View>
      </View>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s3, marginTop: space.s5 }}>
        <T v="label" style={{ paddingHorizontal: 4 }}>Allure dans le temps</T><Row gap={10} style={{ paddingHorizontal: 4, marginTop: 4, marginBottom: space.s2 }}><Row gap={4}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /><T v="xs" muted>courses, tests</T></Row><Row gap={4}><View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: c.ink2 }} /><T v="xs" muted>footings</T></Row></Row>
        {refPts.length + easy.length >= 2 ? <PaceChart refs={refPts} easy={easy} goal={330} start={s.program.start} /> : <T v="small" muted style={{ padding: space.s4, textAlign: 'center' }}>{runs.length ? 'Encore une sortie et ta courbe apparaît.' : 'Tes sorties apparaîtront ici, avec ta référence et ton objectif.'}</T>}
      </View>
      <Insights domains={['running']} />
      <Disclosure title="Allures d'entraînement" sub={`Calculées depuis ${z.src}`}>
        {(['easy', 'seuil', '10k', '5k'] as const).map(k => <KV key={k} k={`${ZONE_NAME[k]}, effort ${ZONE_EFFORT[k]}`} v={zoneText(s, k)} />)}
      </Disclosure>
      {races.length ? <ListGroup title="Compétitions">{races.map((e, i) => <ListRow key={e.id} last={i === races.length - 1} title={e.name} sub={`${fmtShort(e.date)}, ${resultValue(e, clock)}${e.distanceKm && e.result!.time ? `, ${mmss(e.result!.time / e.distanceKm)} /km` : ''}${e.result!.elevM ? `, ${e.result!.elevM} m D+` : ''}`} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} />)}</ListGroup> : null}
      {ws.length ? <ListGroup title="Distance par semaine"><View style={{ padding: space.s3 }}><BarChart labels={ws.map(w => `S${w}`)} values={ws.map(w => +wk[w].toFixed(1))} unit="km" /></View></ListGroup> : null}
      <ListGroup title="Sorties">{runs.length ? [...runs].reverse().slice(0, 12).map((r, i, arr) => <ListRow key={r.id} last={i === arr.length - 1} title={r.title} sub={`${fmtShort(r.date)}, ${String(r.distanceKm).replace('.', ',')} km, ${mmss((r.durationMin! * 60) / r.distanceKm!)} /km${r.elevM ? `, ${r.elevM} m D+` : ''}`} onPress={() => router.push({ pathname: '/activity', params: { id: r.id } })} />) : <ListRow last chevron={false} title="Aucune sortie enregistrée" sub="Les cours de box et les marches ne comptent pas ici." />}</ListGroup>
    </>
  );
}
function Strength() {
  const s = useApp(); const { c } = useTheme(); const ids = ['f1', 'f2', 'f3', 'm1', 'm2', 'm3', 'm4']; const ds = Object.keys(s.strength).sort();
  if (!ds.length) return <><T v="title">Renforcement</T><Gap /><T muted>Aucune séance enregistrée. Tes charges apparaîtront ici après ton premier dimanche.</T></>;
  const best = (d: string, id: string) => { const e = s.strength[d].ex?.[id]; const v = e ? Math.max(0, ...e.kg.map(num).filter((n): n is number => !!n)) : 0; return v || null; };
  return (
    <>
      <T v="title">Renforcement</T>
      <Insights domains={['force']} />
      <ScrollView horizontal>
        <View>
          <Row gap={0}><T v="xs" muted style={{ width: 130 }}>Exercice</T>{ds.map(d => <T key={d} v="xs" muted style={{ width: 56, textAlign: 'right' }}>{fmtShort(d)}</T>)}</Row>
          {ids.map(id => <Row key={id} gap={0} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line }}><T v="small" style={{ width: 130 }} numberOfLines={1}>{EX[id].name.split(',')[0]}</T>{ds.map(d => <T key={d} v="small" style={{ width: 56, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{best(d, id) ?? '–'}</T>)}</Row>)}
        </View>
      </ScrollView>
      <T v="xs" muted style={{ marginTop: 8 }}>Meilleure charge (kg) par séance.</T>
    </>
  );
}

function Track({ title, steps }: { title: string; steps: Step[] }) {
  const { c } = useTheme(); const [open, setOpen] = useState<string | null>(steps.find(x => x.status === 'en cours')?.id ?? null);
  const doneN = steps.filter(x => x.status === 'atteinte').length;
  return (
    <View style={{ marginBottom: space.s6 }}>
      <Row between style={{ marginBottom: space.s3 }}><Kicker>{title}</Kicker><T v="small" muted>{`${doneN} sur ${steps.length} étapes`}</T></Row>
      {steps.map((st, i) => { const state = st.status === 'atteinte' ? 'done' : st.status === 'en cours' ? 'current' : st.status === 'réévaluée' ? 'revised' : 'next'; const isOpen = open === st.id; const cur = st.status === 'en cours';
        return (
          <Row key={st.id} gap={space.s3} style={{ alignItems: 'stretch' }}>
            <View style={{ width: 24, alignItems: 'center' }}>
              <View style={{ marginTop: cur ? 18 : 12 }}><StepMark state={state as any} /></View>
              {i < steps.length - 1 ? <View style={{ flex: 1, marginTop: 4, alignItems: 'center' }}><Rail done={st.status === 'atteinte'} height="100%" /></View> : null}
            </View>
            <Pressable style={{ flex: 1, paddingBottom: space.s2 }} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : st.id)}>
              <View style={cur ? { backgroundColor: c.stage, borderRadius: radius.r2, padding: space.s4 } : { paddingVertical: space.s3 }}>
                <Row between>
                  <T v={cur ? 'h3' : 'label'} color={cur ? c.stageInk : st.status === 'à venir' ? c.ink2 : c.ink} style={{ flex: 1 }}>{st.title}</T>
                  {st.status === 'atteinte' ? <T v="overline" color={c.ok}>Atteinte</T> : cur ? <T v="overline" color={c.accent}>En cours</T> : <Chevron open={isOpen} />}
                </Row>
                {cur && st.ratio != null ? <View style={{ marginTop: space.s3 }}><Meter value={st.ratio} track="rgba(244,242,238,0.15)" color={c.accent} /></View> : null}
                {cur && st.progress ? <T v="small" color={c.stageInk2} style={{ marginTop: 6 }}>{st.progress}</T> : null}
                {isOpen ? <View style={{ marginTop: space.s3, gap: 8 }}>
                  <T v="small" color={cur ? c.stageInk : c.ink}><T v="small" style={{ fontWeight: '700' }} color={cur ? c.stageInk : c.ink}>Critère : </T>{st.criterion}</T>
                  {!cur ? <T v="small" color={c.ink2}>{st.progress ?? 'Pas encore mesurable : les données arrivent avec tes séances.'}</T> : null}
                  {st.history.length ? <T v="small" color={cur ? c.stageInk2 : c.ink2}>{st.history.join(', ')}</T> : null}
                  {st.status !== 'atteinte' ? <Row gap={8} style={{ alignItems: 'flex-start' }}><T v="small" color={c.accent} style={{ fontWeight: '700' }}>→</T><T v="small" color={cur ? c.stageInk : c.ink} style={{ flex: 1 }}>{st.next}</T></Row> : null}
                </View> : null}
              </View>
            </Pressable>
          </Row>
        ); })}
    </View>
  );
}
function Journey() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay(); const chs = chapters(s, d, achievementsMemo(s, d));
  return (<>
    <T v="title" style={{ fontSize: 32, lineHeight: 38 }}>Mon parcours</T>
    <T muted style={{ marginTop: 4, marginBottom: space.s5 }}>{`${programName(s)} : ${chs.length} chapitres, du premier repère au bilan.`}</T>
    {chs.map((ch, i) => { const cur = ch.state === 'en cours'; const done = ch.state === 'terminé';
      return (
        <Row key={ch.n} gap={space.s3} style={{ alignItems: 'stretch' }}>
          <View style={{ width: 28, alignItems: 'center' }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, marginTop: cur ? 22 : 14, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.ink : cur ? c.accent : 'transparent', borderWidth: done || cur ? 0 : 1.5, borderColor: c.stroke }}>
              <T v="label" color={done ? c.paper : cur ? c.accentInk : c.ink2}>{ch.n}</T>
            </View>
            {i < chs.length - 1 ? <View style={{ flex: 1, marginTop: 4, alignItems: 'center' }}><Rail done={done} height="100%" /></View> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: space.s3 }}>
            <View style={cur ? { backgroundColor: c.stage, borderRadius: radius.r2, padding: space.s4, borderWidth: 0.5, borderColor: c.line2 } : { paddingVertical: space.s3 }}>
              <Row between><T v={cur ? 'h3' : 'label'} color={ch.state === 'à venir' ? c.ink2 : c.ink} style={{ flex: 1 }}>{ch.name}</T><T v="xs" color={done ? c.ink2 : cur ? c.accent : c.ink3} style={{ fontWeight: '700' }}>{done ? 'Terminé' : cur ? 'En cours' : `Sem. ${ch.from}${ch.to > ch.from ? `–${ch.to}` : ''}`}</T></Row>
              <T v="small" muted style={{ marginTop: 2 }}>{ch.goal}</T>
              {ch.state !== 'à venir' ? <View style={{ flexDirection: 'row', gap: 4, marginTop: space.s3 }}>{ch.weeks.map(k => <View key={k.w} accessibilityLabel={`Semaine ${k.w}`} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: k.state === 'ok' ? c.accent : k.state === 'ko' ? c.surface2 : 'transparent', borderWidth: k.state === 'current' || k.state === 'next' ? 1 : 0, borderColor: k.state === 'current' ? c.accent : c.stroke }} />)}</View> : null}
              <Row gap={8} style={{ marginTop: space.s3, alignItems: 'flex-start' }}>
                <View style={{ marginTop: 2 }}><StepMark state={ch.milestone.reached ? 'done' : cur ? 'current' : 'next'} size={16} /></View>
                <T v="small" style={{ flex: 1 }} color={ch.state === 'à venir' ? c.ink2 : c.ink}><T v="small" style={{ fontWeight: '700' }} color={ch.state === 'à venir' ? c.ink2 : c.ink}>Jalon : </T>{`${ch.milestone.title}${ch.milestone.reached ? `, atteint le ${fmtShort(ch.milestone.reached)}` : ''}`}</T>
              </Row>
              {ch.bilan ? <T v="xs" muted style={{ marginTop: space.s2 }}>{`${done ? 'Bilan' : 'Jusqu\'ici'} : ${ch.bilan.done}/${ch.bilan.planned} séances prévues${ch.bilan.km ? `, ${String(ch.bilan.km).replace('.', ',')} km courus` : ''}${ch.bilan.records ? `, ${ch.bilan.records} record${ch.bilan.records > 1 ? 's' : ''}` : ''}`}</T> : null}
              {!done ? <Row gap={8} style={{ marginTop: space.s2, alignItems: 'flex-start' }}><T v="small" color={c.accent} style={{ fontWeight: '700' }}>→</T><T v="small" style={{ flex: 1 }} color={cur ? c.ink : c.ink2}>{ch.next}</T></Row> : null}
            </View>
          </View>
        </Row>); })}
    <T v="small" muted style={{ fontWeight: '600', marginTop: space.s5, marginBottom: space.s3 }}>Étapes détaillées</T>
    <Track title="Running" steps={runningJourney(s, d)} /><Track title="Physique et renforcement" steps={bodyJourney(s, d)} />
  </>);
}
function Records() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay(); const recs = recordsUntil(s, d); const ach = achievementsMemo(s, d);
  const got = ach.filter(a => a.date).sort((a, b) => b.date!.localeCompare(a.date!)); const majors = got.filter(a => a.tier === 'major');
  const going = ach.filter(a => a.status === 'progress' && a.id !== 'reg-cycle' && a.id !== 'reg-phase').sort((a, b) => b.progress!.value / b.progress!.target - a.progress!.value / a.progress!.target).slice(0, 4);
  const later = ach.filter(a => !a.date && !going.includes(a));
  const run = recs.filter(r => r.id.startsWith('run-')), str = recs.filter(r => r.id.startsWith('str-'));
  const Rec = ({ label, value, date }: { label: string; value: string; date?: string }) => (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4 }}>
      <T v="small" muted style={{ fontWeight: '600' }}>{label}</T><T v="num" style={{ marginTop: space.s2, fontSize: 28, lineHeight: 32 }} numberOfLines={1}>{value}</T>{date ? <T v="xs" muted>{fmtShort(date)}</T> : null}
    </View>);
  return (
    <>
      <T v="title" style={{ fontSize: 32, lineHeight: 38, marginBottom: space.s2 }}>Accomplissements</T>
      <T muted style={{ marginBottom: space.s4 }}>{`${got.length} atteint${got.length > 1 ? 's' : ''} sur ${ach.length}. Chacun repose sur des données vérifiables : séances, Strava, résultats.`}</T>
      {majors.map(a => (
        <Stage key={a.id} mark tone="lime">
          <Row gap={space.s4}><AchBadge cat={a.cat} status="unlocked" major size={76} label={a.title} />
            <View style={{ flex: 1 }}><T v="eyebrow" color={c.accentInk}>{CAT_LABEL[a.cat]}</T><T v="h2" color={c.accentInk} style={{ marginTop: 4 }}>{a.title}</T><T v="small" color={c.accentInk} style={{ marginTop: 2 }}>{a.detail || a.description}</T></View></Row>
        </Stage>))}
      {got.filter(a => a.tier !== 'major').length ? <>
        <SectionHeader title="Atteints" first />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3, marginBottom: space.s5 }}>
          {got.filter(a => a.tier !== 'major').map(a => (
            <View key={a.id} accessible accessibilityLabel={`${a.title}, atteint le ${fmtShort(a.date!)}`} style={{ flexBasis: '30%', flexGrow: 1, backgroundColor: c.stage, borderRadius: radius.r2, borderWidth: 0.5, borderColor: c.line2, padding: space.s3, alignItems: 'center' }}>
              <AchBadge cat={a.cat} status="unlocked" size={64} />
              <T v="small" style={{ fontWeight: '600', textAlign: 'center', marginTop: 6 }}>{a.title}</T>
              <T v="xs" muted style={{ textAlign: 'center' }}>{a.detail ? `${a.detail}, ${fmtShort(a.date!)}` : fmtShort(a.date!)}</T>
            </View>))}
        </View>
      </> : null}
      {going.length ? <ListGroup title="En bonne voie">{going.map((a, i) => <MilestoneRow key={a.id} a={a} last={i === going.length - 1} />)}</ListGroup> : null}
      {later.length ? <Disclosure title={`${later.length} jalons à découvrir`} sub="Critères et sources, par catégorie">
        {(Object.keys(CAT_LABEL) as AchCat[]).map(k => { const xs = later.filter(a => a.cat === k); return xs.length ? <View key={k} style={{ marginBottom: space.s3 }}><T v="label" style={{ marginBottom: 4 }}>{CAT_LABEL[k]}</T>{xs.map(a => <Row key={a.id} gap={space.s3} style={{ paddingVertical: 6, alignItems: 'flex-start' }}><AchBadge cat={a.cat} status="locked" size={32} /><View style={{ flex: 1 }}><T v="small" style={{ fontWeight: '600' }}>{a.title}</T><T v="xs" muted>{a.criterion}</T><T v="xs" muted>{`Source : ${a.source}`}</T></View></Row>)}</View> : null; })}
      </Disclosure> : null}
      <SectionHeader title="Records running" />
      <View style={{ marginBottom: layout.gap }}>{run.length ? <Row gap={space.s3} style={{ flexWrap: 'wrap' }}>{run.map(r => <Rec key={r.id} label={r.label} value={r.value} date={r.date} />)}</Row> : <T v="small" muted>Tes records arrivent avec tes premières sorties et courses.</T>}</View>
      <SectionHeader title="Records de renforcement" />
      <View style={{ marginBottom: layout.gap }}>{str.length ? <Row gap={space.s3} style={{ flexWrap: 'wrap' }}>{str.map(r => <Rec key={r.id} label={r.label} value={r.value} date={r.date} />)}</Row> : <T v="small" muted>Note tes charges et coche tes séries : tes meilleures apparaîtront ici.</T>}</View>
      <T v="xs" muted style={{ marginTop: space.s2 }}>Les records de vitesse ne viennent que de courses ou de tests sur la bonne distance, avec une allure plausible. Une activité corrigée ou supprimée est réévaluée automatiquement.</T>
    </>
  );
}
function Recaps() {
  const s = useApp(); const { c } = useTheme(); const list = availableRecaps(s);
  return (<><T v="title" style={{ marginBottom: space.s4 }}>Bilans de la semaine</T>
    {list.length ? <ListGroup>{list.map((w, i) => { const r = buildRecap(s, w); const seen = !!s.recapsSeen?.[String(w)]; return <ListRow key={w} last={i === list.length - 1} title={`Semaine ${w}`} sub={`${fmtShort(r.from)} – ${fmtShort(r.to)}`} left={<Icon name="story" color={seen ? undefined : c.accent} />} right={seen ? undefined : <Chip tone="accent" label="Nouveau" />} onPress={() => router.push({ pathname: '/recap/[week]', params: { week: String(w) } })} />; })}</ListGroup> : <T muted>Ton premier bilan arrivera dimanche soir.</T>}</>);
}

function Energy() {
  const s = useApp(); const { c } = useTheme(); const t = sportDay(); const sv = useServer(); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const wk = energy(s, addDays(t, -6), t); const mo = energy(s, addDays(t, -29), t);
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = addDays(t, -7 * (7 - i)); const e = energy(s, addDays(end, -6), end); return { label: fmtShort(addDays(end, -6)), v: e.total, n: e.withData }; }).filter(x => x.n > 0);
  const CAT: [EnergyCat, string][] = [['entraînement', 'Entraînements du programme'], ['complémentaire', 'Activités complémentaires'], ['promenade', 'Promenades'], ['récupération', 'Récupération active']];
  const fmtK = (n: number) => n.toLocaleString('fr-FR');
  return (
    <>
      <T v="title" style={{ fontSize: 30, lineHeight: 36 }}>Dépense des activités</T>
      <T muted style={{ marginTop: 4, marginBottom: space.s5 }}>Estimations de ta montre, transmises par Strava. Une indication, pas une mesure exacte.</T>
      {!sv.url ? <T v="small" style={{ marginBottom: space.s4 }}>Connecte le serveur et Strava (Profil → Serveur et Strava) pour récupérer ces données.</T> : null}
      <Row gap={space.s3} style={{ alignItems: 'stretch' }}>
        {[['7 derniers jours', wk], ['30 derniers jours', mo]].map(([l, e]: any) => (
          <View key={l} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4 }}>
            <T v="small" muted style={{ fontWeight: '600' }}>{l}</T>
            {e.withData ? <><Row gap={4} style={{ alignItems: 'flex-end', marginTop: space.s2 }}><T v="num" style={{ fontSize: 28, lineHeight: 32 }} numberOfLines={1}>{fmtK(e.total)}</T><T v="small" muted style={{ paddingBottom: 3 }}>kcal</T></Row><T v="xs" muted style={{ marginTop: 2 }}>{coverage(e)}</T></>
              : <T v="small" muted style={{ marginTop: 6 }}>{e.count ? `Aucune estimation sur ${e.count} activité${e.count > 1 ? 's' : ''}` : 'Aucune activité'}</T>}
          </View>))}
      </Row>
      {mo.withData ? <ListGroup title="D'où vient la dépense (30 jours)">
        {CAT.filter(([k]) => mo.byCat[k].n).map(([k, l], i, arr) => (
          <View key={k} style={{ paddingHorizontal: space.s4, paddingVertical: space.s3 }}>
            <Row between style={{ alignItems: 'flex-start' }}><T style={{ flex: 1 }}>{l}</T><T v="label" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{`${fmtK(Math.round(mo.byCat[k].kcal))} kcal`}</T></Row>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, marginTop: 8 }}><View style={{ width: `${(mo.byCat[k].kcal / mo.total) * 100}%`, height: 4, borderRadius: 2, backgroundColor: k === 'entraînement' ? c.ink : c.ink3 }} /></View>
            <T v="xs" muted style={{ marginTop: 4 }}>{`${mo.byCat[k].n} activité${mo.byCat[k].n > 1 ? 's' : ''}`}</T>
          </View>))}
      </ListGroup> : null}
      {weeks.length >= 3 ? <ListGroup title="Par semaine"><View style={{ padding: space.s3 }}><BarChart labels={weeks.map(w => w.label)} values={weeks.map(w => w.v)} unit="kcal" /></View></ListGroup> : null}
      {mo.pending ? <View style={{ marginTop: space.s2 }}>
        <T v="small" muted>{`${mo.pending} activité${mo.pending > 1 ? 's' : ''} Strava en attente de leur estimation.`}</T>
        {sv.url ? <Button small kind="ghost" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} label={busy ? 'Récupération…' : 'Récupérer les valeurs disponibles'} disabled={busy} onPress={async () => { setBusy(true); setMsg(await fillCaloriesNow()); setBusy(false); }} /> : null}
        {msg ? <T v="small">{msg}</T> : null}
      </View> : null}
      <T v="xs" muted style={{ marginTop: space.s4 }}>Les activités sans estimation (saisies à la main, ou sans donnée de la montre) ne sont pas comptées. Les promenades sont incluses mais ne valident aucune séance.</T>
    </>
  );
}
