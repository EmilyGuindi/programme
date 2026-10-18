import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Choices, Field, Input, Row, T } from '@/components/ui';
import { recordEventResult } from '@/engine/coach';
import { clock, fmtLong, num, parseTime } from '@/engine/dates';
import { update, useApp } from '@/store/store';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const s = useApp(); const e = s.events.find(x => x.id === id);
  const r = e?.result;
  const [time, setTime] = useState(r ? clock(r.time) : ''); const [elev, setElev] = useState(r?.elevM != null ? String(r.elevM) : '');
  const [hr, setHr] = useState(r?.avgHr != null ? String(r.avgHr) : ''); const [eff, setEff] = useState<number | null>(r?.effort ?? null);
  const [notes, setNotes] = useState(r?.notes || ''); const [err, setErr] = useState('');
  if (!e) return <Sheet title="Événement introuvable"><T>Cet événement n'existe plus.</T></Sheet>;
  function save() {
    const t = parseTime(time); if (!t) { setErr('Temps invalide : écris par exemple 59:30 ou 1:02:10.'); return; }
    update(st => { const ev = st.events.find(x => x.id === id)!; ev.result = { ...(ev.result || {}), time: t, elevM: num(elev), avgHr: num(hr), effort: eff, notes, source: ev.result && ev.result.time === t ? ev.result.source : 'saisi' }; ev.status = 'fait'; recordEventResult(st, ev); });
    router.back();
  }
  return (
    <Sheet title="Résultat" sub={`${e.name}, ${fmtLong(e.date).toLowerCase()}`}>
      {r?.source && r.source !== 'saisi' ? <T v="small" muted style={{ marginBottom: 12 }}>{r.source === 'montre' ? 'Pré-rempli depuis ta montre (Strava) : temps total, pauses et obstacles compris. Remplace-le par ton temps officiel si tu l\'as.' : 'Repris de la description de ton activité Strava.'}</T> : null}
      <Field label="Temps officiel" hint="h:mm:ss ou mm:ss"><Input big defaultValue={time} placeholder="59:30" onChangeText={setTime} /></Field>
      <Row><View style={{ flex: 1 }}><Field label="Dénivelé (m D+)"><Input keyboardType="number-pad" defaultValue={elev} onChangeText={setElev} /></Field></View><View style={{ flex: 1 }}><Field label="FC moyenne"><Input keyboardType="number-pad" defaultValue={hr} onChangeText={setHr} /></Field></View></Row>
      <Field label="Effort ressenti"><Choices cols={10} options={Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)] as [number, string])} value={eff} onChange={setEff} /></Field>
      <Field label="Conditions, ressenti"><Input defaultValue={notes} placeholder="météo, parcours, départ, ce qui a marché" onChangeText={setNotes} /></Field>
      {err ? <T v="small" color="#C23B4C">{err}</T> : null}
      <Button kind="primary" block label="Enregistrer" onPress={save} />
    </Sheet>
  );
}
