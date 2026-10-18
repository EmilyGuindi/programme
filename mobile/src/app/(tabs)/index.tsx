import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { ActivityPrompts } from '@/components/activity-prompts';
import { Badge, Kicker, MetricPill, Stage } from '@/components/brand';
import { GlassSurface } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { Wordmark } from '@/components/logo';
import { markDone, openDay, openPlan, TYPE_LABEL } from '@/components/plan-row';
import { ProposalCard } from '@/components/proposal-card';
import { ContextCards } from '@/components/today-cards';
import { Button, Row, Screen, T } from '@/components/ui';
import { UpdateBanner } from '@/components/update-banner';
import { WeekMeter, WeekTracker } from '@/components/week-tracker';
import { SessionProgressLine } from '@/components/session-progress';
import { sessionProgress } from '@/engine/session';
import { weekSummary } from '@/engine/status';
import { activitiesOn, adapted, coachLine, doneOn, phaseOf, recovery, weekOf, weekStart } from '@/engine/coach';
import { addDays, clock, daysBetween, fmtLong, fmtShort, mmss, sportDay } from '@/engine/dates';
import { insights } from '@/engine/insights';
import { achievements } from '@/engine/journey';
import { eventState } from '@/engine/status';
import { newRecords } from '@/engine/records';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

function greeting(h = new Date().getHours()) { return h >= 5 && h < 12 ? 'Bonjour' : h >= 12 && h < 18 ? 'Bon après-midi' : h >= 18 && h < 22 ? 'Bonsoir' : 'Bonne nuit'; }
const LEVEL = { vert: 'Prête', orange: 'À adapter', rouge: 'Récupération', inconnu: 'Check-in' } as const;

