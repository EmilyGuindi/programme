import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons';
import { Badge, Kicker, Stage, StepMark } from '@/components/brand';
import { Insights } from '@/components/insights';
import { energy } from '@/engine/energy';
import { Chevron, Chip, ListGroup, ListRow, Row, Screen, SectionHeader, T } from '@/components/ui';
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
import { layout, radius, space, useTheme } from '@/theme/tokens';

const go = (view: string) => router.push({ pathname: '/progress/[view]', params: { view } });

export default function Progress() {
  const s = useApp(); const { c } = useTheme(); const today = sportDay();
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, today))); const ws = weekStart(s, w);
  const recs = recordsUntil(s, today); const best10 = recs.find(r => r.id === 'run-10k'); const ev = s.events.filter(e => e.type === 'course' && ['upcoming', 'today'].includes(eventState(s, e, today))).sort((a, b) => a.date.localeCompare(b.date))[0];
  const weighs = weightSeries(s); const nextMonday = addDays(today, (7 - ((new Date().getDay() + 6) % 7)) % 7 || 7);
  const fresh = newRecords(s, addDays(today, -14), today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const ach = achievementsMemo(s, today); const got = ach.filter(a => a.date).sort((a, b) => b.date!.localeCompare(a.date!)); const nxt = nextMilestone(s, today, undefined, ach);
  const chs = chapters(s, today, ach); const ch = chs.find(x => x.state === 'en cours') || chs[chs.length - 1]; const celebrating = toCelebrate(s, today, ach).length > 0;
  const recap = availableRecaps(s)[0]; const recapNew = recap && !s.recapsSeen?.[String(recap)]; const nRecaps = availableRecaps(s).length;
  const e7 = energy(s, addDays(today, -6), today); const nStr = Object.keys(s.strength).length;

  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4, marginBottom: space.s4 }}>Progression</T>

      {/* 1 · Le cycle : où j'en suis sur les 20 semaines */}
      <Pressable onPress={() => go('journey')} accessibilityRole="button" accessibilityLabel={`Cycle : semaine ${w} sur ${s.program.weeks}, chapitre ${ch.n}, ${ch.name}. Ouvrir mon parcours`} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        <Stage mark tone="lime">
          <Row between style={{ minHeight: 24, gap: space.s2 }}><View style={{ flex: 1 }}><Kicker onStage color={c.accentInk}>{`Chapitre ${ch.n} sur ${chs.length}`}</Kicker></View><Chip tone="lime" label={`Semaine ${w}/${s.program.weeks}`} /></Row>
          <T v="title" color={c.accentInk} style={{ marginTop: space.s2 }}>{ch.name}</T>
          <T v="small" color={c.accentInk} style={{ marginTop: 2, opacity: 0.8 }}>{ch.goal}</T>
          <CycleTrack chapters={chs} week={w} total={s.program.weeks} />
          <Row between style={{ marginTop: space.s2 }}><T v="xs" color={c.accentInk} style={{ opacity: 0.7 }}>{fmtShort(s.user.startDate)}</T><T v="xs" color={c.accentInk} style={{ opacity: 0.7 }}>{fmtShort(addDays(weekStart(s, s.program.weeks), 6))}</T></Row>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(11,13,10,0.18)', marginVertical: space.s3 }} />
          <Row gap={space.s2}><Icon name="flag" size={16} color={c.accentInk} filled={!!ch.milestone.reached} /><T v="small" color={c.accentInk} style={{ flex: 1, fontWeight: '600' }} numberOfLines={2}>{ch.milestone.reached ? `Jalon atteint : ${ch.milestone.title.toLowerCase()}` : `Jalon du chapitre : ${ch.milestone.title.toLowerCase()}`}</T><Chevron color={c.accentInk} /></Row>
        </Stage>
      </Pressable>

      {/* 2 · Accomplissements : les réussites d'abord, un seul prochain jalon */}
      <UnlockMoment />
      <SectionHeader title="Accomplissements" action="Tout voir" onAction={() => go('records')} />
      <Pressable onPress={() => go('records')} accessibilityRole="button" accessibilityLabel={`Accomplissements : ${got.length} atteints sur ${ach.length}`} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, marginBottom: layout.gap, overflow: 'hidden' })}>
        <View style={{ padding: layout.pad, paddingBottom: nxt ? space.s2 : layout.pad }}>
          <Row gap={6} style={{ alignItems: 'flex-end' }}><T v="num" style={{ fontSize: 22, lineHeight: 26 }}>{`${got.length}`}</T><T v="small" muted style={{ paddingBottom: 2 }}>{`atteint${got.length > 1 ? 's' : ''} sur ${ach.length}`}</T></Row>
          {got.length && !celebrating ? <Row gap={space.s2} style={{ marginTop: space.s3, marginLeft: -6 }}>{got.slice(0, 5).map(a => <AchBadge key={a.id} cat={a.cat} status="unlocked" major={a.tier === 'major'} size={52} label={a.title} />)}</Row>
            : !got.length ? <T v="small" muted style={{ marginTop: space.s1 }}>Les premiers arrivent avec tes séances réelles.</T> : null}
          {fresh ? <T v="small" color={c.accent} style={{ marginTop: space.s3, fontWeight: '600' }}>{`Nouveau record : ${fresh.label.toLowerCase()}, ${fresh.value}`}</T> : null}
        </View>
        {nxt ? <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line2 }}><T v="xs" muted style={{ paddingHorizontal: layout.pad, paddingTop: space.s3 }}>Prochain jalon</T><MilestoneRow a={nxt} last /></View> : null}
      </Pressable>

      {/* 3 · Mesures : running et physique */}
      <SectionHeader title="Mesures" />
      <Row gap={layout.gap} style={{ marginBottom: layout.gap, alignItems: 'stretch' }}>
        <Preview icon="run" label="Running" onPress={() => go('running')}
          value={best10 ? mmss(best10.raw / 10) : ev ? `J-${daysBetween(today, ev.date)}` : '—'} unit={best10 ? '/km' : ''}
          sub={best10 ? `Meilleur 10 km, ${fmtShort(best10.date)}` : ev ? `${ev.name}, ton premier repère` : 'Pas encore de repère mesuré'} />
        <Preview icon="body" label="Physique" onPress={() => go('physique')}
          value={`${weighs.length}`} unit={weighs.length > 1 ? 'pesées' : 'pesée'} sub={`Prochaine le ${fmtShort(nextMonday)}`} />
      </Row>

      <Insights max={2} title="Ce qui évolue" />

      <ListGroup title="Analyses">
        <ListRow title={recapNew ? `Bilan de la semaine ${recap}` : 'Bilans de la semaine'} sub={recapNew ? 'Nouveau, 30 secondes' : recap ? `${nRecaps} bilan${nRecaps > 1 ? 's' : ''}` : 'Le premier arrive dimanche soir'} left={<Icon name="story" color={recapNew ? c.accent : undefined} />} right={recapNew ? <Chip tone="accent" label="Nouveau" /> : undefined} onPress={() => (recapNew ? router.push({ pathname: '/recap/[week]', params: { week: String(recap) } }) : go('recaps'))} />
        <ListRow title="Mon parcours" sub={`Chapitre ${ch.n}, ${ch.name.toLowerCase()}`} left={<Icon name="path" />} onPress={() => go('journey')} />
        <ListRow title="Records" sub={recs.length ? `${recs.length} record${recs.length > 1 ? 's' : ''} mesuré${recs.length > 1 ? 's' : ''}` : 'Avec tes premières sorties et charges'} left={<Icon name="peak" />} onPress={() => go('records')} />
        <ListRow title="Régularité" sub="Toutes les semaines du cycle" left={<Icon name="calendar" />} onPress={() => go('regularity')} />
        <ListRow title="Dépense des activités" sub={e7.withData ? `${e7.total.toLocaleString('fr-FR')} kcal estimées sur 7 jours` : 'Estimations de ta montre via Strava'} left={<Icon name="flame" />} onPress={() => go('energy')} />
        <ListRow last title="Renforcement" sub={nStr ? `${nStr} séance${nStr > 1 ? 's' : ''} enregistrée${nStr > 1 ? 's' : ''}` : 'Tes charges, séance après séance'} left={<Icon name="dumbbell" />} onPress={() => go('strength')} />
      </ListGroup>
    </Screen>
  );
}

