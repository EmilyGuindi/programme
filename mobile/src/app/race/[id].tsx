import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Bullets, Disclosure } from '@/components/guide';
import { Sheet } from '@/components/sheet';
import { Button, Card, Choices, Coach, Field, Gap, KV, Row, T, Tag, Tick } from '@/components/ui';
import { checklistFor, eventActivity, raceAnalysis, readiness, strategy, taperTips } from '@/engine/race';
import { clock, daysBetween, DAYS_SHORT, dow, fmtLong, fmtShort, mmss, sportDay } from '@/engine/dates';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const TYPE = { course: 'Course', ocr: 'Course à obstacles', 'hyrox-compet': 'HYROX', autre: 'Événement' } as const;

export default function RaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const s = useApp(); const { c } = useTheme();
  const ev = s.events.find(e => e.id === id);
  if (!ev) return <Sheet title="Événement introuvable"><T>Cet événement a été supprimé.</T></Sheet>;
  const d = sportDay(); const n = daysBetween(d, ev.date); const past = n < 0 || !!ev.result;
  const rd = readiness(s, ev, d); const st = strategy(s, ev); const act = eventActivity(s, ev);
  const setEv = (fn: (e: NonNullable<typeof ev>) => void) => update(x => { const e = x.events.find(y => y.id === id); if (e) fn(e); });
  return (
    <Sheet title={ev.name} sub={`${fmtLong(ev.date)}${ev.time ? ` · ${ev.time}` : ''}`}>
      <View style={{ backgroundColor: c.ink, borderRadius: radius.r2, padding: space.s5, marginBottom: space.s4 }}>
        <Row gap={6}><Tag tone="inverse">{TYPE[ev.type]}</Tag>{ev.distanceKm ? <Tag tone="inverse">{`${String(ev.distanceKm).replace('.', ',')} km`}</Tag> : null}<Tag tone="inverse">{ev.priority}</Tag></Row>
        <T v="mega" color={c.paper} style={{ marginTop: space.s3 }}>{past ? (ev.result ? clock(ev.result.time) : 'Terminé') : n === 0 ? "Aujourd'hui" : `J-${n}`}</T>
        <T color="rgba(244,242,238,.75)">{past ? (ev.result && ev.distanceKm ? `${mmss(ev.result.time / ev.distanceKm)} /km` : 'Saisis ton résultat pour le débrief') : ev.goal || ''}</T>
        {ev.place ? <T v="small" color="rgba(244,242,238,.6)" style={{ marginTop: 4 }}>{ev.place}</T> : null}
      </View>

      {past ? <Debrief /> : <>
        <Card>
          <Row between><T v="h3">Ta préparation</T><Tag tone="accent">{rd.label}</Tag></Row>
          <T v="small" style={{ marginTop: 6 }}>{rd.detail}</T>
          {rd.remaining.length ? <><T v="label" style={{ marginTop: space.s3 }}>{`D'ici là (${rd.remaining.length})`}</T>{rd.remaining.map(r => <T key={r.date} v="small" muted>{`${DAYS_SHORT[dow(r.date)]} ${fmtShort(r.date)} · ${r.title}`}</T>)}</> : null}
        </Card>
        <Coach>{taperTips(ev, d).join(' ')}</Coach>
        {st ? <Disclosure title="Ta stratégie de course" sub={st.mode === 'allure' ? `Objectif ${st.target}` : 'À l\'effort, sans chrono imposé'} open={n <= 3}>
          <T v="small" muted style={{ marginBottom: space.s3 }}>{st.basis}</T>
          {st.plan.map(p => <View key={p.km} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line }}><Row between><T v="label">{`Km ${p.km}`}</T>{p.pace ? <T v="label" color={c.accent}>{`${p.pace} /km`}</T> : null}</Row><T v="small">{p.cue}</T></View>)}
          <Gap h={space.s2} />
          <T v="small"><T v="small" style={{ fontWeight: '600' }}>Le départ : </T>{st.start}</T>
          <T v="small" style={{ marginTop: 6 }}><T v="small" style={{ fontWeight: '600' }}>Pendant : </T>{st.manage}</T>
          <T v="label" style={{ marginTop: space.s3 }}>Échauffement</T><Bullets items={st.warmup} numbered />
          <T v="label" style={{ marginTop: space.s3 }}>Plan B</T><Bullets items={st.planB} />
        </Disclosure> : <Disclosure title="Ta stratégie" sub="Gestion de l'effort" open={n <= 3}><Bullets items={ev.type === 'ocr' ? ['C\'est une course plaisir : pas de chrono à viser.', 'Cours entre les obstacles à effort 6/10, pour garder de l\'énergie pour les franchissements.', 'Sur les obstacles, sécurité d\'abord : contourne ceux qui sollicitent trop l\'épaule.', 'Bois aux ravitaillements.'] : ['Pars à un effort contrôlé, accélère sur la fin.', 'Pense technique plutôt que vitesse sur les stations.']} /></Disclosure>}
        <Disclosure title="Checklist" sub={`${Object.values(ev.checklist || {}).filter(Boolean).length}/${checklistFor(ev).length} prêts`}>
          {checklistFor(ev).map(item => <Row key={item} style={{ paddingVertical: 6 }}><Tick sizePx={28} on={!!ev.checklist?.[item]} label={item} onPress={() => setEv(e => { e.checklist = { ...(e.checklist || {}), [item]: !e.checklist?.[item] }; })} /><T style={{ flex: 1 }}>{item}</T></Row>)}
        </Disclosure>
      </>}
      <Gap />
      <Button label="Modifier l'événement" onPress={() => router.push({ pathname: '/event', params: { id: ev.id, edit: '1' } })} />
    </Sheet>
  );

  function Debrief() {
    const r = ev!.result; const analysis = raceAnalysis(s, ev!);
    return (
      <>
        {!r ? <Card>
          <T v="h3">Ton résultat</T>
          <T v="small" muted style={{ marginVertical: 6 }}>{act ? `Strava a rattaché ${act.title}${act.elapsedMin ? ` (${Math.round(act.elapsedMin)} min)` : ''}. Saisis ton temps officiel pour une analyse juste.` : 'Saisis ton temps officiel, il deviendra ta référence.'}</T>
          <Button kind="primary" block label="Saisir mon résultat" onPress={() => router.push({ pathname: '/result/[id]', params: { id: ev!.id } })} />
        </Card> : <>
          {!r.feeling ? <Card>
            <T v="h3">Débrief rapide</T>
            <Field label="Comment tu l'as vécue ?"><Choices options={[[1, 'Dur'], [2, 'Bof'], [3, 'Bien'], [4, 'Très bien'], [5, 'Top']]} value={r.feeling} onChange={v => setEv(e => { e.result!.feeling = v; })} /></Field>
            <Field label="Ta gestion d'allure"><Choices options={[['trop-vite', 'Parti trop vite'], ['regulier', 'Régulière'], ['fini-fort', 'Fini fort']]} value={r.pacing} onChange={v => setEv(e => { e.result!.pacing = v; })} /></Field>
            <Field label="Conditions" hint="facultatif"><Choices options={[['chaleur', 'Chaleur'], ['froid', 'Froid'], ['vent', 'Vent'], ['pluie', 'Pluie'], ['vallonné', 'Vallonné']]} value={null} onChange={v => v && setEv(e => { const cur = e.result!.conditions || []; e.result!.conditions = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; })} /></Field>
            {r.conditions?.length ? <T v="small" muted>{`Noté : ${r.conditions.join(', ')}`}</T> : null}
          </Card> : null}
          <Card>
            <T v="h3">Analyse</T>
            {analysis.map(a => <T key={a} v="small" style={{ marginTop: 6 }}>{a}</T>)}
            {r.elevM != null ? <KV k="Dénivelé" v={`${r.elevM} m`} /> : null}
            {r.effort ? <KV k="Effort ressenti" v={`${r.effort}/10`} /> : null}
          </Card>
          <Button block label="Modifier le résultat" onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push({ pathname: '/result/[id]', params: { id: ev!.id } }); }} />
        </>}
      </>
    );
  }
}
