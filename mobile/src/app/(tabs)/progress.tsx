import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icons';
import { BrandMark } from '@/components/logo';
import { ListGroup, ListRow, Row, Screen, T } from '@/components/ui';
import { adapted, doneOn, weekOf, weekStart, weightSeries } from '@/engine/coach';
import { addDays, daysBetween, fmtShort, mmss, sportDay } from '@/engine/dates';
import { achievements, bodyJourney, runningJourney, weekSuccess } from '@/engine/journey';
import { availableRecaps } from '@/engine/recap';
import { newRecords, recordsUntil } from '@/engine/records';
import { useApp } from '@/store/store';
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
  const recs = recordsUntil(s, today); const best10 = recs.find(r => r.id === 'run-10k'); const ev = s.events.filter(e => e.type === 'course' && e.status !== 'annulé' && !e.result && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const weighs = weightSeries(s); const nextMonday = addDays(today, (7 - ((new Date().getDay() + 6) % 7)) % 7 || 7);
  const fresh = [...newRecords(s, addDays(today, -14), today).map(r => ({ t: `Record · ${r.label}`, d: r.date })), ...achievements(s, today).filter(a => a.date && daysBetween(a.date, today) <= 14).map(a => ({ t: a.title, d: a.date! }))].sort((a, b) => b.d.localeCompare(a.d))[0];
  const recap = availableRecaps(s)[0]; const recapNew = recap && !s.recapsSeen?.[String(recap)];

  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4, marginBottom: space.s4 }}>Progression</T>

      {/* Indicateur principal : la régularité du cycle, en vraies données */}
      <Pressable onPress={() => go('regularity')} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: c.stage, borderRadius: radius.r2, padding: space.s5, opacity: pressed ? 0.92 : 1 })}>
        <T v="overline" color={c.stageInk2}>{`Cycle 1 · semaine ${w} sur ${s.program.weeks}`}</T>
        <Row style={{ alignItems: 'flex-end', marginTop: space.s3 }} gap={space.s3}>
          <T v="display" color={c.stageInk}>{planned ? `${done}/${planned}` : '—'}</T>
          <T v="small" color={c.stageInk2} style={{ flex: 1, paddingBottom: 6 }}>{planned ? 'séances prévues réalisées cette semaine' : 'aucune séance prévue jusqu\'ici cette semaine'}</T>
        </Row>
        <View style={{ flexDirection: 'row', gap: 3, marginTop: space.s4 }}>
          {Array.from({ length: s.program.weeks }, (_, i) => { const p = past.find(x => x.w === i + 1); const cur = i + 1 === w;
            return <View key={i} style={{ flex: 1, height: cur ? 10 : 6, borderRadius: 3, alignSelf: 'flex-end', backgroundColor: p ? (p.ok ? c.stageInk : 'rgba(244,242,238,0.35)') : cur ? c.accent : 'rgba(244,242,238,0.12)' }} />; })}
        </View>
        <Row between style={{ marginTop: 6 }}><T v="xs" color={c.stageInk2}>14 oct.</T><T v="xs" color={c.stageInk2}>28 févr.</T></Row>
        {runStep || bodyStep ? <T v="small" color={c.stageInk} style={{ marginTop: space.s4 }}>{`En cours : ${(runStep || bodyStep)!.title.toLowerCase()}`}</T> : null}
      </Pressable>

      {fresh ? <Pressable onPress={() => go('records')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: space.s3, padding: space.s4, borderRadius: radius.r2, backgroundColor: c.surface }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}><BrandMark size={18} color={c.paper} /></View>
        <View style={{ flex: 1 }}><T v="overline" color={c.accent}>Nouveau</T><T v="label">{fresh.t}</T></View><T v="xs" muted>{fmtShort(fresh.d)}</T>
      </Pressable> : null}

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

      <ListGroup title="Analyses">
        <ListRow title={recapNew ? `Bilan de la semaine ${recap}` : 'Bilans de la semaine'} sub={recapNew ? 'Nouveau · quelques cartes, 30 secondes' : recap ? `${availableRecaps(s).length} bilan${availableRecaps(s).length > 1 ? 's' : ''}` : 'Le premier arrive dimanche soir'} left={<Icon name="story" color={recapNew ? c.accent : undefined} />} onPress={() => (recapNew ? router.push({ pathname: '/recap/[week]', params: { week: String(recap) } }) : go('recaps'))} />
        <ListRow title="Mon parcours" sub={runStep ? `Running : ${runStep.title.toLowerCase()}` : undefined} left={<Icon name="path" />} onPress={() => go('journey')} />
        <ListRow title="Records et paliers" sub={recs.length ? `${recs.length} record${recs.length > 1 ? 's' : ''}` : 'Tes premiers records arrivent avec tes séances'} left={<Icon name="peak" />} onPress={() => go('records')} />
        <ListRow title="Régularité" left={<Icon name="calendar" />} onPress={() => go('regularity')} />
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
