import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Choices, Field, Gap, Input, Row, T, Tick } from '@/components/ui';
import { num, today, uid } from '@/engine/dates';
import type { Activity, ActivityType } from '@/engine/types';
import { update, useApp } from '@/store/store';

const TYPES: [ActivityType, string][] = [['crossfit', 'CrossFit'], ['hyrox', 'Cours HYROX'], ['hyrox-simu', 'Simulation HYROX'], ['hyrox-compet', 'Compét. HYROX'], ['running', 'Running'], ['renfo', 'Renfo'], ['marche', 'Marche'], ['autre', 'Autre']];
const TITLE: Record<ActivityType, string> = { crossfit: 'CrossFit', hyrox: 'Cours HYROX', 'hyrox-simu': 'Simulation HYROX', 'hyrox-compet': 'Compétition HYROX', running: 'Running', course: 'Course', renfo: 'Renforcement', marche: 'Marche', autre: 'Activité' };

export default function ActivityScreen() {
  const p = useLocalSearchParams<{ id?: string; date?: string; preset?: ActivityType }>(); const s = useApp();
  const ex = p.id ? s.activities.find(a => a.id === p.id) : undefined;
  const [f, setF] = useState<Partial<Activity>>(ex || { date: p.date || today(), type: p.preset || 'crossfit', durationMin: p.preset === 'marche' ? 30 : 60, complementary: p.preset === 'marche' && p.date !== '2026-10-14' ? true : false });
  const set = (patch: Partial<Activity>) => setF(x => ({ ...x, ...patch }));
  function save() {
    const t = f.type as ActivityType; const comp = !!f.complementary;
    const obj: Activity = { ...(ex || {}), userEdited: true, needsConfirm: false, id: ex?.id || uid(), source: ex?.source || 'manuel', date: f.date || today(), type: t, title: f.title && ex && f.title !== TITLE[ex.type] ? f.title : t === 'marche' && comp ? 'Marche avec Sirius' : TITLE[t],
      durationMin: num(f.durationMin), distanceKm: num(f.distanceKm), elevM: num(f.elevM), avgHr: num(f.avgHr), effort: f.effort ?? null, notes: f.notes || '', complementary: comp, matched: comp ? null : (ex?.source === 'strava' ? (ex.matched ?? f.date) : f.date), kind: f.kind || 'facile', eventId: ex?.eventId };
    update(st => { const i = st.activities.findIndex(a => a.id === obj.id); if (i >= 0) st.activities[i] = obj; else st.activities.push(obj); });
    if (!ex && !obj.complementary && (obj.type === 'crossfit' || obj.type === 'hyrox' || obj.type === 'running' || obj.type === 'renfo' || obj.type === 'hyrox-simu')) router.replace({ pathname: '/done/[id]', params: { id: obj.id } });
    else router.back();
  }
  return (
    <Sheet title={ex ? "Modifier l'activité" : 'Ajouter une activité'}>
      <Field label="Type"><Choices options={TYPES} value={f.type} onChange={v => v && set({ type: v, complementary: v === 'marche' ? f.complementary ?? true : false })} /></Field>
      <Field label="Date"><Input defaultValue={f.date} placeholder="AAAA-MM-JJ" onChangeText={t => set({ date: t })} /></Field>
      <Row><View style={{ flex: 1 }}><Field label="Durée (min)"><Input keyboardType="number-pad" defaultValue={f.durationMin != null ? String(Math.round(f.durationMin)) : ''} onChangeText={t => set({ durationMin: num(t) })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Distance (km)"><Input keyboardType="decimal-pad" defaultValue={f.distanceKm != null ? String(f.distanceKm) : ''} onChangeText={t => set({ distanceKm: num(t) })} /></Field></View></Row>
      <Row><View style={{ flex: 1 }}><Field label="Dénivelé (m)"><Input keyboardType="number-pad" defaultValue={f.elevM != null ? String(f.elevM) : ''} onChangeText={t => set({ elevM: num(t) })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="FC moyenne"><Input keyboardType="number-pad" defaultValue={f.avgHr != null ? String(f.avgHr) : ''} onChangeText={t => set({ avgHr: num(t) })} /></Field></View></Row>
      <Field label="Effort ressenti" hint="la vraie charge, pas la durée du cours"><Choices cols={10} options={Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)] as [number, string])} value={f.effort} onChange={v => set({ effort: v })} /></Field>
      <Field label="Note" hint="WOD, contenu, ressenti"><Input defaultValue={f.notes} onChangeText={t => set({ notes: t })} /></Field>
      <Pressable onPress={() => set({ complementary: !f.complementary })}><Row style={{ marginBottom: 16 }}><Tick sizePx={28} on={!!f.complementary} label="Complémentaire" onPress={() => set({ complementary: !f.complementary })} /><T style={{ flex: 1 }}>Activité complémentaire (promenade avec Sirius…) : ne valide pas une séance</T></Row></Pressable>
      <Button kind="primary" block label={ex ? 'Enregistrer' : 'Ajouter'} onPress={save} />
      {ex ? <><Gap h={8} /><Button kind="danger" block label="Supprimer" onPress={() => { update(st => { st.activities = st.activities.filter(a => a.id !== ex.id); }); router.back(); }} /></> : null}
    </Sheet>
  );
}
