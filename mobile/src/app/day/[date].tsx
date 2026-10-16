import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Bullets, MoveList } from '@/components/guide';
import { ActivityRow, presetFor, TYPE_LABEL } from '@/components/plan-row';
import { Sheet } from '@/components/sheet';
import { Button, Card, Coach, Gap, Row, T, Tag } from '@/components/ui';
import { activitiesOn, adapted, doneOn, phaseOf } from '@/engine/coach';
import { fmtLong } from '@/engine/dates';
import { BOX_GUIDE, MOBILITY, REST_GUIDE } from '@/engine/guides';
import { useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

/** Fiche d'un jour : ce qui est prévu, pourquoi, comment le faire. Accessible depuis n'importe quel jour du programme. */
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>(); const s = useApp(); const { c } = useTheme();
  const a = adapted(s, date); const shown = a.replaced || a; const acts = activitiesOn(s, date); const done = doneOn(s, date);
  const ph = phaseOf(a.week);
  return (
    <Sheet title={fmtLong(date)} sub={`Semaine ${a.week} · Phase ${ph.n}, ${ph.name}`}>
      <Row gap={6}><Tag>{`${TYPE_LABEL[shown.type]}${a.optional ? ' · optionnel' : ''}`}</Tag>{a.reason ? <Tag tone="accent">adaptée</Tag> : null}{done ? <Tag>faite ✓</Tag> : null}</Row>
      <T v="title" style={{ marginTop: space.s3 }}>{shown.title}</T>
      {a.dur && !a.replaced ? <T muted>{a.dur}</T> : null}
      <Gap />
      {shown.goal ? <T><T v="label">Objectif : </T>{shown.goal}</T> : null}
      {a.note ? <T style={{ marginTop: 6 }}><T v="label">À savoir : </T>{a.note}</T> : null}
      {a.reason ? <><Gap /><Coach>{a.reason}</Coach></> : <Gap />}

      {shown.type === 'run' ? <Button kind="primary" block label="Ouvrir la séance guidée" onPress={() => router.push({ pathname: '/run/[date]', params: { date } })} /> : null}
      {shown.type === 'renfo' ? <Button kind="primary" block label="Ouvrir la séance" onPress={() => router.push({ pathname: '/renfo/[date]', params: { date } })} /> : null}
      {a.type === 'event' && a.event ? <Button kind="primary" block label="Voir l'événement" onPress={() => router.push({ pathname: '/event', params: { id: a.event!.id } })} /> : null}

      {shown.type === 'box' ? <>
        <T v="h3" style={{ marginBottom: space.s2 }}>{a.hyrox ? 'Ton cours HYROX' : 'Ton cours de CrossFit'}</T>
        <Card><Bullets items={BOX_GUIDE} /></Card>
        {!done ? <Button kind="primary" block label="Marquer comme fait" onPress={() => router.push({ pathname: '/activity', params: { date, preset: presetFor(a) } })} /> : null}
      </> : null}

      {shown.type === 'recup' ? <>
        <T v="h3" style={{ marginBottom: 4 }}>Ta routine de récupération</T>
        <T v="small" muted style={{ marginBottom: space.s3 }}>Environ 40 min au total.</T>
        <MoveList moves={MOBILITY} />
        {!done ? <Button kind="primary" block label="Marquer comme fait" onPress={() => router.push({ pathname: '/activity', params: { date, preset: 'marche' } })} /> : null}
      </> : null}

      {shown.type === 'rest' && a.type !== 'event' ? <Card><Bullets items={REST_GUIDE} /></Card> : null}

      <T v="h3" style={{ marginTop: space.s4, marginBottom: space.s2 }}>Activités enregistrées</T>
      {acts.length ? acts.map(x => <ActivityRow key={x.id} x={x} />) : <T v="small" muted>Aucune pour ce jour.</T>}
      <View style={{ height: space.s2 }} />
      <Button small label="Ajouter une activité" onPress={() => router.push({ pathname: '/activity', params: { date } })} />
    </Sheet>
  );
}
