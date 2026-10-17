import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { ActivityPrompts } from '@/components/activity-prompts';
import { Kicker, Stage } from '@/components/brand';
import { WeekTracker } from '@/components/week-tracker';
import { eventActivity } from '@/engine/race';
import { clock, mmss } from '@/engine/dates';
import { Wordmark } from '@/components/logo';
import { openDay, openPlan, presetFor, TYPE_LABEL } from '@/components/plan-row';
import { ProposalCard } from '@/components/proposal-card';
import { ContextCards } from '@/components/today-cards';
import { Button, ListGroup, ListRow, Row, Screen, T } from '@/components/ui';
import { UpdateBanner } from '@/components/update-banner';
import { activitiesOn, adapted, coachLine, doneOn, phaseOf, planFor, recovery, weekOf, weekStart } from '@/engine/coach';
import { addDays, fmtLong, sportDay } from '@/engine/dates';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

function greeting(h = new Date().getHours()) {
  if (h >= 5 && h < 12) return 'Bonjour';
  if (h >= 12 && h < 18) return 'Bon après-midi';
  if (h >= 18 && h < 22) return 'Bonsoir';
  return 'Bonne nuit';
}
const LEVEL = { vert: 'Prête', orange: 'À adapter', rouge: 'Récupération', inconnu: 'Check-in à faire' } as const;

