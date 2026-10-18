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
import { Button, Chevron, Chip, Panel, Row, Screen, T } from '@/components/ui';
import { UpdateBanner } from '@/components/update-banner';
import { WeekMeter, WeekTracker } from '@/components/week-tracker';
import { SessionProgressLine } from '@/components/session-progress';
import { sessionProgress } from '@/engine/session';
import { weekSummary } from '@/engine/status';
import { activitiesOn, adapted, coachLine, doneOn, phaseOf, recovery, weekOf, weekStart } from '@/engine/coach';
import { addDays, clock, daysBetween, fmtLong, fmtShort, mmss, sportDay } from '@/engine/dates';
import { insights } from '@/engine/insights';
import { achievementsMemo, toCelebrate, unlocked, type Achievement } from '@/engine/achievements';
import { UnlockMoment } from '@/components/achievement-ui';
import { AchBadge } from '@/components/badges';
import { eventState } from '@/engine/status';
import { newRecords } from '@/engine/records';
import { update, useApp } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme/tokens';

function greeting(h = new Date().getHours()) { return h >= 5 && h < 12 ? 'Bonjour' : h >= 12 && h < 18 ? 'Bon après-midi' : h >= 18 && h < 22 ? 'Bonsoir' : 'Bonne nuit'; }
const LEVEL = { vert: 'Prête', orange: 'À adapter', rouge: 'Récupération', inconnu: 'Check-in' } as const;

