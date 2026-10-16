import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { APP_VERSION, CHANGELOG } from '@/changelog';
import { manualUpdateCheck } from '@/components/update-banner';
import { Bullets } from '@/components/guide';
import { Button, Card, Field, Gap, Input, Row, Screen, Segmented, T } from '@/components/ui';
import { phaseOf, weekOf } from '@/engine/coach';
import { addDays, DAYS_SHORT, fmtShort, num, today } from '@/engine/dates';
import { planReminders } from '@/engine/reminders';
import { askPermission, nextScheduled, permission, syncReminders, testNotification } from '@/notifications';
import { connectStrava, disconnectStrava, getState, pull, replaceState, setServer, stravaStatus, stravaSyncNow, testServer, update, useApp, useServer, useStrava, useSync } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

const TITLES: Record<string, string> = { goals: 'Objectifs', reminders: 'Rappels', connections: 'Connexions', program: 'Programme', data: 'Mes données', news: 'Quoi de neuf' };

export default function Section() {
  const { section } = useLocalSearchParams<{ section: string }>();
  return (
    <Screen>
      <Row style={{ paddingTop: space.s4, paddingBottom: space.s3 }}><Button small label="‹ Profil" onPress={() => router.back()} /></Row>
      <T v="title" style={{ marginBottom: space.s3 }}>{TITLES[section] || 'Profil'}</T>
      {section === 'goals' ? <Goals /> : section === 'reminders' ? <Reminders /> : section === 'connections' ? <Connections /> : section === 'program' ? <Program /> : section === 'data' ? <Data /> : <News />}
    </Screen>
  );
}

function Goals() {
  const s = useApp();
  return (
    <Card>
      <Field label="Poids souhaité (kg)" hint="une cible, pas une obligation"><Input keyboardType="decimal-pad" defaultValue={String(s.user.goals.weightTarget).replace('.', ',')} onChangeText={t => { const v = num(t); if (v) update(st => { st.user.goals.weightTarget = v; }); }} /></Field>
      <Field label="Running"><Input defaultValue={s.user.goals.run} onChangeText={t => update(st => { st.user.goals.run = t; })} /></Field>
      <Field label="Physique"><Input multiline style={{ minHeight: 90, paddingTop: 12 }} defaultValue={s.user.goals.physique} onChangeText={t => update(st => { st.user.goals.physique = t; })} /></Field>
    </Card>
  );
}

