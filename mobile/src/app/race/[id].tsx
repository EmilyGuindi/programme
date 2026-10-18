import { haptic } from '@/feedback';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Bullets, Disclosure } from '@/components/guide';
import { Countdown, EffortProfile, Kicker, Ring, Stage } from '@/components/brand';
import { Pressable } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Choices, Coach, Field, Gap, KV, ListGroup, ListRow, Meta, Row, T, Tag, Tick } from '@/components/ui';
import { checklistFor, eventActivity, raceAnalysis, readiness, strategy, taperTips } from '@/engine/race';
import { eventState } from '@/engine/status';
import { clock, daysBetween, DAYS_SHORT, dow, fmtLong, fmtShort, mmss, sportDay } from '@/engine/dates';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const TYPE = { course: 'Course', ocr: 'Course à obstacles', 'hyrox-compet': 'HYROX', autre: 'Événement' } as const;

export default function RaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const s = useApp(); const { c } = useTheme();
  const ev = s.events.find(e => e.id === id);
  if (!ev) return <Sheet title="Événement introuvable"><T>Cet événement a été supprimé.</T></Sheet>;
  const d = sportDay(); const n = daysBetween(d, ev.date); const evs = eventState(s, ev, d); const past = evs === 'done' || evs === 'toConfirm';
  const rd = readiness(s, ev, d); const st = strategy(s, ev); const act = eventActivity(s, ev);
  const setEv = (fn: (e: NonNullable<typeof ev>) => void) => update(x => { const e = x.events.find(y => y.id === id); if (e) fn(e); });
  return (
    <Sheet title={past ? 'Débrief' : 'Préparation'} sub={fmtLong(ev.date)}>
      <Stage glow mark>
        <Row between style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: space.s3 }}>
            <Kicker onStage>{TYPE[ev.type]}</Kicker>
            <T v="title" color={c.stageInk} style={{ marginTop: space.s3 }}>{ev.name}</T>
            <Meta color={c.stageInk2} style={{ marginTop: 4 }} items={[ev.distanceKm ? `${String(ev.distanceKm).replace('.', ',')} km` : null, ev.time ? `départ ${ev.time.replace(':', ' h ')}` : null]} />{ev.place ? <T v="small" color={c.stageInk2} style={{ marginTop: 2 }}>{ev.place.replace(' · ', ', ')}</T> : null}
          </View>
          {!past ? <Countdown days={n} /> : null}
        </Row>
        {past ? <View style={{ marginTop: space.s4 }}>
          <T v="display" color={c.stageInk}>{ev.result ? clock(ev.result.time) : 'Terminé'}</T>
          <T color={c.stageInk2}>{ev.result ? (ev.result.source === 'montre' ? 'temps relevé par ta montre' : ev.distanceKm ? `${mmss(ev.result.time / ev.distanceKm)} /km de moyenne` : 'temps officiel') : 'Saisis ton résultat pour le débrief'}</T>
        </View> : ev.goal ? <View style={{ marginTop: space.s4, borderTopWidth: 1, borderTopColor: 'rgba(244,242,238,0.14)', paddingTop: space.s3 }}><T v="overline" color={c.stageInk2}>Objectif</T><T color={c.stageInk} style={{ marginTop: 2 }}>{ev.goal}</T></View> : null}
      </Stage>

      {past ? <Debrief /> : <>
        <Row gap={space.s3} style={{ marginBottom: space.s3 }}>
          <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4 }}>
            <T v="overline" muted>Préparation</T><T v="h3" style={{ marginTop: 4 }}>{rd.label}</T>
          </View>
          <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4 }}>
            <T v="overline" muted>D'ici là</T><T v="h3" style={{ marginTop: 4 }}>{`${rd.remaining.length} séance${rd.remaining.length > 1 ? 's' : ''}`}</T>
          </View>
        </Row>
        <T v="small" muted style={{ marginBottom: space.s4 }}>{rd.detail}</T>
        <Kicker>{n <= 2 ? 'Les dernières heures' : 'Cette semaine'}</Kicker>
        <View style={{ marginTop: space.s2, marginBottom: space.s4 }}>{taperTips(ev, d).map((t, i) => <Row key={t} gap={space.s3} style={{ alignItems: 'flex-start', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}><T v="num" color={c.accent} style={{ width: 22, fontSize: 18 }}>{i + 1}</T><T style={{ flex: 1 }}>{t}</T></Row>)}</View>
        {rd.remaining.length ? <ListGroup title="Séances restantes">{rd.remaining.map((r, i) => <ListRow key={r.date} last={i === rd.remaining.length - 1} title={r.title} sub={`${DAYS_SHORT[dow(r.date)]} ${fmtShort(r.date)}`} onPress={() => router.push({ pathname: '/day/[date]', params: { date: r.date } })} />)}</ListGroup> : null}
        {st ? <>
          <Kicker>Ta stratégie</Kicker>
          <Stage mark={false} style={{ marginTop: space.s2 }}>
            <T v="overline" color={c.stageInk2}>{st.mode === 'allure' ? 'Allure cible' : 'À l\'effort ressenti'}</T>
            <T v="title" color={c.stageInk} style={{ marginTop: 4 }}>{st.mode === 'allure' ? st.target! : 'Pars facile, finis fort'}</T>
            <View style={{ marginTop: space.s4 }}><EffortProfile km={Math.round(ev.distanceKm || 10)} levels={effortLevels(st, Math.round(ev.distanceKm || 10))} /></View>
            <View style={{ marginTop: space.s4, gap: space.s3 }}>
              {st.plan.map(p => <Row key={p.km} gap={space.s3} style={{ alignItems: 'flex-start' }}><View style={{ minWidth: 64 }}><T v="overline" color={c.stageInk2}>{`Km ${p.km}`}</T>{p.pace ? <T v="label" color={c.stageInk}>{p.pace}</T> : null}</View><T v="small" color={c.stageInk} style={{ flex: 1 }}>{p.cue}</T></Row>)}
            </View>
            <T v="xs" color={c.stageInk2} style={{ marginTop: space.s4 }}>{st.basis}</T>
          </Stage>
          <Disclosure title="Départ, échauffement et plan B" sub="À relire la veille">
            <T v="small"><T v="small" style={{ fontWeight: '600' }}>Le départ : </T>{st.start}</T>
            <T v="small" style={{ marginTop: 6 }}><T v="small" style={{ fontWeight: '600' }}>Pendant : </T>{st.manage}</T>
            <T v="label" style={{ marginTop: space.s3 }}>Échauffement</T><Bullets items={st.warmup} numbered />
            <T v="label" style={{ marginTop: space.s3 }}>Plan B</T><Bullets items={st.planB} />
          </Disclosure>
        </> : <><Kicker>Ta stratégie</Kicker><View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginTop: space.s2, marginBottom: space.s3 }}><Bullets items={ev.type === 'ocr' ? ['Course plaisir : pas de chrono à viser.', 'Entre les obstacles, effort 6/10 pour garder de l\'énergie.', 'Contourne les obstacles qui sollicitent trop l\'épaule.', 'Bois aux ravitaillements.'] : ['Pars à un effort contrôlé, accélère sur la fin.', 'Pense technique plutôt que vitesse sur les stations.']} /></View></>}
        {(() => { const items = checklistFor(ev); const ok = items.filter(x => ev.checklist?.[x]).length; return (
          <View style={{ marginTop: space.s4 }}>
            <Row between style={{ marginBottom: space.s2 }}><Kicker>Checklist</Kicker><Ring value={ok / items.length} label={`${ok}/${items.length}`} /></Row>
            <ListGroup>{items.map((item, i) => { const on = !!ev.checklist?.[item]; return (
              <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { haptic('select'); setEv(e => { e.checklist = { ...(e.checklist || {}), [item]: !on }; }); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 52, paddingHorizontal: space.s4, borderTopWidth: i ? 0.5 : 0, borderTopColor: c.line2, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
                <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: on ? 0 : 1.5, borderColor: c.ink3, backgroundColor: on ? c.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <T v="xs" color={c.paper} style={{ fontWeight: '700' }}>✓</T> : null}</View>
                <T style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none', color: on ? c.ink3 : c.ink }}>{item}</T>
              </Pressable>); })}</ListGroup>
          </View>); })()}
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
          <T v="small" muted style={{ marginVertical: 6 }}>{act ? `Strava a rattaché ${act.title}${act.elapsedMin ? ` (${Math.round(act.elapsedMin)} min)` : ''}. Saisis ton temps officiel pour une analyse juste.` : 'Aucune activité Strava rattachée pour l\'instant. Saisis ton temps officiel, il deviendra ta référence.'}</T>
          <Button kind="primary" block label="Saisir mon résultat" onPress={() => router.push({ pathname: '/result/[id]', params: { id: ev!.id } })} />
          {!act ? <Button small kind="ghost" label="Je n'y ai pas participé" style={{ alignSelf: 'center', marginTop: 4 }} onPress={() => setEv(e => { e.status = 'annulé'; })} /> : null}
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
          <Button block label="Modifier le résultat" onPress={() => { haptic('select'); router.push({ pathname: '/result/[id]', params: { id: ev!.id } }); }} />
        </>}
      </>
    );
  }
}

function effortLevels(st: NonNullable<ReturnType<typeof strategy>>, km: number): number[] {
  return Array.from({ length: km }, (_, i) => { const k = i + 1; if (st.mode === 'allure') return k === 1 ? 6.5 : k >= km - 1 ? 8.5 : 7.5; return k <= 2 ? 6 : k >= km - 2 ? 8.5 : 7; });
}
