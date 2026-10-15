import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Wordmark } from '@/components/logo';
import * as Updates from 'expo-updates';
import { APP_VERSION, CHANGELOG } from '@/changelog';
import { View } from 'react-native';
import { Button, Card, Field, Gap, Input, Row, Screen, Segmented, T } from '@/components/ui';
import { weekOf } from '@/engine/coach';
import { addDays, DAYS_SHORT, fmtShort, num, today } from '@/engine/dates';
import { getState, pull, replaceState, setServer, testServer, update, useApp, useServer, useSync } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

export default function Profile() {
  const s = useApp(); const sv = useServer(); const sync = useSync(); const { c } = useTheme();
  const [msg, setMsg] = useState('');
  const pr = s.user.prefs;
  const syncText = { local: 'Sur ce téléphone uniquement', sync: 'Synchronisation…', ok: 'Synchronisé', err: `Erreur : ${sync.msg}`, off: sync.msg }[sync.status];
  async function exportData() {
    const f = new File(Paths.cache, `byynd-${today()}.json`); if (f.exists) f.delete(); f.create(); f.write(JSON.stringify(getState(), null, 1));
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Sauvegarde BYYND' });
  }
  async function importData() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true }); if (r.canceled) return;
    try { const txt = await new File(r.assets[0].uri).text(); const d = JSON.parse(txt);
      Alert.alert('Importer cette sauvegarde ?', 'Les données de ce téléphone seront remplacées.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Importer', style: 'destructive', onPress: () => replaceState(d) }]);
    } catch { Alert.alert('Fichier non reconnu'); }
  }
  const toggle = (k: 'notifCheckin' | 'notifWeigh' | 'cycleOptIn') => update(st => { st.user.prefs[k] = !st.user.prefs[k]; });
  return (
    <Screen>
      <T v="title" style={{ paddingTop: space.s4, paddingBottom: space.s3 }}>Profil</T>
      <Card>
        <T v="h3">Objectifs</T><Gap />
        <Field label="Poids souhaité (kg)"><Input keyboardType="decimal-pad" defaultValue={String(s.user.goals.weightTarget)} onEndEditing={e => { const v = num(e.nativeEvent.text); if (v) update(st => { st.user.goals.weightTarget = v; }); }} /></Field>
        <Field label="Running"><Input defaultValue={s.user.goals.run} onEndEditing={e => update(st => { st.user.goals.run = e.nativeEvent.text; })} /></Field>
        <Field label="Physique"><Input multiline style={{ minHeight: 80, paddingTop: 12 }} defaultValue={s.user.goals.physique} onEndEditing={e => update(st => { st.user.goals.physique = e.nativeEvent.text; })} /></Field>
      </Card>
      <Card>
        <T v="h3">Serveur BYYND</T>
        <T v="small" muted style={{ marginVertical: 6 }}>Sauvegarde hors du téléphone et synchro. </T>
        <T v="xs" color={sync.status === 'err' ? c.stop : c.ink2}>{syncText}</T><Gap />
        <Field label="Adresse"><Input autoCapitalize="none" autoCorrect={false} keyboardType="url" defaultValue={sv.url} placeholder="https://byynd.xxx.workers.dev" onEndEditing={e => setServer({ url: e.nativeEvent.text.trim() })} /></Field>
        <Field label="Clé d'accès"><Input secureTextEntry autoCapitalize="none" defaultValue={sv.key} placeholder="APP_KEY" onEndEditing={e => setServer({ key: e.nativeEvent.text.trim() })} /></Field>
        <Row><Button label="Synchroniser" style={{ flex: 1 }} onPress={() => pull()} /><Button label="Tester" onPress={async () => setMsg(await testServer())} /></Row>
        {msg ? <T v="small" style={{ marginTop: 8 }}>{msg}</T> : null}
      </Card>
      <Card>
        <T v="h3">Strava</T>
        <T v="small" muted style={{ marginVertical: 6 }}>Lot 4. En attendant, ajoute une activité depuis Aujourd'hui ou Programme.</T>
        <Button label="Connecter Strava · bientôt" disabled onPress={() => {}} />
      </Card>
      <Card>
        <T v="h3">Rappels</T>
        <T v="small" muted style={{ marginVertical: 6 }}>Notifications natives au lot 3. Tes horaires sont déjà enregistrés.</T>
        <Row><Field label="Check-in"><Input defaultValue={pr.checkinTime} placeholder="07:00" onEndEditing={e => update(st => { st.user.prefs.checkinTime = e.nativeEvent.text; })} style={{ width: 120 }} /></Field>
          <Field label="Pesée"><Input defaultValue={pr.weighTime} placeholder="07:30" onEndEditing={e => update(st => { st.user.prefs.weighTime = e.nativeEvent.text; })} style={{ width: 120 }} /></Field></Row>
        <Field label="Jour de pesée"><Segmented options={DAYS_SHORT.map((d, i) => [String(i), d]) as [string, string][]} value={String(pr.weighDay)} onChange={v => update(st => { st.user.prefs.weighDay = +v; })} /></Field>
        <Row between style={{ marginBottom: 8 }}><T>Rappel check-in</T><Button small label={pr.notifCheckin ? 'Activé' : 'Désactivé'} onPress={() => toggle('notifCheckin')} /></Row>
        <Row between><T>Rappel pesée</T><Button small label={pr.notifWeigh ? 'Activé' : 'Désactivé'} onPress={() => toggle('notifWeigh')} /></Row>
      </Card>
      <Card>
        <T v="h3">Programme</T>
        <T v="small" style={{ marginTop: 6 }}>{`${s.program.name} · ${fmtShort(s.program.start)} → ${fmtShort(addDays(s.program.start, s.program.weeks * 7 - 1))} · semaine ${Math.min(s.program.weeks, Math.max(1, weekOf(s, today())))}/${s.program.weeks}`}</T>
        <T v="small" muted style={{ marginTop: 6 }}>Phases : A Évaluation S1–S5 · B Base S6–S10 · C Seuil S11–S15 · D Spécifique S16–S19 · Bilan S20.</T>
      </Card>
      <Card>
        <T v="h3">Données</T>
        <Row between style={{ marginVertical: 10 }}><T>Cycle menstruel dans le check-in</T><Button small label={pr.cycleOptIn ? 'Activé' : 'Désactivé'} onPress={() => toggle('cycleOptIn')} /></Row>
        <Row><Button label="Exporter" style={{ flex: 1 }} onPress={exportData} /><Button label="Importer" style={{ flex: 1 }} onPress={importData} /></Row>
      </Card>
      <Card>
        <T v="h3">Quoi de neuf</T>
        {CHANGELOG.slice(0, 3).map(v => <View key={v.version} style={{ marginTop: space.s3 }}><T v="label">{`${v.version} · ${v.date}`}</T>{v.items.map(i => <T key={i} v="small" muted>{`· ${i}`}</T>)}</View>)}
      </Card>
      <View style={{ alignItems: 'center', marginTop: space.s4, gap: 8 }}><Wordmark height={14} tagline /><T v="xs" muted>{`Version ${APP_VERSION}${Updates.isEmbeddedLaunch ? '' : ' · mise à jour à distance'}${Updates.createdAt ? ` du ${Updates.createdAt.toLocaleDateString('fr-FR')}` : ''}`}</T></View>
    </Screen>
  );
}