const TIMES = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];
function TimePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const i = Math.max(0, TIMES.indexOf(value));
  return (
    <Row>
      <Button small label="−" onPress={() => onChange(TIMES[Math.max(0, i - 1)])} />
      <T v="h2" style={{ minWidth: 80, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value.replace(':', ' h ')}</T>
      <Button small label="+" onPress={() => onChange(TIMES[Math.min(TIMES.length - 1, i + 1)])} />
    </Row>
  );
}
function Reminders() {
  const s = useApp(); const { c } = useTheme(); const pr = s.user.prefs;
  const [perm, setPerm] = useState<string>('…'); const [next, setNext] = useState<Date | null>(null); const [msg, setMsg] = useState('');
  const refresh = async () => { setPerm(await permission()); await syncReminders(getState(), true); setNext(await nextScheduled()); };
  useEffect(() => { refresh(); }, [pr.checkinTime, pr.weighTime, pr.weighDay, pr.notifCheckin, pr.notifWeigh, pr.notifRecap]);
  const planned = planReminders(s).slice(0, 3);
  const fmt = (d: Date) => `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return (
    <>
      <Card>
        <T v="h3">État</T>
        <T style={{ marginTop: 6 }} color={perm === 'granted' ? c.ok : perm === 'denied' ? c.stop : undefined}>
          {perm === 'granted' ? 'Notifications autorisées.' : perm === 'denied' ? 'Notifications bloquées dans les réglages Android.' : perm === '…' ? 'Vérification…' : 'Pas encore autorisées.'}
        </T>
        {perm === 'granted' ? <T v="small" muted style={{ marginTop: 4 }}>{next ? `Prochain rappel : ${fmt(next)}.` : 'Aucun rappel programmé (tout est déjà fait, ou rappels désactivés).'}</T> : null}
        <Gap h={space.s3} />
        {perm === 'undetermined' ? <Button kind="primary" block label="Autoriser les notifications" onPress={async () => { await askPermission(); refresh(); }} /> : null}
        {perm === 'denied' ? <Button kind="primary" block label="Ouvrir les réglages" onPress={() => Linking.openSettings()} /> : null}
        {perm === 'granted' ? <Button block label="M'envoyer une notification de test" onPress={async () => { await testNotification(); setMsg('Envoyée : elle arrive dans 5 secondes. Verrouille ton téléphone pour vérifier qu\'elle s\'affiche aussi app fermée, puis ouvre-la : elle doit t\'amener au check-in.'); }} /> : null}
        {msg ? <T v="small" style={{ marginTop: 8 }}>{msg}</T> : null}
      </Card>
      <Card>
        <Row between><T v="h3">Check-in du matin</T><Button small label={pr.notifCheckin ? 'Activé' : 'Désactivé'} kind={pr.notifCheckin ? 'primary' : 'secondary'} onPress={() => update(st => { st.user.prefs.notifCheckin = !st.user.prefs.notifCheckin; })} /></Row>
        {pr.notifCheckin ? <View style={{ marginTop: space.s3 }}><TimePick value={pr.checkinTime} onChange={v => update(st => { st.user.prefs.checkinTime = v; })} /></View> : null}
        <T v="small" muted style={{ marginTop: 8 }}>Chaque jour. Pas de rappel si ton check-in est déjà fait.</T>
      </Card>
      <Card>
        <Row between><T v="h3">Pesée hebdo</T><Button small label={pr.notifWeigh ? 'Activé' : 'Désactivé'} kind={pr.notifWeigh ? 'primary' : 'secondary'} onPress={() => update(st => { st.user.prefs.notifWeigh = !st.user.prefs.notifWeigh; })} /></Row>
        {pr.notifWeigh ? <View style={{ marginTop: space.s3, gap: space.s3 }}>
          <Segmented options={DAYS_SHORT.map((d, i) => [String(i), d]) as [string, string][]} value={String(pr.weighDay)} onChange={v => update(st => { st.user.prefs.weighDay = +v; })} />
          <TimePick value={pr.weighTime} onChange={v => update(st => { st.user.prefs.weighTime = v; })} />
        </View> : null}
        <T v="small" muted style={{ marginTop: 8 }}>Pas de rappel si tu t'es déjà pesée cette semaine. Si les deux tombent à moins d'une heure d'écart, tu reçois un seul message.</T>
      </Card>
      <Card>
        <Row between><T v="h3">Bilan du dimanche</T><Button small label={pr.notifRecap !== false ? 'Activé' : 'Désactivé'} kind={pr.notifRecap !== false ? 'primary' : 'secondary'} onPress={() => update(st => { st.user.prefs.notifRecap = st.user.prefs.notifRecap === false; })} /></Row>
        <T v="small" muted style={{ marginTop: 8 }}>Le dimanche à 19 h, quand ton bilan de la semaine est prêt. Jamais deux fois pour la même semaine.</T>
      </Card>
      {planned.length ? <Card><T v="h3">Les 3 prochains</T>{planned.map(r => <T key={r.id} v="small" style={{ marginTop: 6 }}>{`${fmt(r.at)} · ${r.kind === 'both' ? 'check-in et pesée' : r.kind === 'weigh' ? 'pesée' : r.kind === 'recap' ? 'bilan' : 'check-in'}`}</T>)}</Card> : null}
      <T v="xs" muted>Les rappels sont programmés sur ton téléphone : ils arrivent même app fermée et sans connexion. Si un rappel n'arrive pas, vérifie que l'économie de batterie n'est pas appliquée à BYYND (Paramètres → Applis → BYYND → Batterie → Non restreinte).</T>
    </>
  );
}

function Connections() {
  const sv = useServer(); const sync = useSync(); const st = useStrava(); const { c } = useTheme();
  const [msg, setMsg] = useState(''); const [smsg, setSmsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { stravaStatus(); }, [sv.url, sv.key]);
  const syncText = { local: 'Sur ce téléphone uniquement', sync: 'Synchronisation…', ok: 'Synchronisé', err: `Erreur : ${sync.msg}`, off: sync.msg }[sync.status];
  return (
    <>
      <Card>
        <T v="h3">Serveur BYYND</T>
        <T v="xs" color={sync.status === 'err' ? c.stop : c.ink2} style={{ marginVertical: 6 }}>{syncText}</T>
        <Field label="Adresse"><Input autoCapitalize="none" autoCorrect={false} keyboardType="url" defaultValue={sv.url} placeholder="https://byynd.emilyguindi.workers.dev" onChangeText={t => setServer({ url: t.trim() })} /></Field>
        <Field label="Clé d'accès"><Input secureTextEntry autoCapitalize="none" autoCorrect={false} defaultValue={sv.key} placeholder="ta phrase APP_KEY" onChangeText={t => setServer({ key: t.trim() })} /></Field>
        <Row><Button label="Synchroniser" style={{ flex: 1 }} onPress={() => pull()} /><Button label="Tester" onPress={async () => setMsg(await testServer())} /></Row>
        {msg ? <T v="small" style={{ marginTop: 8 }}>{msg}</T> : null}
      </Card>
      <Card>
        <T v="h3">Strava</T>
        <T v="small" muted style={{ marginVertical: 6 }}>{!sv.url ? 'Configure d\'abord le serveur ci-dessus.' : !st ? 'Statut inconnu.' : !st.configured ? 'Le serveur attend les identifiants Strava.' : st.connected ? `Connecté${st.athlete ? ` · ${st.athlete}` : ''}${st.lastSync ? ` · synchro ${new Date(st.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}` : st.error ? 'Accès expiré : reconnecte Strava.' : 'Non connecté.'}</T>
        {st?.connected ? (
          <Row><Button label={busy ? 'Synchronisation…' : 'Synchroniser'} style={{ flex: 1 }} disabled={busy} onPress={async () => { setBusy(true); const n = await stravaSyncNow(14); setBusy(false); setSmsg(n ? `${n} activité${n > 1 ? 's' : ''} mise${n > 1 ? 's' : ''} à jour.` : 'Tout est à jour.'); }} />
            <Button kind="danger" label="Déconnecter" onPress={() => Alert.alert('Déconnecter Strava ?', 'BYYND n\'aura plus accès à tes activités. Celles déjà importées restent.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnecter', style: 'destructive', onPress: () => disconnectStrava() }])} /></Row>
        ) : (
          <Button kind="primary" label={busy ? 'Connexion…' : 'Connecter Strava'} disabled={busy} onPress={async () => {
            setBusy(true); setSmsg('');
            if (!sv.url || !sv.key) { setSmsg('Renseigne d\'abord l\'adresse du serveur et ta clé, puis appuie sur Tester.'); setBusy(false); return; }
            const cur = await stravaStatus();
            if (!cur) setSmsg('Serveur injoignable ou clé refusée : vérifie avec le bouton Tester.');
            else if (!cur.configured) setSmsg('Le serveur ne voit pas encore les identifiants Strava.');
            else setSmsg(await connectStrava());
            setBusy(false);
          }} />
        )}
        {smsg ? <T v="small" style={{ marginTop: 8 }}>{smsg}</T> : null}
        <T v="xs" muted style={{ marginTop: 8 }}>Les nouvelles activités arrivent quelques minutes après leur envoi sur Strava, avec un rattrapage toutes les heures.</T>
      </Card>
    </>
  );
}

