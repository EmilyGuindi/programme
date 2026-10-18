import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { APP_VERSION, CHANGELOG } from '@/changelog';
import { manualUpdateCheck } from '@/components/update-banner';
import { Bullets } from '@/components/guide';
import { AccountSection } from '@/components/account-section';
import { BackLink, Button, Card, Field, Gap, Input, ListGroup, ListRow, Row, Screen, Segmented, T, Toggle, Chip } from '@/components/ui';
import { phasesOf, weekOf } from '@/engine/coach';
import { addDays, DAYS_SHORT, fmtShort, num, today } from '@/engine/dates';
import { planReminders } from '@/engine/reminders';
import { askPermission, nextScheduled, permission, syncReminders, testNotification } from '@/notifications';
import { connectStrava, disconnectStrava, getState, pull, replaceState, setServer, stravaStatus, stravaSyncNow, testServer, update, useApp, useServer, useStrava, useSync } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';

const TITLES: Record<string, string> = { feedback: 'Retours et animations', goals: 'Objectifs', reminders: 'Rappels', connections: 'Compte et synchronisation', program: 'Programme', data: 'Mes données', news: 'Quoi de neuf' };

export default function Section() {
  const { section } = useLocalSearchParams<{ section: string }>();
  return (
    <Screen>
      <View style={{ paddingTop: space.s3, paddingBottom: space.s2 }}><BackLink label="Profil" onPress={() => router.back()} /></View>
      <T v="title" style={{ marginBottom: space.s3 }}>{TITLES[section] || 'Profil'}</T>
      {section === 'goals' ? <Goals /> : section === 'reminders' ? <Reminders /> : section === 'connections' ? <Connections /> : section === 'program' ? <Program /> : section === 'data' ? <Data /> : section === 'feedback' ? <Feedback /> : <News />}
    </Screen>
  );
}

function Goals() {
  const s = useApp();
  return (
    <>
      <Field label="Objectif running" hint=""><T v="small" muted style={{ marginBottom: 6 }}>Ce que tu vises à terme. Les étapes intermédiaires sont dans Mon parcours.</T><Input defaultValue={s.user.goals.run} onChangeText={t => update(st => { st.user.goals.run = t; })} /></Field>
      <Field label="Poids souhaité"><T v="small" muted style={{ marginBottom: 6 }}>Une cible, pas une obligation. Elle sert de repère sur la courbe.</T>
        <Row><Input style={{ width: 120 }} keyboardType="decimal-pad" defaultValue={String(s.user.goals.weightTarget).replace('.', ',')} onChangeText={t => { const v = num(t); if (v) update(st => { st.user.goals.weightTarget = v; }); }} /><T muted>kg</T></Row></Field>
      <Field label="Objectif physique"><T v="small" muted style={{ marginBottom: 6 }}>En quelques mots, ce que tu veux voir évoluer.</T><Input multiline style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }} defaultValue={s.user.goals.physique} onChangeText={t => update(st => { st.user.goals.physique = t; })} /></Field>
    </>
  );
}

