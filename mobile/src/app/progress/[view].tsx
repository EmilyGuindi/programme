import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BarChart, WeightChart } from '@/components/charts';
import { Insights } from '@/components/insights';
import { Bullets } from '@/components/guide';
import { achievements, bodyJourney, runningJourney, type Step } from '@/engine/journey';
import { recordsUntil } from '@/engine/records';
import { Symbol } from '@/components/logo';
import { sportDay } from '@/engine/dates';
import { Pressable } from 'react-native';
import { ActivityRow } from '@/components/plan-row';
import { Button, Card, Gap, KV, Row, Screen, Segmented, Stat, T } from '@/components/ui';
import { adapted, doneOn, mandatoryStats, runInsight, trend, weekOf, weekStart, weightInsight, weightSeries, ZONE_NAME, zones, zoneText } from '@/engine/coach';
import { addDays, clock, fmtShort, mmss, num, today } from '@/engine/dates';
import { EX } from '@/engine/library';
import { useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

export default function Detail() {
  const { view } = useLocalSearchParams<{ view: string }>();
  return (
    <Screen>
      <Row style={{ paddingTop: space.s4, paddingBottom: space.s3 }}><Button small label="‹ Progression" onPress={() => router.back()} /></Row>
      {view === 'regularity' ? <Regularity /> : view === 'physique' ? <Physique /> : view === 'running' ? <Running /> : view === 'journey' ? <Journey /> : view === 'records' ? <Records /> : <Strength />}
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
  const all = weightSeries(s); const t = today();
  const ms = f === '4s' ? all.filter(m => m.date >= addDays(t, -28)) : f === '3m' ? all.filter(m => m.date >= addDays(t, -90)) : all;
  const tr = trend(ms); const last = all[all.length - 1];
  const d7 = last && all.filter(m => m.date <= addDays(last.date, -6)).pop(), d30 = last && all.filter(m => m.date <= addDays(last.date, -28)).pop();
  const delta = (a?: number) => (a == null ? '–' : `${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(1).replace('.', ',')}`);
  const fmt = (v?: number | null) => (v == null ? '–' : String(v).replace('.', ','));
  return (
    <>
      <T v="title">Poids et composition</T>
      <T v="small" muted style={{ marginVertical: space.s2 }}>{weightInsight(s)}</T>
      <Insights domains={['poids']} max={1} title="Tendance" />
      <Stat items={[[last ? last.weight.toFixed(1).replace('.', ',') : '–', 'kg, dernière pesée'], [d7 ? delta(last.weight - d7.weight) : '–', '7 jours'], [d30 ? delta(last.weight - d30.weight) : '–', '30 jours']]} />
      <Gap />
      <Segmented options={[['4s', '4 sem'], ['3m', '3 mois'], ['all', 'Tout']]} value={f} onChange={setF} />
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s2, marginVertical: space.s3 }}>
        <WeightChart ms={ms} trend={tr} goal={s.user.goals.weightTarget} start={s.program.start} selected={sel} onSelect={setSel} />
        {sel != null && ms[sel] ? <T v="small" style={{ textAlign: 'center' }}>{`${fmtShort(ms[sel].date)} · ${fmt(ms[sel].weight)} kg · tendance ${tr[sel].toFixed(1).replace('.', ',')} kg`}</T> : null}
      </View>
      <T v="xs" muted>Ligne fine : pesées. Ligne épaisse : tendance lissée, c'est elle qu'on lit. Touche un point pour le détail.</T>
      <Gap /><Button kind="primary" block label="Ajouter une pesée" onPress={() => router.push('/measure')} />
      <T v="h3" style={{ marginTop: space.s5, marginBottom: space.s2 }}>Historique</T>
      {[...all].reverse().map(m => (
        <Card key={m.id} onPress={() => router.push({ pathname: '/measure', params: { id: m.id } })} style={{ paddingVertical: space.s3 }}>
          <Row between><T v="label">{fmtShort(m.date)}</T><T v="label" style={{ fontVariant: ['tabular-nums'] }}>{`${fmt(m.weight)} kg`}</T></Row>
          <T v="xs" muted>{[m.fatPct != null ? `MG ${fmt(m.fatPct)} %` : '', m.muscleKg != null ? `muscle ${fmt(m.muscleKg)} kg` : '', m.waist != null ? `taille ${fmt(m.waist)} cm` : '', m.note || ''].filter(Boolean).join(' · ') || 'Modifier'}</T>
        </Card>
      ))}
      <T v="xs" muted>La masse grasse et la masse musculaire de la balance sont des estimations par impédance : quelques centaines de grammes d'écart ne prouvent rien.</T>
    </>
  );
}