function Program() {
  const s = useApp(); const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, today()))); const ph = phaseOf(w);
  return (
    <Card>
      <T v="h3">{s.program.name}</T>
      <T style={{ marginTop: 6 }}>{`${fmtShort(s.program.start)} → ${fmtShort(addDays(s.program.start, s.program.weeks * 7 - 1))}`}</T>
      <T style={{ marginTop: 6 }}>{`Semaine ${w} sur ${s.program.weeks} · Phase ${ph.n}, ${ph.name}`}</T>
      <Gap />
      <Bullets items={['A · Évaluation (S1–S5) : courses de l\'automne, repères 10 km.', 'B · Base aérobie (S6–S10) : endurance, premières séances au seuil.', 'C · Seuil (S11–S15) : allure soutenue, repère fin janvier.', 'D · Spécifique 10 km (S16–S19) : allure cible, bilan mi-février.', 'Bilan (S20).']} />
    </Card>
  );
}

function Data() {
  const s = useApp(); const pr = s.user.prefs;
  async function exportData() {
    const f = new File(Paths.cache, `byynd-${today()}.json`); if (f.exists) f.delete(); f.create(); f.write(JSON.stringify(getState(), null, 1));
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Sauvegarde BYYND' });
  }
  async function importData() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true }); if (r.canceled) return;
    try { const d = JSON.parse(await new File(r.assets[0].uri).text());
      Alert.alert('Importer cette sauvegarde ?', 'Les données de ce téléphone seront remplacées.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Importer', style: 'destructive', onPress: () => replaceState(d) }]);
    } catch { Alert.alert('Fichier non reconnu'); }
  }
  return (
    <>
      <Card>
        <Row between><View style={{ flex: 1 }}><T v="label">Cycle menstruel dans le check-in</T><T v="small" muted>Facultatif. Aide à lire les variations de poids.</T></View>
          <Button small label={pr.cycleOptIn ? 'Activé' : 'Désactivé'} kind={pr.cycleOptIn ? 'primary' : 'secondary'} onPress={() => update(st => { st.user.prefs.cycleOptIn = !st.user.prefs.cycleOptIn; })} /></Row>
      </Card>
      <Card>
        <T v="h3">Sauvegarde</T>
        <T v="small" muted style={{ marginVertical: 6 }}>Tes données sont sur ton téléphone et sur ton serveur. Un export te donne en plus une copie à garder.</T>
        <Row><Button label="Exporter" style={{ flex: 1 }} onPress={exportData} /><Button label="Importer" style={{ flex: 1 }} onPress={importData} /></Row>
      </Card>
    </>
  );
}

