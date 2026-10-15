import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Field, Gap, Input, Row, T } from '@/components/ui';
import { num, today, uid } from '@/engine/dates';
import type { Measurement } from '@/engine/types';
import { update, useApp } from '@/store/store';
import { space } from '@/theme/tokens';

export default function MeasureScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const s = useApp();
  const ex = id ? s.measurements.find(m => m.id === id) : undefined;
  const [f, setF] = useState<Partial<Measurement>>(ex || { date: today() });
  const [more, setMore] = useState(!!(ex && (ex.fatPct || ex.waist)));
  const [err, setErr] = useState('');
  const set = (p: Partial<Measurement>) => setF(x => ({ ...x, ...p }));
  const n = (k: keyof Measurement) => (t: string) => set({ [k]: num(t) } as Partial<Measurement>);
  const v = (x?: number | null) => (x != null ? String(x).replace('.', ',') : '');
  async function photo() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true });
    if (!r.canceled && r.assets[0].base64) set({ photo: `data:image/jpeg;base64,${r.assets[0].base64}` });
  }
  function save() {
    const w = num(f.weight); if (!w) { setErr('Le poids est obligatoire.'); return; }
    const m: Measurement = { ...(f as Measurement), id: ex?.id || uid(), date: f.date || today(), weight: w };
    update(st => { const i = st.measurements.findIndex(x => x.id === m.id); if (i >= 0) st.measurements[i] = m; else st.measurements.push(m); });
    router.back();
  }
  return (
    <Sheet title={ex ? 'Modifier la pesée' : 'Nouvelle pesée'} sub="Le poids suffit ; le reste est facultatif.">
      <Field label="Date"><Input defaultValue={f.date} placeholder="AAAA-MM-JJ" onChangeText={t => set({ date: t })} /></Field>
      <Field label="Poids (kg)"><Input big keyboardType="decimal-pad" defaultValue={v(f.weight)} placeholder="67,3" onChangeText={n('weight')} /></Field>
      {err ? <T v="small" color="#C23B4C">{err}</T> : null}
      <Button kind="ghost" label={more ? 'Masquer composition et mensurations' : 'Composition et mensurations'} onPress={() => setMore(!more)} />
      {more ? <View>
        <Row><View style={{ flex: 1 }}><Field label="Masse grasse (%)"><Input keyboardType="decimal-pad" defaultValue={v(f.fatPct)} onChangeText={n('fatPct')} /></Field></View><View style={{ flex: 1 }}><Field label="Masse grasse (kg)"><Input keyboardType="decimal-pad" defaultValue={v(f.fatKg)} onChangeText={n('fatKg')} /></Field></View></Row>
        <Row><View style={{ flex: 1 }}><Field label="Muscle (kg)"><Input keyboardType="decimal-pad" defaultValue={v(f.muscleKg)} onChangeText={n('muscleKg')} /></Field></View><View style={{ flex: 1 }}><Field label="Tour de taille (cm)"><Input keyboardType="decimal-pad" defaultValue={v(f.waist)} onChangeText={n('waist')} /></Field></View></Row>
        <Row><View style={{ flex: 1 }}><Field label="Hanches (cm)"><Input keyboardType="decimal-pad" defaultValue={v(f.hips)} onChangeText={n('hips')} /></Field></View><View style={{ flex: 1 }}><Field label="Bras (cm)"><Input keyboardType="decimal-pad" defaultValue={v(f.arm)} onChangeText={n('arm')} /></Field></View></Row>
      </View> : null}
      <Field label="Note"><Input defaultValue={f.note} placeholder="cycle, sommeil, contexte" onChangeText={t => set({ note: t })} /></Field>
      <Button label={f.photo ? 'Changer la photo' : 'Ajouter une photo'} onPress={photo} />
      {f.photo ? <Image source={{ uri: f.photo }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8, marginTop: space.s3 }} contentFit="cover" /> : null}
      <Gap h={space.s4} />
      <Button kind="primary" block label="Enregistrer" onPress={save} />
      {ex ? <><Gap h={8} /><Button kind="danger" block label="Supprimer" onPress={() => { update(st => { st.measurements = st.measurements.filter(m => m.id !== ex.id); }); router.back(); }} /></> : null}
    </Sheet>
  );
}