export default function Today() {
  const [, tick] = useState(0);
  useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'active') tick(x => x + 1); }); const t = setInterval(() => tick(x => x + 1), 5 * 60 * 1000); return () => { sub.remove(); clearInterval(t); }; }, []);
  const s = useApp(); const { c } = useTheme();
  const d = sportDay(); const a = adapted(s, d); const r = recovery(s, d); const acts = activitiesOn(s, d);
  const shown = a.replaced || a; const done = doneOn(s, d); const isEvent = a.type === 'event';
  const finished = isEvent && !!a.event && eventState(s, a.event, d) === 'done';
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, d))); const ph = phaseOf(w); const ws = weekStart(s, w);
  const wk = weekSummary(s, ws, d); const sp = sessionProgress(s, d, d); const dur = a.replaced ? a.replaced.dur : a.dur;
  const wActs = s.activities.filter(x => x.date >= ws && x.date <= d && !x.complementary);
  const wMin = Math.round(wActs.reduce((t, x) => t + (x.durationMin || 0), 0)); const wKm = wActs.filter(x => x.type === 'running' || x.type === 'course').reduce((t, x) => t + (x.distanceKm || 0), 0);
  const lvlCol = { vert: c.ok, orange: c.warn, rouge: c.stop, inconnu: c.ink3 }[r.level];
  const recent = [...newRecords(s, addDays(d, -14), d).map(x => ({ t: `Record · ${x.label} : ${x.value}`, d: x.date })), ...achievements(s, d).filter(x => x.date && daysBetween(x.date, d) <= 14).map(x => ({ t: x.title, d: x.date! }))].sort((x, y) => y.d.localeCompare(x.d))[0];
  const trend = insights(s, d).find(i => i.level !== 'observation');
  const checkinFirst = r.level === 'inconnu' && !isEvent;

  const primary = done && shown.type !== 'renfo' ? null
    : isEvent ? { label: 'Ma stratégie et ma checklist', go: () => router.push({ pathname: '/race/[id]', params: { id: a.event!.id } }) }
    : shown.type === 'run' ? { label: sp.done ? 'Reprendre la séance' : 'Démarrer la séance', go: () => openPlan(a) }
    : shown.type === 'renfo' ? { label: sp.done ? 'Reprendre la séance' : 'Commencer', go: () => openPlan(a) }
    : shown.type === 'recup' ? { label: sp.done ? 'Reprendre la routine' : 'Ouvrir la routine', go: () => openDay(d) }
    : shown.type === 'box' ? { label: 'Marquer comme fait', go: () => markDone(a) }
    : null;

  return (
    <Screen>
      {/* A · En-tête */}
      <Row between style={{ paddingTop: space.s4, paddingBottom: space.s5 }}>
        <Wordmark height={13} />
        <GlassSurface r={24}>
          <Row gap={4} style={{ padding: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`État du jour : ${LEVEL[r.level]}. Ouvrir le check-in`} onPress={() => router.push('/checkin')} hitSlop={4} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20, backgroundColor: 'rgba(245,247,242,0.06)' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lvlCol }} /><T v="small" style={{ fontWeight: '600' }}>{LEVEL[r.level]}</T>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Profil" onPress={() => router.push('/profile')} hitSlop={4} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><T v="label" color={c.accentInk}>{s.user.name.charAt(0)}</T></Pressable>
          </Row>
        </GlassSurface>
      </Row>
      <UpdateBanner />
      <T v="small" muted>{`${fmtLong(d)} · semaine ${w}`}</T>
      <T v="title" style={{ marginTop: 2, marginBottom: space.s4 }}>{`${greeting()} ${s.user.name}`}</T>

      {/* B · Le focus du jour */}
      {finished ? (
        <Stage mark>
          <Kicker onStage>Course terminée</Kicker>
          <T v="title" color={c.stageInk} style={{ fontSize: 30, lineHeight: 35, marginTop: space.s2, maxWidth: '85%' }}>{a.event!.name}</T>
          <Row gap={8} style={{ alignItems: 'flex-end', marginTop: space.s3 }}>
            <T v="display" color={c.accent}>{a.event!.result ? clock(a.event!.result.time) : '—'}</T>
            <T v="small" color={c.stageInk2} style={{ paddingBottom: 8 }}>{a.event!.result?.source === 'montre' ? 'temps montre' : a.event!.distanceKm && a.event!.result ? `${mmss(a.event!.result.time / a.event!.distanceKm)} /km` : 'temps officiel'}</T>
          </Row>
          <Button kind="primary" block style={{ marginTop: space.s5 }} label={a.event!.result?.feeling ? 'Voir mon analyse' : 'Faire mon débrief'} onPress={() => router.push({ pathname: '/race/[id]', params: { id: a.event!.id } })} />
        </Stage>
      ) : (
        <Stage mark={isEvent || ['run', 'box', 'renfo'].includes(shown.type)} tone={['rest', 'recup'].includes(shown.type) && !isEvent ? 'plain' : 'ink'}>
          <Row between style={{ alignItems: 'flex-start', gap: space.s3 }}>
            <View style={{ flex: 1 }}><Kicker onStage>{isEvent ? 'Compétition · jour J' : `Aujourd'hui · ${TYPE_LABEL[shown.type]}${a.optional ? ' · optionnel' : ''}`}</Kicker></View>
            {done ? <T v="overline" color={c.accent}>{sp.adapted ? 'Faite, adaptée' : 'Faite'}</T> : sp.done ? <T v="overline" color={c.accent}>En cours</T> : a.reason ? <T v="overline" color={c.warn}>Adaptée</T> : null}
          </Row>
          <T v="title" color={c.stageInk} style={{ fontSize: ['rest', 'recup'].includes(shown.type) ? 24 : 30, lineHeight: ['rest', 'recup'].includes(shown.type) ? 30 : 35, marginTop: space.s2, maxWidth: '88%' }}>{shown.title}</T>
          {dur || (done && acts.some(x => x.calories)) ? <Row gap={8} style={{ marginTop: space.s3, flexWrap: 'wrap' }}>
            {dur ? <MetricPill icon={<Icon name="clock" size={15} color={c.accent} />} label={dur.replace(' au total', '')} /> : null}
            {done && acts.some(x => x.calories) ? <MetricPill icon={<Icon name="flame" size={15} color={c.accent} />} label={`${Math.round(acts.reduce((t, x) => t + (x.calories || 0), 0))} kcal estimées`} /> : null}
          </Row> : null}
          {done ? <T v="small" color={c.accent} style={{ marginTop: space.s3 }}>{`Fait · ${acts.filter(x => !x.complementary).map(x => [x.title, x.durationMin ? `${Math.round(x.durationMin)} min` : ''].filter(Boolean).join(' · ')).join(', ')}`}</T>
            : sp.done ? <View style={{ marginTop: space.s4 }}><SessionProgressLine p={sp} /></View>
            : <T color={c.stageInk} style={{ marginTop: space.s3, opacity: 0.85 }}>{coachLine(s, d)}</T>}
          <View style={{ marginTop: space.s5, gap: space.s2 }}>
            {checkinFirst ? <Button kind="primary" block label="Faire mon check-in · 30 s" onPress={() => router.push('/checkin')} />
              : primary ? <Button kind="primary" block label={primary.label} onPress={primary.go} /> : null}
            <Row gap={space.s4} style={{ flexWrap: 'wrap', rowGap: 0 }}>
              {checkinFirst && primary ? <Button small kind="ghost" label={primary.label} style={{ paddingHorizontal: 0 }} onPress={primary.go} /> : null}
              {!isEvent && !done && shown.type !== 'rest' ? <Button small kind="ghost" label="Adapter avec le coach" style={{ paddingHorizontal: 0 }} onPress={() => router.push('/coach')} /> : null}
              {done || shown.type === 'rest' ? <Button small kind="ghost" label="Détail du jour" style={{ paddingHorizontal: 0 }} onPress={() => openDay(d)} /> : null}
            </Row>
          </View>
        </Stage>
      )}

      <ProposalCard d={d} />
      <ContextCards d={d} />
      <ActivityPrompts />

      {/* C · La semaine */}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, paddingHorizontal: space.s2, marginBottom: space.s3 }}>
        <Row between style={{ paddingHorizontal: space.s2, marginBottom: space.s3 }}>
          <T v="small" muted style={{ fontWeight: '600' }}>Ta semaine</T>
          <T v="small" muted>{[wMin ? `${wMin} min` : '', wKm ? `${String(Math.round(wKm * 10) / 10).replace('.', ',')} km` : ''].filter(Boolean).join(' · ')}</T>
        </Row>
        <WeekTracker s={s} start={ws} today={d} onSelect={x => openDay(x)} />
        <WeekMeter w={wk} />
      </View>

      {/* E · Actions utiles */}
      <Row gap={space.s2} style={{ marginBottom: space.s3 }}>
        {([['coach', 'Coach', () => router.push('/coach')], ['plus', 'Ajouter une activité', () => router.push({ pathname: '/activity', params: { date: d } })]] as [IconName, string, () => void][]).map(([ic, l, go]) => (
          <Pressable key={l} accessibilityRole="button" accessibilityLabel={l} onPress={go} style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: radius.r2, backgroundColor: pressed ? c.surface2 : c.surface, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' })}>
            <Icon name={ic} size={18} color={c.ink} /><T v="label">{l}</T>
          </Pressable>))}
      </Row>

      {/* F · Progrès personnel */}
      {recent || trend ? (
        <Pressable onPress={() => router.push('/progress')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', gap: space.s3, alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, opacity: pressed ? 0.88 : 1 })}>
          {recent ? <Badge achieved size={40} /> : <Icon name="chevrons" size={22} color={c.accent} />}
          <View style={{ flex: 1 }}><T v="xs" muted style={{ fontWeight: '600' }}>{recent ? `Récent · ${fmtShort(recent.d)}` : 'Ce qui évolue'}</T><T v="label">{recent ? recent.t : trend!.text}</T></View>
        </Pressable>) : null}
    </Screen>
  );
}
