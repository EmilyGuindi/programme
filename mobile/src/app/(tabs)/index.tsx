import { router } from 'expo-router';
import { View } from 'react-native';
import { ActivityRow, openPlan, presetFor, TYPE_LABEL } from '@/components/plan-row';
import { Logo } from '@/components/logo';
import { Button, Card, Coach, Gap, Pill, Row, Screen, T, Tag } from '@/components/ui';
import { activitiesOn, adapted, coachLine, doneOn, recovery } from '@/engine/coach';
import { addDays, fmtLong, today } from '@/engine/dates';
import { update, useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

export default function Today() {
  const s = useApp(); const { c } = useTheme();
  const d = today(); const a = adapted(s, d); const r = recovery(s, d); const acts = activitiesOn(s, d);
  const shown = a.replaced || a; const tmr = adapted(s, addDays(d, 1)); const done = doneOn(s, d);
  const isEvent = a.type === 'event'; const fg = isEvent ? c.paper : undefined;
  return (
    <Screen>
      <Row between style={{ paddingTop: space.s4, paddingBottom: space.s3 }}>
        <Row gap={10}><Logo /><T v="label" style={{ letterSpacing: 1.5 }}>BYYND</T></Row>
        <Button small kind="ghost" label={r.level === 'inconnu' ? 'Check-in' : 'Modifier le check-in'} onPress={() => router.push('/checkin')} />
      </Row>
      <T muted>{fmtLong(d)}</T>
      <T v="title">{r.level === 'inconnu' ? 'Comment tu te sens ?' : `Bonjour ${s.user.name}`}</T>
      <Row style={{ marginVertical: space.s3, flexWrap: 'wrap' }}><Pill level={r.level} /><View style={{ flex: 1, minWidth: 160 }}><T v="small" muted>{r.reasons[0]}</T></View></Row>
      {r.level === 'inconnu' ? <><Button kind="primary" block label="Faire mon check-in · 30 s" onPress={() => router.push('/checkin')} /><Gap /></> : null}
      <Coach>{coachLine(s, d)}</Coach>

      <Card tone={isEvent ? 'ink' : 'default'}>
        <Row between><Tag tone={isEvent ? 'inverse' : undefined}>{`${TYPE_LABEL[shown.type]}${a.optional ? ' · optionnel' : ''}`}</Tag>{a.reason ? <Tag tone="accent">adaptée</Tag> : null}</Row>
        <T v="h2" color={fg} style={{ marginTop: space.s3, marginBottom: 4 }}>{shown.title}</T>
        <T muted={!isEvent} color={isEvent ? 'rgba(244,242,238,.75)' : undefined}>{[a.replaced ? '' : a.dur, shown.goal, a.note].filter(Boolean).join(' · ')}</T>
        <Gap />
        {done && shown.type !== 'renfo' ? <T v="label" color={c.ok}>Séance validée</T>
          : isEvent ? <Button kind="inverse" block label={a.event?.result ? 'Voir mon résultat' : 'Saisir mon résultat'} onPress={() => router.push({ pathname: '/result/[id]', params: { id: a.event!.id } })} />
          : shown.type === 'run' ? <Button kind="primary" block label="Voir la séance" onPress={() => openPlan(a)} />
          : shown.type === 'renfo' ? <Row><Button kind="primary" label="Commencer" style={{ flex: 1 }} onPress={() => openPlan(a)} /><Button label="Je passe" onPress={() => update(st => { st.overrides[d] = { ...(st.overrides[d] || {}), level: 'rouge' }; })} /></Row>
          : shown.type === 'box' || shown.type === 'recup' ? <Button kind="primary" block label="Marquer comme fait" onPress={() => router.push({ pathname: '/activity', params: { date: d, preset: a.replaced ? 'marche' : presetFor(a) } })} />
          : null}
      </Card>

      <T v="h3" style={{ marginTop: space.s4, marginBottom: space.s2 }}>Enregistré aujourd'hui</T>
      {acts.length ? acts.map(x => <ActivityRow key={x.id} x={x} />) : <T v="small" muted>Rien pour l'instant.</T>}
      <Gap h={space.s2} />
      <Button small label="Ajouter une activité" onPress={() => router.push({ pathname: '/activity', params: { date: d } })} />
      <Gap h={space.s5} />
      <Card tone="flat"><Row gap={8}><Tag>Demain</Tag><T v="label" style={{ flex: 1 }}>{(tmr.replaced || tmr).title}</T><T v="small" muted>{tmr.dur || ''}</T></Row></Card>
    </Screen>
  );
}