function News() {
  const { c } = useTheme(); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const installed = Updates.isEmbeddedLaunch ? 'version installée avec l\'APK' : `mise à jour à distance${Updates.createdAt ? ` du ${Updates.createdAt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}`;
  return (
    <>
      <Card>
        <T v="h3">{`Version ${APP_VERSION}`}</T>
        <T v="small" muted style={{ marginTop: 4 }}>{installed}</T>
        <Gap h={space.s3} />
        {msg === 'ready'
          ? <Button kind="primary" block label="Redémarrer pour appliquer" onPress={() => Updates.reloadAsync()} />
          : <Button block disabled={busy} label={busy ? 'Recherche…' : 'Rechercher une mise à jour'} onPress={async () => { setBusy(true); setMsg(await manualUpdateCheck()); setBusy(false); }} />}
        {msg && msg !== 'ready' ? <T v="small" style={{ marginTop: 8 }} color={msg.startsWith('Impossible') ? c.stop : undefined}>{msg}</T> : null}
        {msg === 'ready' ? <T v="small" style={{ marginTop: 8 }}>Nouvelle version téléchargée.</T> : null}
      </Card>
      {CHANGELOG.map(v => <Card key={v.version}><T v="label">{`${v.version} · ${v.date}`}</T><Gap h={6} /><Bullets items={v.items} /></Card>)}
    </>
  );
}