/** Le cycle en une ligne : un segment par chapitre, longueur proportionnelle à ses semaines.
 *  Rempli = semaines écoulées ; repère = semaine en cours. Pas de lettres ni de micro-segments. */
function CycleTrack({ chapters: chs, week, total }: { chapters: ReturnType<typeof chapters>; week: number; total: number }) {
  const { c } = useTheme(); const ink = c.accentInk;
  return (
    <View accessible accessibilityLabel={`${Math.max(0, week - 1)} semaines terminées sur ${total}`} style={{ flexDirection: 'row', gap: 3, marginTop: space.s4, height: 10, alignItems: 'center' }}>
      {chs.map(ch => { const n = ch.to - ch.from + 1; const elapsed = Math.max(0, Math.min(n, week - ch.from)); const cur = week >= ch.from && week <= ch.to;
        return (
          <View key={ch.n} style={{ flex: n, height: cur ? 10 : 6, borderRadius: 5, backgroundColor: 'rgba(11,13,10,0.16)', overflow: 'hidden' }}>
            <View style={{ width: `${(elapsed / n) * 100}%`, height: '100%', backgroundColor: ink }} />
            {cur ? <View style={{ position: 'absolute', left: `${((week - ch.from + 0.5) / n) * 100}%`, top: 2, width: 6, height: 6, marginLeft: -3, borderRadius: 3, backgroundColor: ink }} /> : null}
          </View>); })}
    </View>
  );
}

function Preview({ icon, label, value, unit, sub, onPress }: { icon: 'run' | 'body'; label: string; value: string; unit?: string; sub: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value} ${unit || ''}. ${sub}`} style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? c.surface2 : c.surface, borderRadius: radius.r2, padding: layout.pad })}>
      <Row between><T v="small" muted style={{ fontWeight: '600' }}>{label}</T><Icon name={icon} size={18} color={c.ink3} /></Row>
      <Row gap={4} style={{ alignItems: 'flex-end', marginTop: space.s3 }}><T v="hero">{value}</T>{unit ? <T v="small" muted style={{ paddingBottom: 6 }}>{unit}</T> : null}</Row>
      <T v="xs" muted style={{ marginTop: space.s1 }}>{sub}</T>
    </Pressable>
  );
}
