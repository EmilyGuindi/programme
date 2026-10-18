import { View } from 'react-native';
import { addDays, DAYS_SHORT, dow, today } from '@/engine/dates';
import { planFor } from '@/engine/coach';
import { update, useApp } from '@/store/store';
import { space } from '@/theme/tokens';
import { Button, Card, Chip, Choices, Row, T } from './ui';

/** Questions courtes après une synchro Strava : confirmation de correspondance, effort d'un cours sans FC. */
export function ActivityPrompts() {
  const s = useApp(); const t = today(); const from = addDays(t, -7);
  const confirm = s.activities.filter(a => a.source === 'strava' && a.needsConfirm && a.date >= from);
  const effort = s.activities.filter(a => a.source === 'strava' && a.askEffort && a.effort == null && a.matched && a.date >= from);
  if (!confirm.length && !effort.length) return null;
  return (
    <View>
      {confirm.map(a => { const p = planFor(s, a.date); return (
        <Card key={'c' + a.id}>
          <Row gap={8}><Chip tone="accent" label="Strava" /><T v="small" muted style={{ flex: 1 }}>{`${a.title}, ${DAYS_SHORT[dow(a.date)].toLowerCase()}. ${Math.round(a.durationMin || 0)} min`}</T></Row>
          <T v="label" style={{ marginVertical: space.s2 }}>{`C'était ta séance prévue (${p.title}) ?`}</T>
          <Row><Button kind="primary" label="Oui" style={{ flex: 1 }} onPress={() => update(st => { const x = st.activities.find(y => y.id === a.id)!; x.matched = a.date; x.needsConfirm = false; x.userEdited = true; })} />
            <Button label="Non, autre chose" style={{ flex: 1 }} onPress={() => update(st => { const x = st.activities.find(y => y.id === a.id)!; x.matched = null; x.needsConfirm = false; x.userEdited = true; })} /></Row>
        </Card>); })}
      {effort.map(a => (
        <Card key={'e' + a.id}>
          <Row gap={8}><Chip tone="accent" label="Strava" /><T v="small" muted style={{ flex: 1 }}>{`${a.title}, ${DAYS_SHORT[dow(a.date)].toLowerCase()}. ${Math.round(a.durationMin || 0)} min, sans fréquence cardiaque`}</T></Row>
          <T v="label" style={{ marginVertical: space.s2 }}>Effort ressenti de ce cours ?</T>
          <Choices cols={10} options={Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)] as [number, string])} value={null} onChange={v => v && update(st => { const x = st.activities.find(y => y.id === a.id)!; x.effort = v; x.askEffort = false; })} />
        </Card>))}
    </View>
  );
}