const TIMES = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'];
function TimePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c } = useTheme(); const i = Math.max(0, TIMES.indexOf(value));
  const B = ({ g, to, d }: { g: string; to: number; d: boolean }) => <Pressable accessibilityRole="button" accessibilityLabel={g === '−' ? 'Plus tôt' : 'Plus tard'} disabled={d} hitSlop={6} onPress={() => onChange(TIMES[to])} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', opacity: d ? 0.35 : 1 }}><T v="label">{g}</T></Pressable>;
  return <Row gap={8}><B g="−" to={Math.max(0, i - 1)} d={i === 0} /><T v="num" style={{ minWidth: 64, textAlign: 'center', fontSize: 20 }}>{value.replace(':', ' h ')}</T><B g="+" to={Math.min(TIMES.length - 1, i + 1)} d={i === TIMES.length - 1} /></Row>;
}
function Reminders() {
  const s = useApp(); const { c } = useTheme(); const pr = s.user.prefs;
  const [perm, setPerm] = useState<string>('…'); const [next, setNext] = useState<Date | null>(null); const [msg, setMsg] = useState('');
  const refresh = async () => { setPerm(await permission()); await syncReminders(getState(), true); setNext(await nextScheduled()); };
  useEffect(() => { refresh(); }, [pr.checkinTime, pr.weighTime, pr.weighDay, pr.notifCheckin, pr.notifWeigh, pr.notifRecap]);
  const fmt = (d: Date) => `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`;
  const set = (fn: (p: typeof pr) => void) => update(st => fn(st.user.prefs));
  return (
    <>
      <View style={{ marginBottom: space.s5 }}>
        {perm === 'granted' ? <T>{next ? `Prochain rappel ${fmt(next)}.` : 'Aucun rappel programmé.'}</T>
          : perm === 'denied' ? <T color={c.stop}>Les notifications sont bloquées pour BYYND dans Android.</T>
          : perm === '…' ? <T muted>Vérification…</T> : <T>Les notifications ne sont pas encore autorisées.</T>}
        {perm === 'undetermined' ? <Button kind="primary" block style={{ marginTop: space.s3 }} label="Autoriser les notifications" onPress={async () => { await askPermission(); refresh(); }} /> : null}
        {perm === 'denied' ? <Button kind="primary" block style={{ marginTop: space.s3 }} label="Ouvrir les réglages Android" onPress={() => Linking.openSettings()} /> : null}
      </View>
      <ListGroup title="Rappels">
        <ListRow chevron={false} title="Check-in du matin" sub="Chaque jour, sauf s'il est déjà fait" right={<Toggle label="Check-in du matin" value={pr.notifCheckin} onChange={v => set(p => { p.notifCheckin = v; })} />} last={!pr.notifCheckin} />
        {pr.notifCheckin ? <ListRow chevron={false} title="Heure" right={<TimePick value={pr.checkinTime} onChange={v => set(p => { p.checkinTime = v; })} />} /> : null}
        <ListRow chevron={false} title="Pesée" sub="Une fois par semaine, sauf si déjà faite" right={<Toggle label="Pesée" value={pr.notifWeigh} onChange={v => set(p => { p.notifWeigh = v; })} />} />
        {pr.notifWeigh ? <><View style={{ paddingHorizontal: space.s4, paddingBottom: space.s3 }}><Segmented options={DAYS_SHORT.map((d, i) => [String(i), d]) as [string, string][]} value={String(pr.weighDay)} onChange={v => set(p => { p.weighDay = +v; })} /></View>
          <ListRow chevron={false} title="Heure" right={<TimePick value={pr.weighTime} onChange={v => set(p => { p.weighTime = v; })} />} /></> : null}
        <ListRow last chevron={false} title="Bilan du dimanche" sub="À 19 h, quand ta semaine est prête" right={<Toggle label="Bilan du dimanche" value={pr.notifRecap !== false} onChange={v => set(p => { p.notifRecap = v; })} />} />
      </ListGroup>
      <T v="small" muted>Check-in et pesée à moins d'une heure d'écart arrivent en un seul message.</T>
      {perm === 'granted' ? <Button small kind="ghost" label="Envoyer une notification de test" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space.s3 }} onPress={async () => { await testNotification(); setMsg('Elle arrive dans 5 secondes.'); }} /> : null}
      {msg ? <T v="small">{msg}</T> : null}
      <T v="xs" muted style={{ marginTop: space.s5 }}>Rappel absent ? Paramètres Android → Applications → BYYND → Batterie → Non restreinte.</T>
    </>
  );
}

