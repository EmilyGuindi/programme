import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Bullets, MoveList } from '@/components/guide';
import { ActivityRow, markDone, TYPE_LABEL } from '@/components/plan-row';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Coach, Gap, Row, SectionHeader, T, Tag } from '@/components/ui';
import { activitiesOn, adapted, doneOn, phaseOf } from '@/engine/coach';
import { fmtDay, fmtLong, sportDay } from '@/engine/dates';
import { movable } from '@/engine/reschedule';
import { BOX_GUIDE, MOBILITY, REST_GUIDE } from '@/engine/guides';
import { RECUP } from '@/engine/library';
import { SessionProgressLine, useSession } from '@/components/session-progress';
import { useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

/** Fiche d'un jour : ce qui est prévu, pourquoi, comment le faire. Accessible depuis n'importe quel jour du programme. */
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>(); const s = useApp(); const { c } = useTheme();
  const a = adapted(s, date); const shown = a.replaced || a; const acts = activitiesOn(s, date); const done = doneOn(s, date);
  const ph = phaseOf(a.week); const sp = useSession(date);
  return (
    <Sheet title={fmtLong(date)} sub={`Semaine ${a.week}, ${ph.name.toLowerCase()}`}>
      <Row gap={6} style={{ flexWrap: 'wrap' }}><Chip label={TYPE_LABEL[shown.type]} />{done ? <Chip tone="accent" label="Faite" /> : a.reason ? <Chip tone="warn" label="Adaptée" /> : a.optional ? <Chip label="Optionnelle" /> : null}</Row>
      <T v="title" style={{ marginTop: space.s3 }}>{shown.title}</T>
      {shown.dur || (shown === a && a.dur) ? <T muted>{shown.dur || a.dur}</T> : null}
      <Gap />
      {shown.goal ? <T><T v="label">Objectif : </T>{shown.goal}</T> : null}
      {a.note ? <T style={{ marginTop: 6 }}><T v="label">À savoir : </T>{a.note}</T> : null}
      {a.movedFrom ? <T v="small" color={c.accent} style={{ marginTop: 6 }}>{`Séance déplacée, prévue à l'origine ${fmtDay(a.movedFrom)}.`}</T> : null}
      {a.reason ? <><Gap /><Coach>{a.reason}</Coach></> : <Gap />}

      {shown.type === 'run' ? <Button kind="primary" block label="Ouvrir la séance guidée" onPress={() => router.push({ pathname: '/run/[date]', params: { date } })} /> : null}
      {shown.type === 'renfo' ? <Button kind="primary" block label="Ouvrir la séance" onPress={() => router.push({ pathname: '/renfo/[date]', params: { date } })} /> : null}
      {a.type === 'event' && a.event ? <Button kind="primary" block label="Voir l'événement" onPress={() => router.push({ pathname: '/event', params: { id: a.event!.id } })} /> : null}

      {shown.type === 'box' ? <>
        <T v="h3" style={{ marginBottom: space.s2 }}>{a.hyrox ? 'Ton cours HYROX' : 'Ton cours de CrossFit'}</T>
        <Card><Bullets items={BOX_GUIDE} /></Card>
        {!done ? <Button kind="primary" block label="Marquer comme fait" onPress={() => markDone(a)} /> : null}
      </> : null}

      {shown.type === 'recup' ? <>
        <T v="h3" style={{ marginBottom: 4 }}>Ta routine de récupération</T>
        <T v="small" muted style={{ marginBottom: space.s3 }}>{`${RECUP.dur} au total : ${RECUP.walkMin} min de marche, puis ${RECUP.mobilityMin} min de mobilité. Coche au fur et à mesure.`}</T>
        <SessionProgressLine p={sp} />
        <Gap />
        <MoveList moves={MOBILITY} date={date} prefix="mob" />
        {!done ? <Button kind="primary" block label={sp.allChecked ? 'Valider la récupération' : 'Marquer comme fait'} onPress={() => markDone(a)} /> : null}
      </> : null}

      {shown.type === 'rest' && a.type !== 'event' ? <Card><Bullets items={REST_GUIDE} /></Card> : null}

      {movable(s, date, sportDay()).ok ? <Button block label={a.movedFrom ? 'Déplacer ou annuler le déplacement' : 'Déplacer la séance'} style={{ marginTop: space.s3 }} onPress={() => router.push({ pathname: '/move/[date]', params: { date } })} /> : null}
      {a.movedTo ? <Button block label="Voir la séance déplacée" style={{ marginTop: space.s3 }} onPress={() => router.push({ pathname: '/day/[date]', params: { date: a.movedTo! } })} /> : null}
      <SectionHeader title="Activités enregistrées" />
      {acts.length ? acts.map(x => <ActivityRow key={x.id} x={x} />) : <T v="small" muted>Aucune pour ce jour.</T>}
      <View style={{ height: space.s2 }} />
      <Button small label="Ajouter une activité" onPress={() => router.push({ pathname: '/activity', params: { date } })} />
    </Sheet>
  );
}