function Running() {
  const s = useApp(); const z = zones(s); const gap = z.p10 - 330;
  const rs = s.activities.filter(a => (a.type === 'running' || a.type === 'course') && a.distanceKm && a.durationMin).sort((a, b) => a.date.localeCompare(b.date));
  const evs = s.events.filter(e => e.result).sort((a, b) => a.date.localeCompare(b.date));
  const wk: Record<number, number> = {}; rs.forEach(r => { const w = weekOf(s, r.date); wk[w] = (wk[w] || 0) + (r.distanceKm || 0); });
  const ws = Object.keys(wk).map(Number).sort((a, b) => a - b).slice(-10);
  return (
    <>
      <T v="title">Running</T>
      <Insights domains={['running']} />
      <Stat items={[[mmss(z.p10), '/km, 10 km actuel'], ["5'30", '/km, objectif'], [gap > 0 ? mmss(gap) : '0', "/km d'écart"]]} />
      <T v="xs" muted style={{ marginTop: 6 }}>{`Référence : ${z.src}.`}</T>
      <Gap />
      <Card><T v="h3">Tes allures cibles</T>{(['easy', 'seuil', '10k', '5k'] as const).map(k => <KV key={k} k={ZONE_NAME[k]} v={zoneText(s, k)} />)}</Card>
      <T v="h3" style={{ marginTop: space.s3, marginBottom: space.s2 }}>Repères</T>
      {evs.length ? evs.map(e => <KV key={e.id} k={`${fmtShort(e.date)} · ${e.name}`} v={`${clock(e.result!.time)}${e.distanceKm ? ` · ${mmss(e.result!.time / e.distanceKm)}/km` : ''}${e.result!.elevM ? ` · ${e.result!.elevM} m D+` : ''}`} />)
        : <T v="small" muted>Lausanne (25 oct.) et Athènes (8 nov.) seront tes deux premiers repères 10 km.</T>}
      {ws.length ? <><T v="h3" style={{ marginTop: space.s4, marginBottom: space.s2 }}>Distance par semaine</T><Card><BarChart labels={ws.map(w => `S${w}`)} values={ws.map(w => +wk[w].toFixed(1))} unit="km" /></Card></> : null}
      <T v="h3" style={{ marginTop: space.s3, marginBottom: space.s2 }}>Sorties</T>
      {rs.length ? [...rs].reverse().map(r => <ActivityRow key={r.id} x={r} />) : <T v="small" muted>Aucune sortie enregistrée.</T>}
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

const STATUS_COL = (c: any, st: Step['status']) => (st === 'atteinte' ? c.ok : st === 'en cours' ? c.accent : st === 'réévaluée' ? c.warn : c.line2);
function Track({ title, steps }: { title: string; steps: Step[] }) {
  const { c } = useTheme(); const [open, setOpen] = useState<string | null>(steps.find(x => x.status === 'en cours')?.id ?? null);
  return (
    <View style={{ marginBottom: space.s5 }}>
      <T v="h2" style={{ marginBottom: space.s3 }}>{title}</T>
      {steps.map((st, i) => (
        <Row key={st.id} gap={space.s3} style={{ alignItems: 'stretch' }}>
          <View style={{ width: 24, alignItems: 'center' }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: st.status === 'à venir' ? c.paper : STATUS_COL(c, st.status), borderWidth: 3, borderColor: STATUS_COL(c, st.status), marginTop: 14 }} />
            {i < steps.length - 1 ? <View style={{ flex: 1, width: 3, backgroundColor: st.status === 'atteinte' ? c.ok : c.line, marginTop: 2 }} /> : null}
          </View>
          <Pressable style={{ flex: 1, paddingBottom: space.s3 }} onPress={() => setOpen(open === st.id ? null : st.id)}>
            <View style={{ backgroundColor: st.status === 'en cours' ? c.accentSoft : c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s3 }}>
              <Row between><T v="label" style={{ flex: 1 }}>{st.title}</T><T v="xs" color={STATUS_COL(c, st.status)} style={{ fontWeight: '600' }}>{st.status}</T></Row>
              {open === st.id ? <View style={{ marginTop: space.s2, gap: 6 }}>
                <T v="small"><T v="small" style={{ fontWeight: '600' }}>Critère : </T>{st.criterion}</T>
                <T v="small"><T v="small" style={{ fontWeight: '600' }}>Où tu en es : </T>{st.progress ?? 'pas encore mesurable, les données arrivent avec tes séances.'}</T>
                {st.ratio != null && st.status !== 'atteinte' ? <View style={{ height: 6, backgroundColor: c.line, borderRadius: 3 }}><View style={{ width: `${Math.round(st.ratio * 100)}%`, height: 6, backgroundColor: c.accent, borderRadius: 3 }} /></View> : null}
                {st.history.length ? <T v="small"><T v="small" style={{ fontWeight: '600' }}>Historique : </T>{st.history.join(' · ')}</T> : null}
                {st.status !== 'atteinte' ? <T v="small"><T v="small" style={{ fontWeight: '600' }}>Prochaine action : </T>{st.next}</T> : null}
              </View> : null}
            </View>
          </Pressable>
        </Row>
      ))}
    </View>
  );
}
function Journey() {
  const s = useApp(); const d = sportDay();
  return (<><T v="title">Mon parcours</T><T v="small" muted style={{ marginBottom: space.s4 }}>Des étapes mesurables. Touche une étape pour voir le critère et ta prochaine action.</T>
    <Track title="Running" steps={runningJourney(s, d)} /><Track title="Physique et renforcement" steps={bodyJourney(s, d)} /></>);
}
function Records() {
  const s = useApp(); const { c } = useTheme(); const d = sportDay(); const recs = recordsUntil(s, d); const ach = achievements(s, d);
  const Rec = ({ label, value, date }: { label: string; value: string; date?: string }) => (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s4 }}>
      <T v="xs" muted>{label}</T><T v="h2" style={{ fontFamily: 'ArchivoNarrow_700Bold', marginTop: 4 }}>{value}</T>{date ? <T v="xs" muted>{fmtShort(date)}</T> : null}
    </View>);
  const run = recs.filter(r => r.id.startsWith('run-')), str = recs.filter(r => r.id.startsWith('str-'));
  return (
    <>
      <T v="title">Records et paliers</T>
      <T v="h3" style={{ marginTop: space.s4, marginBottom: space.s2 }}>Running</T>
      {run.length ? <Row gap={space.s3} style={{ flexWrap: 'wrap' }}>{run.map(r => <Rec key={r.id} label={r.label} value={r.value} date={r.date} />)}</Row> : <T v="small" muted>Tes records apparaîtront après tes premières sorties et courses.</T>}
      <T v="h3" style={{ marginTop: space.s4, marginBottom: space.s2 }}>Renforcement</T>
      {str.length ? <Row gap={space.s3} style={{ flexWrap: 'wrap' }}>{str.map(r => <Rec key={r.id} label={r.label} value={r.value} date={r.date} />)}</Row> : <T v="small" muted>Note tes charges le dimanche : tes meilleures apparaîtront ici.</T>}
      <T v="h3" style={{ marginTop: space.s5, marginBottom: space.s2 }}>Paliers</T>
      {ach.map(a => (
        <Row key={a.id} gap={space.s3} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.r2, padding: space.s3, marginBottom: space.s2, opacity: a.date ? 1 : 0.55 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: a.date ? c.ink : c.surface2, alignItems: 'center', justifyContent: 'center' }}><Symbol size={22} color={a.date ? c.paper : c.ink2} /></View>
          <View style={{ flex: 1 }}><T v="label">{a.title}</T><T v="small" muted>{a.date ? `Atteint le ${fmtShort(a.date)}` : a.detail}</T></View>
        </Row>
      ))}
      <T v="xs" muted style={{ marginTop: space.s2 }}>Les records de vitesse ne viennent que de courses ou de tests sur la bonne distance. Une allure impossible (GPS) est ignorée.</T>
    </>
  );
}