function Connections() {
  const sv = useServer(); const st = useStrava();
  const [smsg, setSmsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { stravaStatus(); }, [sv.url, sv.key, sv.session]);
  return (
    <>
      <AccountSection />
      <Card>
        <T v="h3">Strava</T>
        <T v="small" muted style={{ marginVertical: 6 }}>{!(sv.key || sv.session) ? 'Connecte-toi d\'abord avec Google ci-dessus.' : !st ? 'Statut inconnu.' : !st.configured ? 'Le serveur attend les identifiants Strava.' : st.connected ? `Connecté${st.athlete ? ` en tant que ${st.athlete}` : ''}${st.lastSync ? `, synchro ${new Date(st.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}` : st.error ? 'Accès expiré : reconnecte Strava.' : 'Non connecté.'}</T>
        {st?.connected ? (
          <Row><Button label={busy ? 'Synchronisation…' : 'Synchroniser'} style={{ flex: 1 }} disabled={busy} onPress={async () => { setBusy(true); const n = await stravaSyncNow(14); setBusy(false); setSmsg(n ? `${n} activité${n > 1 ? 's' : ''} mise${n > 1 ? 's' : ''} à jour.` : 'Tout est à jour.'); }} />
            <Button kind="danger" label="Déconnecter" onPress={() => Alert.alert('Déconnecter Strava ?', 'BYYND n\'aura plus accès à tes activités. Celles déjà importées restent.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnecter', style: 'destructive', onPress: () => disconnectStrava() }])} /></Row>
        ) : (
          <Button kind="primary" label={busy ? 'Connexion…' : 'Connecter Strava'} disabled={busy} onPress={async () => {
            setBusy(true); setSmsg('');
            if (!sv.url || !(sv.key || sv.session)) { setSmsg('Connecte-toi d\'abord avec Google ci-dessus.'); setBusy(false); return; }
            const cur = await stravaStatus();
            if (!cur) setSmsg('Serveur injoignable, ou Strava réservé au compte propriétaire.');
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
  const s = useApp(); const { c } = useTheme(); const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, today())));
  const PH = phasesOf(s.program);
  return (
    <>
      <T muted style={{ marginBottom: space.s4 }}>{`Du ${fmtShort(s.program.start)} au ${fmtShort(addDays(s.program.start, s.program.weeks * 7 - 1))}. Semaine ${w} sur ${s.program.weeks}.`}</T>
      <ListGroup title="Phases">
        {PH.map((p, i) => { const st = w > p.to ? 'terminée' : w >= p.from ? 'en cours' : 'à venir'; return (
          <ListRow key={p.n + i} last={i === PH.length - 1} chevron={false} title={`${p.name}`} sub={`Semaine${p.to !== p.from ? `s ${p.from} à ${p.to}` : ` ${p.from}`}. ${p.goal}`}
            leftWidth={28} left={<View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: st === 'en cours' ? c.accent : st === 'terminée' ? c.ink : c.surface2 }}><T v="label" color={st === 'à venir' ? c.ink2 : st === 'en cours' ? c.accentInk : c.paper}>{p.n}</T></View>}
            right={st === 'en cours' ? <Chip tone="accent" label="En cours" /> : st === 'terminée' ? <Chip label="Terminée" /> : undefined} />); })}
      </ListGroup>
      <ListGroup title="Compétitions du cycle">
        {s.events.filter(e => e.status !== 'annulé').sort((a, b) => a.date.localeCompare(b.date)).map((e, i, arr) => <ListRow key={e.id} last={i === arr.length - 1} title={e.name} sub={`${fmtShort(e.date)}${e.result ? ', terminée' : ''}`} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} />)}
      </ListGroup>
      <T v="small" muted>{s.program.template === 'custom' ? 'Une séance manquée ne se rattrape pas : la suite s\'ajuste.' : 'Semaine allégée en S12. Une séance manquée ne se rattrape pas : la suite s\'ajuste.'}</T>
      <Button block style={{ marginTop: space.s4 }} label="Mes programmes" onPress={() => router.push('/programs')} />
    </>
  );
}

/** Préférences de ressenti : haptique, animations, mise en scène des accomplissements. */
function Feedback() {
  const s = useApp(); const pr = s.user.prefs;
  const set = (fn: (p: typeof pr) => void) => update(st => fn(st.user.prefs));
  return (
    <ListGroup>
      <ListRow title="Retours haptiques" sub="Une vibration brève quand tu coches, valides ou débloques quelque chose." chevron={false} right={<Toggle label="Retours haptiques" value={pr.haptics !== false} onChange={v => set(p => { p.haptics = v; })} />} />
      <ListRow title="Animations réduites" sub="Coches, jauges et accomplissements sans mouvement. Le réglage Android « Supprimer les animations » est aussi respecté." chevron={false} right={<Toggle label="Animations réduites" value={pr.motion === 'reduced'} onChange={v => set(p => { p.motion = v ? 'reduced' : 'system'; })} />} />
      <ListRow last title="Mettre en scène les accomplissements" sub="Quand un jalon est atteint, il est présenté une fois sur Aujourd'hui et Progression. Désactivé : il apparaît simplement dans la liste." chevron={false} right={<Toggle label="Mettre en scène les accomplissements" value={pr.celebrate !== false} onChange={v => set(p => { p.celebrate = v; })} />} />
    </ListGroup>
  );
}

function Data() {
  const s = useApp(); const sv = useServer(); const pr = s.user.prefs;
  async function exportData() {
    const f = new File(Paths.cache, `byynd-${today()}.json`); if (f.exists) f.delete(); f.create(); f.write(JSON.stringify(getState(), null, 1));
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Sauvegarde BYYND' });
  }
  async function importData() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true }); if (r.canceled) return;
    try { const d = JSON.parse(await new File(r.assets[0].uri).text());
      Alert.alert('Remplacer tes données ?', 'Toutes les données de ce téléphone seront remplacées par celles de la sauvegarde. Cette action est irréversible.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Remplacer', style: 'destructive', onPress: () => replaceState(d) }]);
    } catch { Alert.alert('Fichier non reconnu', 'Choisis un fichier exporté depuis BYYND.'); }
  }
  return (
    <>
      <ListGroup title="Où sont tes données">
        <ListRow chevron={false} title="Sur ce téléphone" sub={`${s.activities.length} activités, ${s.measurements.length} pesées, ${Object.keys(s.checkins).length} check-ins`} />
        <ListRow last chevron={false} title="Sur ton serveur" sub={sv.session ? `Compte ${sv.account?.email || 'Google'}, synchronisé automatiquement` : sv.key ? 'Synchronisé avec la clé historique' : 'Non connecté : voir Compte et synchronisation'} />
      </ListGroup>
      <ListGroup title="Préférences">
        <ListRow last chevron={false} title="Cycle menstruel dans le check-in" sub="Facultatif. Aide à lire les variations de poids." right={<Toggle label="Cycle menstruel" value={pr.cycleOptIn} onChange={v => update(st => { st.user.prefs.cycleOptIn = v; })} />} />
      </ListGroup>
      <ListGroup title="Sauvegarde">
        <ListRow title="Exporter une copie" sub="Un fichier à garder où tu veux" onPress={exportData} />
        <ListRow last title="Importer une sauvegarde" sub="Remplace les données de ce téléphone" onPress={importData} />
      </ListGroup>
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
      {CHANGELOG.map(v => <Card key={v.version}><Row between><T v="label">{`Version ${v.version}`}</T><T v="small" muted>{v.date}</T></Row><Gap h={6} /><Bullets items={v.items} /></Card>)}
    </>
  );
}