export default function Today() {
  const [, tick] = useState(0);
  useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'active') tick(x => x + 1); }); const t = setInterval(() => tick(x => x + 1), 5 * 60 * 1000); return () => { sub.remove(); clearInterval(t); }; }, []);
  const s = useApp(); const { c } = useTheme();
  const d = sportDay(); const a = adapted(s, d); const r = recovery(s, d); const acts = activitiesOn(s, d);
  const shown = a.replaced || a; const done = doneOn(s, d); const isEvent = a.type === 'event';
  const finished = isEvent && !!a.event && eventState(s, a.event, d) === 'done';
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, d))); const ph = phaseOf(w, s.program); const ws = weekStart(s, w);
  const wk = weekSummary(s, ws, d); const sp = sessionProgress(s, d, d); const dur = a.replaced ? a.replaced.dur : a.dur;
  const wActs = s.activities.filter(x => x.date >= ws && x.date <= d && !x.complementary);
  const wMin = Math.round(wActs.reduce((t, x) => t + (x.durationMin || 0), 0)); const wKm = wActs.filter(x => x.type === 'running' || x.type === 'course').reduce((t, x) => t + (x.distanceKm || 0), 0);
  const lvlCol = { vert: c.ok, orange: c.warn, rouge: c.stop, inconnu: c.ink3 }[r.level];
  const recent = [...newRecords(s, addDays(d, -14), d).map(x => ({ t: `${x.label} : ${x.value}`, d: x.date })), ...unlocked(s, d, achievementsMemo(s, d)).filter(x => daysBetween(x.date!, d) <= 14).map(x => ({ t: x.title, d: x.date!, a: x }))].sort((x, y) => y.d.localeCompare(x.d))[0] as { t: string; d: string; a?: Achievement } | undefined;
  const celebrating = toCelebrate(s, d, achievementsMemo(s, d)).length > 0;
  const trend = insights(s, d).find(i => i.level !== 'observation');
  const checkinFirst = r.level === 'inconnu' && !isEvent;
  const kcal = done ? Math.round(acts.reduce((t, x) => t + (x.calories || 0), 0)) : 0;
  // Un seul statut affiché : le plus utile.
  const status: { label: string; tone: 'lime' | 'accent' | 'warn' | 'stage' | 'ok' } | null = isEvent ? { label: 'Jour J', tone: 'accent' }
    : done ? { label: sp.adapted ? 'Faite, adaptée' : 'Faite', tone: 'accent' } : sp.done ? { label: 'En cours', tone: 'accent' } : a.reason ? { label: 'Adaptée', tone: 'warn' } : a.optional ? { label: 'Optionnelle', tone: 'stage' } : null;
  const openWeek = (date?: string) => router.navigate({ pathname: '/program', params: date ? { date } : {} });

  const primary = done && shown.type !== 'renfo' ? null
    : isEvent ? { label: 'Ma stratégie et ma checklist', go: () => router.push({ pathname: '/race/[id]', params: { id: a.event!.id } }) }
    : shown.type === 'run' ? { label: sp.done ? 'Reprendre la séance' : 'Démarrer la séance', go: () => openPlan(a) }
    : shown.type === 'renfo' ? { label: sp.done ? 'Reprendre la séance' : 'Commencer', go: () => openPlan(a) }
    : shown.type === 'recup' ? { label: sp.done ? 'Reprendre la routine' : 'Ouvrir la routine', go: () => openDay(d) }
    : shown.type === 'box' ? { label: 'Marquer comme fait', go: () => markDone(a) }
    : null;
  const links = [checkinFirst && primary ? { label: primary.label, go: primary.go } : null, !isEvent && !done && shown.type !== 'rest' ? { label: 'Adapter avec le coach', go: () => router.push('/coach') } : null,
    done || shown.type === 'rest' ? { label: 'Détail du jour', go: () => openDay(d) } : null].filter(Boolean).slice(0, 2) as { label: string; go: () => void }[];

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
      <T v="small" muted>{fmtLong(d)}</T>
      <T v="title" style={{ marginTop: 2, marginBottom: space.s4 }}>{`${greeting()} ${s.user.name}`}</T>

      {/* 1 · L'action du jour */}
      {finished ? (
        <Stage mark>
          <Row between><Kicker onStage>Compétition</Kicker><Chip tone="stage" label="Terminée" /></Row>
          <T v="title" color={c.stageInk} style={{ marginTop: space.s2 }}>{a.event!.name}</T>
          <Row gap={8} style={{ alignItems: 'flex-end', marginTop: space.s3 }}>
            <T v="display" color={c.accent}>{a.event!.result ? clock(a.event!.result.time) : '—'}</T>
            <T v="small" color={c.stageInk2} style={{ paddingBottom: 8 }}>{a.event!.result?.source === 'montre' ? 'temps montre' : a.event!.distanceKm && a.event!.result ? `${mmss(a.event!.result.time / a.event!.distanceKm)} /km` : 'temps officiel'}</T>
          </Row>
          <Button kind="primary" block style={{ marginTop: space.s4 }} label={a.event!.result?.feeling ? 'Voir mon analyse' : 'Faire mon débrief'} onPress={() => router.push({ pathname: '/race/[id]', params: { id: a.event!.id } })} />
        </Stage>
      ) : (
        <Stage mark={isEvent || ['run', 'box', 'renfo'].includes(shown.type)} tone={['rest', 'recup'].includes(shown.type) && !isEvent ? 'plain' : 'ink'}>
          <Row between style={{ minHeight: 24, gap: space.s2 }}>
            <Kicker onStage>{isEvent ? 'Compétition' : TYPE_LABEL[shown.type]}</Kicker>
            {status ? <Chip tone={status.tone} label={status.label} /> : null}
          </Row>
          <T v="title" color={c.stageInk} style={{ marginTop: space.s2 }}>{shown.title}</T>
          {dur || kcal ? <Row gap={8} style={{ marginTop: space.s3, flexWrap: 'wrap' }}>
            {dur ? <MetricPill icon={<Icon name="clock" size={15} color={c.accent} />} label={dur.replace(' au total', '')} /> : null}
            {kcal ? <MetricPill icon={<Icon name="flame" size={15} color={c.accent} />} label={`${kcal} kcal`} /> : null}
          </Row> : null}
          {done ? <View style={{ marginTop: space.s3, gap: 2 }}>{acts.filter(x => !x.complementary).map(x => <T key={x.id} v="small" color={c.stageInk2}>{x.durationMin ? `${x.title}, ${Math.round(x.durationMin)} min` : x.title}</T>)}</View>
            : sp.done ? <View style={{ marginTop: space.s4 }}><SessionProgressLine p={sp} /></View>
            : <T color={c.stageInk2} style={{ marginTop: space.s3 }}>{coachLine(s, d)}</T>}
          <View style={{ marginTop: space.s4 }}>
            {checkinFirst ? <Button kind="primary" block label="Faire mon check-in" onPress={() => router.push('/checkin')} />
              : primary ? <Button kind="primary" block label={primary.label} onPress={primary.go} /> : null}
            {links.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s5, marginTop: space.s1 }}>
              {links.map(l => <Button key={l.label} small kind="ghost" label={l.label} style={{ paddingHorizontal: 0 }} onPress={l.go} />)}
            </View> : null}
          </View>
        </Stage>
      )}

      <ProposalCard d={d} />
      {/* 2 · L'événement à venir, débrief, bilan */}
      <ContextCards d={d} />
      <ActivityPrompts />

      {/* 3 · La semaine : toucher la carte ouvre le planning */}
      <Pressable accessibilityRole="button" accessibilityLabel={`Ta semaine, ${wk.done} séances sur ${wk.planned}. Ouvrir le planning`} onPress={() => openWeek()}
        style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, padding: layout.pad, marginBottom: layout.gap })}>
        <Row between style={{ marginBottom: space.s3 }}>
          <T v="label">Ta semaine</T>
          <Row gap={6}><T v="small" muted>{`Semaine ${w} sur ${s.program.weeks}`}</T><Chevron /></Row>
        </Row>
        <WeekTracker s={s} start={ws} today={d} onSelect={x => openWeek(x)} />
        <WeekMeter w={wk} extra={[wMin ? `${wMin} min` : null, wKm ? `${String(Math.round(wKm * 10) / 10).replace('.', ',')} km` : null]} />
      </Pressable>

      {/* Raccourcis */}
      <Row gap={layout.gap} style={{ marginBottom: layout.gap }}>
        {([['coach', 'Coach', () => router.push('/coach')], ['plus', 'Ajouter', () => router.push({ pathname: '/activity', params: { date: d } })]] as [IconName, string, () => void][]).map(([ic, l, go]) => (
          <Pressable key={l} accessibilityRole="button" accessibilityLabel={l} onPress={go} style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: radius.r2, backgroundColor: pressed ? c.surface2 : c.surface, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' })}>
            <Icon name={ic} size={18} color={c.ink} /><T v="label">{l}</T>
          </Pressable>))}
      </Row>

      {/* 4 · Accomplissement significatif : mis en scène une fois, puis rappelé en une ligne */}
      <UnlockMoment />
      {!celebrating && (recent || trend) ? (
        <Panel onPress={() => router.push('/progress')} accessibilityLabel={recent ? recent.t : trend!.text}>
          <Row gap={space.s3}>
            {recent?.a ? <AchBadge cat={recent.a.cat} status="unlocked" major={recent.a.tier === 'major'} size={44} /> : recent ? <Badge achieved size={40} /> : <Icon name="stats" size={22} color={c.accent} />}
            <View style={{ flex: 1 }}>
              <Row between><T v="small" muted style={{ fontWeight: '600' }}>{recent ? 'Récent' : 'Ce qui évolue'}</T>{recent ? <T v="small" muted>{fmtShort(recent.d)}</T> : null}</Row>
              <T v="label" style={{ marginTop: 2 }}>{recent ? recent.t : trend!.text}</T>
            </View>
          </Row>
        </Panel>) : null}
    </Screen>
  );
}
