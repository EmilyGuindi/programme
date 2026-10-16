import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { ActivityRow, openDay, openPlan, presetFor, TYPE_LABEL } from '@/components/plan-row';
import { Wordmark } from '@/components/logo';
import { UpdateBanner } from '@/components/update-banner';
import { ActivityPrompts } from '@/components/activity-prompts';
import { Button, Card, Coach, Gap, Pill, Row, Screen, T, Tag } from '@/components/ui';
import { activitiesOn, adapted, coachLine, doneOn, recovery } from '@/engine/coach';
import { addDays, fmtLong, sportDay } from '@/engine/dates';
import { update, useApp } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

/** Salutation selon l'heure, recalculée à chaque affichage. */
function greeting(h = new Date().getHours()) {
  if (h >= 5 && h < 12) return 'Bonjour';
  if (h >= 12 && h < 18) return 'Bon après-midi';
  if (h >= 18 && h < 22) return 'Bonsoir';
  return 'Bonne nuit';
}

export default function Today() {
  const [, tick] = useState(0);
  useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'active') tick(x => x + 1); }); const t = setInterval(() => tick(x => x + 1), 5 * 60 * 1000); return () => { sub.remove(); clearInterval(t); }; }, []);
  const s = useApp(); const { c } = useTheme();
  const d = sportDay(); const a = adapted(s, d); const r = recovery(s, d); const acts = activitiesOn(s, d);
  const shown = a.replaced || a; const tmr = adapted(s, addDays(d, 1)); const done = doneOn(s, d);
  const isEvent = a.type === 'event'; const fg = isEvent ? c.paper : undefined;
  return (
    <Screen>
      <Row between style={{ paddingTop: space.s4, paddingBottom: space.s3 }}>
        <Wordmark height={16} />
        <Button small kind="ghost" label={r.level === 'inconnu' ? 'Check-in' : 'Modifier le check-in'} onPress={() => router.push('/checkin')} />
      </Row>
      <UpdateBanner />
      <T muted>{fmtLong(d)}</T>
      <T v="title">{r.level === 'inconnu' ? `${greeting()} ${s.user.name}, comment tu te sens ?` : `${greeting()} ${s.user.name}`}</T>
      <Row style={{ marginVertical: space.s3, flexWrap: 'wrap' }}><Pill level={r.level} /><View style={{ flex: 1, minWidth: 160 }}><T v="small" muted>{r.reasons[0]}</T></View></Row>
      {r.level === 'inconnu' ? <><Button kind="primary" block label="Faire mon check-in · 30 s" onPress={() => router.push('/checkin')} /><Gap /></> : null}
      <Coach>{coachLine(s, d)}</Coach>
      <ActivityPrompts />

      <Card tone={isEvent ? 'ink' : 'default'} onPress={isEvent ? undefined : () => openDay(d)}>
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
      <Card tone="flat" onPress={() => openDay(addDays(d, 1))}><Row gap={8}><Tag>Demain</Tag><T v="label" style={{ flex: 1 }}>{(tmr.replaced || tmr).title}</T><T v="small" muted>{tmr.dur || ''}</T></Row></Card>
    </Screen>
  );
}