export default function Today() {
  const [, tick] = useState(0);
  useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'active') tick(x => x + 1); }); const t = setInterval(() => tick(x => x + 1), 5 * 60 * 1000); return () => { sub.remove(); clearInterval(t); }; }, []);
  const s = useApp(); const { c } = useTheme();
  const d = sportDay(); const a = adapted(s, d); const r = recovery(s, d); const acts = activitiesOn(s, d);
  const shown = a.replaced || a; const tmr = adapted(s, addDays(d, 1)); const done = doneOn(s, d);
  const isEvent = a.type === 'event';
  const finishedAct = isEvent && a.event ? eventActivity(s, a.event) : undefined; const finished = isEvent && !!(a.event?.result || finishedAct); const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, d))); const ph = phaseOf(w);
  const lvlCol = { vert: c.ok, orange: c.warn, rouge: c.stop, inconnu: c.ink3 }[r.level];
  const isRest = shown.type === 'rest';
  const ws = weekStart(s, w);
  const week = Array.from({ length: 7 }, (_, i) => { const x = addDays(ws, i); const p = adapted(s, x); return { x, p, done: doneOn(s, x) }; });
  const plannedW = week.filter(q => q.p.mandatory && !q.p.skipped && q.p.type !== 'event' && q.x >= s.user.startDate); const doneW = plannedW.filter(q => q.done).length;

  return (
    <Screen>
      <Row between style={{ paddingTop: space.s4, paddingBottom: space.s4 }}>
        <Wordmark height={14} />
        <Pressable accessibilityRole="button" accessibilityLabel={`État du jour : ${LEVEL[r.level]}. Ouvrir le check-in`} onPress={() => router.push('/checkin')} hitSlop={8}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: pressed ? c.line2 : c.surface })}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lvlCol }} /><T v="small" style={{ fontWeight: '600' }}>{LEVEL[r.level]}</T>
        </Pressable>
      </Row>
      <UpdateBanner />

      <Kicker>{`${fmtLong(d)} · S${w} · ${ph.name}`}</Kicker>
      <T v="title" style={{ fontSize: 32, lineHeight: 38, marginTop: space.s2, marginBottom: space.s4 }}>{`${greeting()} ${s.user.name}.`}</T>

      {r.level === 'inconnu' ? (
        <Pressable onPress={() => router.push('/checkin')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: c.accent, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s3, opacity: pressed ? 0.9 : 1 })}>
          <View style={{ flex: 1 }}><T v="label" color="#fff">Comment tu te sens ?</T><T v="small" color="rgba(255,255,255,0.8)">30 secondes pour adapter ta journée.</T></View><T v="h2" color="#fff">›</T>
        </Pressable>
      ) : null}

      {/* La séance du jour : la scène de l'écran */}
      {finished ? (
        <Stage mark glow>
          <Kicker onStage>Course terminée</Kicker>
          <T v="title" color={c.stageInk} style={{ fontSize: 30, lineHeight: 35, marginTop: space.s3, maxWidth: '85%' }}>{a.event!.name}</T>
          <Row gap={8} style={{ alignItems: 'flex-end', marginTop: space.s3 }}>
            <T v="display" color={c.stageInk}>{a.event!.result ? clock(a.event!.result.time) : finishedAct?.elapsedMin ? `${Math.floor(finishedAct.elapsedMin / 60) ? `${Math.floor(finishedAct.elapsedMin / 60)}h` : ''}${String(Math.round(finishedAct.elapsedMin % 60)).padStart(2, '0')}` : '—'}</T>
            <T v="small" color={c.stageInk2} style={{ paddingBottom: 8 }}>{a.event!.result ? (a.event!.distanceKm ? `${mmss(a.event!.result.time / a.event!.distanceKm)} /km` : 'temps officiel') : 'durée Strava'}</T>
          </Row>
          <T color={c.stageInk} style={{ marginTop: space.s3, opacity: 0.9 }}>{a.event!.result?.feeling ? 'Débrief fait. Récupère bien, la suite s\'ajuste.' : 'Deux minutes pour ton débrief : il prépare la suite.'}</T>
          <Button kind="inverse" block style={{ marginTop: space.s5 }} label={a.event!.result?.feeling ? 'Voir mon analyse' : a.event!.result ? 'Faire mon débrief' : 'Saisir mon temps officiel'} onPress={() => a.event!.result ? router.push({ pathname: '/race/[id]', params: { id: a.event!.id } }) : router.push({ pathname: '/result/[id]', params: { id: a.event!.id } })} />
        </Stage>
      ) : (
      <Stage mark={isEvent} glow={isEvent}>
        <Row between>
          <Kicker onStage>{isEvent ? 'Compétition' : `Ta journée · ${TYPE_LABEL[shown.type]}${a.optional ? ' · optionnel' : ''}`}</Kicker>
          {done && !isEvent ? <T v="overline" color={c.ok}>Fait</T> : a.reason ? <T v="overline" color={c.warn}>Adaptée</T> : null}
        </Row>
        <T v="title" color={c.stageInk} style={{ fontSize: 30, lineHeight: 35, marginTop: space.s3, maxWidth: '88%' }}>{shown.title}</T>
        {(a.replaced ? '' : a.dur) ? <T color={c.stageInk2} style={{ marginTop: 4 }}>{a.dur}</T> : null}
        {done ? <T v="small" color={c.stageInk2} style={{ marginTop: 4 }}>{`Réalisé : ${acts.filter(x => !x.complementary).map(x => [x.title, x.durationMin ? `${Math.round(x.durationMin)} min` : '', x.calories ? `${Math.round(x.calories)} kcal estimées` : ''].filter(Boolean).join(' · ')).join(', ')}`}</T> : null}
        <T color={c.stageInk} style={{ marginTop: space.s3, opacity: 0.9 }}>{coachLine(s, d)}</T>
        <View style={{ marginTop: space.s5, gap: space.s2 }}>
          {done && shown.type !== 'renfo' ? null
            : isEvent ? <Button kind="inverse" block label="Ma stratégie et ma checklist" onPress={() => router.push({ pathname: '/race/[id]', params: { id: a.event!.id } })} />
            : shown.type === 'run' ? <Button kind="primary" block label="Voir la séance" onPress={() => openPlan(a)} />
            : shown.type === 'renfo' ? <Row><Button kind="primary" label="Commencer" style={{ flex: 1 }} onPress={() => openPlan(a)} /><Button kind="inverse" label="Je passe" onPress={() => update(st => { st.overrides[d] = { ...(st.overrides[d] || {}), level: 'rouge' }; })} /></Row>
            : shown.type === 'box' || shown.type === 'recup' ? <Button kind="primary" block label="Marquer comme fait" onPress={() => router.push({ pathname: '/activity', params: { date: d, preset: a.replaced ? 'marche' : presetFor(a) } })} />
            : null}
          <Row>
            <Button small kind="ghost" label="Détail du jour" style={{ paddingHorizontal: 0 }} onPress={() => openDay(d)} />
            {a.reason && !s.overrides[d]?.adj && !s.overrides[d]?.keep && (r.level === 'orange' || r.level === 'rouge') && planFor(s, d).type !== 'box' ? <Button small kind="ghost" label="Garder la séance prévue" style={{ paddingHorizontal: 0, marginLeft: 'auto' }} onPress={() => update(st => { st.overrides[d] = { ...(st.overrides[d] || {}), keep: true }; })} /> : null}
            {s.overrides[d]?.adj ? <Button small kind="ghost" label="Revenir au prévu" style={{ paddingHorizontal: 0, marginLeft: 'auto' }} onPress={() => update(st => { delete st.overrides[d].adj; })} /> : null}
          </Row>
        </View>
      </Stage>)}
      {r.level !== 'inconnu' ? <T v="small" muted style={{ marginBottom: space.s4 }}>{r.reasons[0]}</T> : <View style={{ height: space.s2 }} />}

      <ProposalCard d={d} />
      <ContextCards d={d} />
      <ActivityPrompts />

      {/* La semaine : le même tracker que Programme */}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, paddingVertical: space.s3, paddingHorizontal: space.s2, marginBottom: space.s3 }}>
        <Row between style={{ paddingHorizontal: space.s2, marginBottom: space.s2 }}><T v="label">Ta semaine</T><T v="small" muted>{plannedW.length ? `${doneW} sur ${plannedW.length}` : ''}</T></Row>
        <WeekTracker s={s} start={ws} today={d} onSelect={x => openDay(x)} />
      </View>

      <ListGroup title="Aujourd'hui">
        {acts.map(x => <ListRow key={x.id} title={x.title} sub={[x.durationMin ? `${Math.round(x.durationMin)} min` : '', x.distanceKm ? `${String(x.distanceKm).replace('.', ',')} km` : '', x.calories ? `${Math.round(x.calories)} kcal estimées` : '', x.complementary ? 'complémentaire' : '', x.source === 'strava' ? 'Strava' : ''].filter(Boolean).join(' · ')} onPress={() => router.push({ pathname: '/activity', params: { id: x.id } })} />)}
        <ListRow last title="Ajouter une activité" left={<T v="h3" color={c.accent}>+</T>} chevron={false} onPress={() => router.push({ pathname: '/activity', params: { date: d } })} />
      </ListGroup>
      {tmr.type === 'event' ? null : <ListGroup title="Demain">
        <ListRow last title={(tmr.replaced || tmr).title} sub={[tmr.dur, tmr.optional ? 'optionnel' : ''].filter(Boolean).join(' · ') || undefined} onPress={() => openDay(addDays(d, 1))} />
      </ListGroup>}
    </Screen>
  );
}
