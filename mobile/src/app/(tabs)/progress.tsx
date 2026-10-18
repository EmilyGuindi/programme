import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icons';
import { Badge, Kicker, Stage, StepMark } from '@/components/brand';
import { Insights } from '@/components/insights';
import { energy } from '@/engine/energy';
import { ListGroup, ListRow, Row, Screen, T } from '@/components/ui';
import { adapted, doneOn, weekOf, weekStart, weightSeries } from '@/engine/coach';
import { addDays, daysBetween, fmtShort, mmss, sportDay } from '@/engine/dates';
import { bodyJourney, chapters, runningJourney, weekSuccess } from '@/engine/journey';
import { achievementsMemo, nextMilestone, toCelebrate } from '@/engine/achievements';
import { MilestoneRow, UnlockMoment } from '@/components/achievement-ui';
import { AchBadge } from '@/components/badges';
import { availableRecaps } from '@/engine/recap';
import { newRecords, recordsUntil } from '@/engine/records';
import { useApp } from '@/store/store';
import { eventState } from '@/engine/status';
import { radius, space, useTheme } from '@/theme/tokens';

const go = (view: string) => router.push({ pathname: '/progress/[view]', params: { view } });

export default function Progress() {
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, today))); const ws = weekStart(s, w);
  let planned = 0, done = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d > today) break; const a = adapted(s, d); if (a.mandatory && !a.skipped && a.type !== 'event') { planned++; if (doneOn(s, d)) done++; } }
  const past = weekSuccess(s, today);
  const runStep = runningJourney(s, today).find(x => x.status === 'en cours');
  const bodyStep = bodyJourney(s, today).find(x => x.status === 'en cours');
  const recs = recordsUntil(s, today); const best10 = recs.find(r => r.id === 'run-10k'); const ev = s.events.filter(e => e.type === 'course' && ['upcoming', 'today'].includes(eventState(s, e, today))).sort((a, b) => a.date.localeCompare(b.date))[0];
  const weighs = weightSeries(s); const nextMonday = addDays(today, (7 - ((new Date().getDay() + 6) % 7)) % 7 || 7);
  const fresh = newRecords(s, addDays(today, -14), today).map(r => ({ t: `Record · ${r.label} : ${r.value}`, d: r.date })).sort((a, b) => b.d.localeCompare(a.d))[0];
  const ach = achievementsMemo(s, today); const got = ach.filter(a => a.date).sort((a, b) => b.date!.localeCompare(a.date!)); const nxt = nextMilestone(s, today, undefined, ach);
  const chs = chapters(s, today, ach); const ch = chs.find(x => x.state === 'en cours') || chs[chs.length - 1]; const celebrating = toCelebrate(s, today, ach).length > 0;
  const recap = availableRecaps(s)[0]; const recapNew = recap && !s.recapsSeen?.[String(recap)];

  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4, marginBottom: space.s4, fontSize: 32, lineHeight: 38 }}>Progression</T>

      {/* Indicateur principal : la régularité du cycle, en vraies données */}
      <Pressable onPress={() => go('regularity')} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}><Stage mark tone="lime" style={{ marginBottom: 0 }}>
        <Kicker onStage color={c.accentInk}>{`Cycle 1 · semaine ${w} sur ${s.program.weeks}`}</Kicker>
        <Row style={{ alignItems: 'flex-end', marginTop: space.s3 }} gap={space.s3}>
          <T v="display" color={c.accentInk}>{planned ? `${done}/${planned}` : '—'}</T>
          <T v="small" color={c.accentInk} style={{ flex: 1, paddingBottom: 6 }}>{planned ? 'séances prévues réalisées cette semaine' : 'aucune séance prévue jusqu\'ici cette semaine'}</T>
        </Row>
        {/* Le cycle en chapitres : une case par semaine, regroupées par phase */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: space.s4 }}>
          {chs.map(x => (
            <View key={x.n} style={{ flex: x.weeks.length, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 2 }}>{x.weeks.map(k => <View key={k.w} style={{ flex: 1, height: k.state === 'current' ? 10 : 6, borderRadius: 3, alignSelf: 'flex-end', backgroundColor: k.state === 'ok' ? c.accentInk : k.state === 'ko' ? 'rgba(11,13,10,0.4)' : k.state === 'current' ? c.accentInk : 'rgba(11,13,10,0.15)' }} />)}</View>
              <T v="xs" color={c.accentInk} style={{ opacity: x.state === 'à venir' ? 0.55 : 1, fontWeight: x.n === ch.n ? '700' : '400' }}>{x.n}</T>
            </View>))}
        </View>
        <Row gap={8} style={{ marginTop: space.s3 }}><Icon name="chevrons" size={16} color={c.accentInk} filled /><T v="small" color={c.accentInk} style={{ fontWeight: '600', flex: 1 }}>{`Chapitre ${ch.n} · ${ch.name} · ${ch.next}`}</T></Row>
      </Stage></Pressable>

      <View style={{ height: space.s3 }} />
      <UnlockMoment />
      {/* Accomplissements : les réussites d'abord, puis un seul prochain jalon (pas de liste de badges verrouillés) */}
      <Pressable onPress={() => go('records')} accessibilityRole="button" accessibilityLabel={`Accomplissements : ${got.length} atteints sur ${ach.length}`} style={({ pressed }) => ({ backgroundColor: c.surface, borderRadius: radius.r2, marginBottom: space.s3, opacity: pressed ? 0.9 : 1, overflow: 'hidden' })}>
        <Row between style={{ paddingHorizontal: space.s4, paddingTop: space.s4 }}><T v="small" muted style={{ fontWeight: '600' }}>Accomplissements</T><T v="small" muted>{`${got.length} sur ${ach.length}`}</T></Row>
        {got.length && !celebrating ? <Row gap={space.s2} style={{ paddingHorizontal: space.s3, paddingTop: space.s3 }}>
          {got.slice(0, 5).map(a => <AchBadge key={a.id} cat={a.cat} status="unlocked" major={a.tier === 'major'} size={52} label={a.title} />)}
        </Row> : !got.length ? <T v="small" muted style={{ paddingHorizontal: space.s4, paddingTop: 6 }}>Tes premiers accomplissements arrivent avec tes séances réelles.</T> : null}
        {fresh ? <T v="small" color={c.accent} style={{ paddingHorizontal: space.s4, paddingTop: space.s2, fontWeight: '600' }}>{`${fresh.t} · ${fmtShort(fresh.d)}`}</T> : null}
        {nxt ? <View style={{ marginTop: space.s2 }}><T v="xs" muted style={{ paddingHorizontal: space.s4 }}>Prochain jalon</T><MilestoneRow a={nxt} last /></View> : <View style={{ height: space.s4 }} />}
      </Pressable>

      {/* Aperçus : uniquement des faits mesurés, jamais d'estimation présentée comme un résultat */}
      <Row gap={space.s3} style={{ marginTop: space.s3, marginBottom: space.s5, alignItems: 'stretch' }}>
        <Preview icon="run" label="Running" onPress={() => go('running')}
          value={best10 ? mmss(best10.raw / 10) : ev ? `J-${daysBetween(today, ev.date)}` : '—'}
          unit={best10 ? '/km' : ''}
          sub={best10 ? `meilleur 10 km mesuré · ${fmtShort(best10.date)}` : ev ? `${ev.name}, ton premier repère mesuré` : 'Pas encore de repère mesuré'} />
        <Preview icon="body" label="Physique" onPress={() => go('physique')}
          value={`${weighs.length}`} unit={weighs.length > 1 ? 'pesées' : 'pesée'}
          sub={`Prochaine : lundi ${fmtShort(nextMonday)}`} />
      </Row>

      <Insights max={2} title="Ce qui évolue" />
      <ListGroup title="Analyses">
        <ListRow title={recapNew ? `Bilan de la semaine ${recap}` : 'Bilans de la semaine'} sub={recapNew ? 'Nouveau · quelques cartes, 30 secondes' : recap ? `${availableRecaps(s).length} bilan${availableRecaps(s).length > 1 ? 's' : ''}` : 'Le premier arrive dimanche soir'} left={<Icon name="story" color={recapNew ? c.accent : undefined} />} onPress={() => (recapNew ? router.push({ pathname: '/recap/[week]', params: { week: String(recap) } }) : go('recaps'))} />
        <ListRow title="Mon parcours" sub={`Chapitre ${ch.n} · ${ch.name}`} left={<Icon name="path" />} onPress={() => go('journey')} />
        <ListRow title="Accomplissements et records" sub={`${got.length} accomplissement${got.length > 1 ? 's' : ''} · ${recs.length} record${recs.length > 1 ? 's' : ''}`} left={<Icon name="peak" />} onPress={() => go('records')} />
        <ListRow title="Régularité" left={<Icon name="calendar" />} onPress={() => go('regularity')} />
        <ListRow title="Dépense des activités" sub={(() => { const e = energy(s, addDays(today, -6), today); return e.withData ? `${e.total.toLocaleString('fr-FR')} kcal estimées sur 7 jours` : 'Estimations de ta montre via Strava'; })()} left={<Icon name="flame" />} onPress={() => go('energy')} />
        <ListRow last title="Renforcement" sub={Object.keys(s.strength).length ? `${Object.keys(s.strength).length} séance${Object.keys(s.strength).length > 1 ? 's' : ''} enregistrée${Object.keys(s.strength).length > 1 ? 's' : ''}` : 'Charges notées le dimanche'} left={<Icon name="dumbbell" />} onPress={() => go('strength')} />
      </ListGroup>
    </Screen>
  );
}

function Preview({ icon, label, value, unit, sub, onPress }: { icon: 'run' | 'body'; label: string; value: string; unit?: string; sub: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value} ${unit || ''}. ${sub}`} style={({ pressed }) => ({ flex: 1, backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, opacity: pressed ? 0.85 : 1 })}>
      <Row between><T v="overline" muted>{label}</T><Icon name={icon} size={18} color={c.ink3} /></Row>
      <Row gap={4} style={{ alignItems: 'flex-end', marginTop: space.s3 }}><T v="hero">{value}</T>{unit ? <T v="small" muted style={{ paddingBottom: 6 }}>{unit}</T> : null}</Row>
      <T v="xs" muted style={{ marginTop: 4 }}>{sub}</T>
    </Pressable>
  );
}
