import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Choices, Field, Gap, Input, Row, T, Tag } from '@/components/ui';
import { clock, fmtLong, mmss, num, today, uid } from '@/engine/dates';
import type { SportEvent } from '@/engine/types';
import { update, useApp } from '@/store/store';

export default function EventScreen() {
  const { id, edit: editParam } = useLocalSearchParams<{ id?: string; edit?: string }>(); const s = useApp();
  const ex = id ? s.events.find(e => e.id === id) : undefined;
  const [edit, setEdit] = useState(!ex || editParam === '1');
  const [f, setF] = useState<Partial<SportEvent>>(ex || { type: 'course', date: today(), priority: 'repère', status: 'prévu' });
  const set = (p: Partial<SportEvent>) => setF(x => ({ ...x, ...p }));
  const [err, setErr] = useState('');
  function save() {
    if (!f.name || !f.date) { setErr('Nom et date obligatoires.'); return; }
    const e = { ...(f as SportEvent), id: ex?.id || uid() };
    update(st => { const i = st.events.findIndex(x => x.id === e.id); if (i >= 0) st.events[i] = e; else st.events.push(e); });
    router.back();
  }
  return (
    <Sheet title={ex ? ex.name : 'Nouvel événement'} sub={ex ? fmtLong(ex.date) : 'Course, compétition, événement'}>
      {ex && !edit ? <Card>
        <Button kind="primary" block label="Ouvrir la préparation" onPress={() => router.replace({ pathname: '/race/[id]', params: { id: ex.id } })} /><Gap h={8} />
        <Row gap={6}><Tag>{ex.type}</Tag><Tag>{ex.priority}</Tag><Tag tone="accent">{ex.status}</Tag></Row>
        {ex.goal ? <T style={{ marginTop: 10 }}>{ex.goal}</T> : null}
        <T v="small" muted style={{ marginTop: 4 }}>{[ex.place, ex.time ? `départ ${ex.time}` : '', ex.distanceKm ? `${ex.distanceKm} km` : ''].filter(Boolean).join(' · ')}</T>
        {ex.result ? <T v="label" style={{ marginTop: 10 }}>{`${clock(ex.result.time)}${ex.distanceKm ? ` · ${mmss(ex.result.time / ex.distanceKm)}/km` : ''}${ex.result.elevM ? ` · ${ex.result.elevM} m D+` : ''}${ex.result.effort ? ` · effort ${ex.result.effort}/10` : ''}`}</T> : null}
        <Gap /><Button kind="primary" block label={ex.result ? 'Modifier le résultat' : 'Saisir mon résultat'} onPress={() => router.push({ pathname: '/result/[id]', params: { id: ex.id } })} />
        <Gap h={8} /><Button block label="Modifier l'événement" onPress={() => setEdit(true)} />
      </Card> : <View>
        <Field label="Nom"><Input defaultValue={f.name} onChangeText={t => set({ name: t })} /></Field>
        <Field label="Type"><Choices options={[['course', 'Course'], ['ocr', 'Obstacles'], ['hyrox-compet', 'HYROX'], ['autre', 'Autre']]} value={f.type} onChange={v => v && set({ type: v })} /></Field>
        <Row><View style={{ flex: 1 }}><Field label="Date"><Input defaultValue={f.date} placeholder="AAAA-MM-JJ" onChangeText={t => set({ date: t })} /></Field></View><View style={{ flex: 1 }}><Field label="Heure"><Input defaultValue={f.time} placeholder="09:00" onChangeText={t => set({ time: t })} /></Field></View></Row>
        <Row><View style={{ flex: 1 }}><Field label="Distance (km)"><Input keyboardType="decimal-pad" defaultValue={f.distanceKm != null ? String(f.distanceKm) : ''} onChangeText={t => set({ distanceKm: num(t) })} /></Field></View><View style={{ flex: 1 }}><Field label="Lieu"><Input defaultValue={f.place} onChangeText={t => set({ place: t })} /></Field></View></Row>
        <Field label="Priorité"><Choices options={[['participation', 'Participation'], ['repère', 'Repère'], ['objectif', 'Objectif']]} value={f.priority} onChange={v => v && set({ priority: v })} /></Field>
        <Field label="Objectif"><Input defaultValue={f.goal} onChangeText={t => set({ goal: t })} /></Field>
        <Field label="Statut"><Choices options={[['prévu', 'Prévu'], ['fait', 'Fait'], ['annulé', 'Annulé']]} value={f.status} onChange={v => v && set({ status: v })} /></Field>
        {err ? <T v="small" color="#C23B4C">{err}</T> : null}
        <Button kind="primary" block label={ex ? 'Enregistrer' : 'Ajouter'} onPress={save} />
        {ex ? <><Gap h={8} /><Button kind="danger" block label="Supprimer l'événement" onPress={() => { update(st => { st.events = st.events.filter(e => e.id !== ex.id); }); router.back(); }} /></> : null}
      </View>}
    </Sheet>
  );
}
