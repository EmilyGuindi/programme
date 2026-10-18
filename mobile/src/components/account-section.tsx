import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { deleteAccount, finishLink, listBackups, listSessions, localBackup, logout, logoutAll, restoreBackup, restoreLocalBackup, revokeSession, signInWithGoogle, type DeviceSession, type LinkPreview, type ServerBackup } from '@/account';
import type { Counts } from '@/store/store';
import { pull, setServer, testServer, useServer, useSync } from '@/store/store';
import { space, useTheme } from '@/theme/tokens';
import { Button, Card, Chip, Field, Input, ListGroup, ListRow, Row, T } from './ui';

const when = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const sum = (n: Counts) => `${n.activities} activités, ${n.sessions} séances notées, ${n.checkins} check-ins, ${n.measurements} pesées`;

/** Compte et sécurité : connexion Google, rattachement non destructif, synchronisation, appareils, sauvegardes, suppression. */
export function AccountSection() {
  const sv = useServer(); const sync = useSync(); const { c } = useTheme();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [devices, setDevices] = useState<DeviceSession[]>([]); const [backups, setBackups] = useState<ServerBackup[]>([]);
  const [local, setLocal] = useState<{ at: number; counts: Counts } | null>(null); const [advanced, setAdvanced] = useState(false);
  const signed = !!sv.session;
  const refresh = async () => { if (signed) { setDevices(await listSessions()); setBackups(await listBackups()); } setLocal(await localBackup()); };
  useEffect(() => { refresh(); }, [signed]);

  async function connect() {
    setBusy(true); setMsg('');
    const r = await signInWithGoogle(sv.key);
    setBusy(false);
    if (!r.ok) { setMsg(r.message); return; }
    setPreview(r.preview); refresh();
  }
  async function link(choice: 'merge' | 'server') { if (!preview) return; setBusy(true); await finishLink(preview, choice); setBusy(false); setPreview(null); setMsg(choice === 'merge' ? 'Données rattachées à ton compte. Une copie de ce téléphone reste disponible ci-dessous.' : 'Version du compte reprise. La copie de ce téléphone reste restaurable ci-dessous.'); refresh(); }
  const statusText = { local: 'Sur ce téléphone uniquement', pending: 'Modifications en attente d\'envoi', sync: 'Synchronisation…', ok: 'Synchronisé', err: sync.msg, off: sync.msg }[sync.status];

  return (
    <>
      <Card>
        <T v="h3">Compte</T>
        {signed ? <>
          <Row gap={8} style={{ marginTop: 6, flexWrap: 'wrap' }}><T>{sv.account?.email || 'Compte Google'}</T>{sv.account?.owner ? <Chip tone="accent" label="Propriétaire" /> : null}</Row>
          <T v="small" muted style={{ marginTop: 4 }}>Connexion Google vérifiée par ton serveur. BYYND ne lit ni tes e-mails ni ton Drive.</T>
        </> : <>
          <T v="small" muted style={{ marginVertical: 6 }}>Connecte-toi avec Google pour retrouver tes données sur tous tes appareils. Seuls ton nom et ton adresse sont demandés, aucun accès Gmail ni Drive.</T>
          <Button kind="primary" block disabled={busy} label={busy ? 'Connexion…' : 'Se connecter avec Google'} onPress={connect} />
          {sv.key ? <T v="xs" muted style={{ marginTop: 8 }}>Ta clé actuelle sert une dernière fois à prouver que les données du serveur sont bien les tiennes. Rien n'est écrasé.</T> : null}
        </>}
        {msg ? <T v="small" style={{ marginTop: 8 }}>{msg}</T> : null}
      </Card>

      {preview ? <Card>
        <T v="h3">{preview.migrated ? 'Données du serveur rattachées' : 'Rattacher tes données'}</T>
        <T v="small" muted style={{ marginTop: 4 }}>Rien n'a encore changé sur ce téléphone. Une copie complète a été faite avant la connexion.</T>
        <ListGroup>
          <ListRow chevron={false} title="Sur ce téléphone" sub={sum(preview.local)} />
          <ListRow last chevron={false} title={`Sur le compte ${preview.email}`} sub={preview.server ? `${sum(preview.server)}, modifié le ${when(preview.serverUpdatedAt)}` : 'Vide'} />
        </ListGroup>
        <Button kind="primary" block disabled={busy} label={preview.server ? 'Fusionner (recommandé)' : 'Envoyer mes données vers le compte'} onPress={() => link('merge')} />
        {preview.server ? <><View style={{ height: space.s2 }} /><Button block disabled={busy} label="Reprendre la version du compte" onPress={() => link('server')} /></> : null}
        {preview.server ? <T v="xs" muted style={{ marginTop: 8 }}>Fusionner garde tout : activités, coches et notes des deux côtés. Pour un même élément, la modification la plus récente l'emporte.</T> : null}
      </Card> : null}

      {sv.url && (signed || sv.key) ? <ListGroup title="Synchronisation">
        <ListRow chevron={false} title={statusText} sub={sync.lastOk ? `Dernier envoi réussi ${when(sync.lastOk)}` : 'Tes modifications sont toujours enregistrées d\'abord sur le téléphone.'}
          right={<Button small label="Synchroniser" onPress={() => pull()} />} last />
      </ListGroup> : null}

      {signed ? <ListGroup title="Appareils connectés">
        {devices.map((d, i) => <ListRow key={d.id} chevron={false} last={i === devices.length - 1} title={d.device} sub={`${d.current ? 'Cet appareil, ' : ''}vu le ${when(d.last_seen)}`}
          right={d.current ? <Chip label="Celui-ci" /> : <Button small kind="ghost" label="Déconnecter" onPress={() => Alert.alert('Déconnecter cet appareil ?', `${d.device} devra se reconnecter avec Google.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnecter', style: 'destructive', onPress: async () => { await revokeSession(d.id); refresh(); } }])} />} />)}
        {!devices.length ? <ListRow last chevron={false} title="Chargement…" /> : null}
      </ListGroup> : null}

      {signed && backups.length ? <ListGroup title="Sauvegardes du serveur">
        {backups.slice(0, 6).map((b, i, a) => <ListRow key={b.id} last={i === a.length - 1} title={when(b.created_at)} sub={b.reason.replace(/^./, x => x.toUpperCase())}
          onPress={() => Alert.alert('Restaurer cette sauvegarde ?', 'Tes données actuelles sont sauvegardées d\'abord : tu pourras revenir en arrière.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Restaurer', onPress: async () => setMsg((await restoreBackup(b.id)) ? 'Sauvegarde restaurée.' : 'Restauration impossible.') }])} />)}
      </ListGroup> : null}

      {local ? <ListGroup title="Copie de ce téléphone">
        <ListRow last title={`Avant la connexion, ${when(local.at)}`} sub={sum(local.counts)}
          onPress={() => Alert.alert('Revenir à cette copie ?', 'Les données de ce téléphone seront remplacées par la copie faite avant la connexion, puis synchronisées.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Restaurer', style: 'destructive', onPress: async () => { await restoreLocalBackup(); setMsg('Copie restaurée.'); } }])} />
      </ListGroup> : null}

      {signed ? <ListGroup title="Sécurité">
        <ListRow chevron={false} title="Se déconnecter de ce téléphone" sub="Tes données restent ici et sur ton compte" onPress={() => Alert.alert('Se déconnecter ?', 'La synchronisation s\'arrête sur ce téléphone jusqu\'à la prochaine connexion.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Se déconnecter', onPress: () => logout() }])} />
        <ListRow chevron={false} title="Déconnecter tous les appareils" sub="Utile en cas de téléphone perdu" onPress={() => Alert.alert('Déconnecter tous les appareils ?', 'Chacun devra se reconnecter avec Google, celui-ci compris.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Tout déconnecter', style: 'destructive', onPress: () => logoutAll() }])} />
        <ListRow last chevron={false} title="Supprimer mon compte" sub="Efface tes données du serveur. Ce téléphone garde sa copie." onPress={() => Alert.alert('Supprimer ton compte ?', 'Tes données, sauvegardes et sessions seront effacées du serveur. Exporte une copie avant si tu veux la garder. Irréversible.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => setMsg((await deleteAccount()) ? 'Compte supprimé du serveur.' : 'Suppression impossible.') }])} />
      </ListGroup> : null}

      <Button small kind="ghost" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: space.s3 }} label={advanced ? 'Masquer les réglages avancés' : 'Réglages avancés'} onPress={() => setAdvanced(!advanced)} />
      {advanced ? <Card>
        <Field label="Adresse du serveur"><Input autoCapitalize="none" autoCorrect={false} keyboardType="url" defaultValue={sv.url} placeholder="https://byynd.emilyguindi.workers.dev" onChangeText={t => setServer({ url: t.trim() })} /></Field>
        {!signed ? <Field label="Clé d'accès historique"><Input secureTextEntry autoCapitalize="none" autoCorrect={false} defaultValue={sv.key} placeholder="ta phrase APP_KEY" onChangeText={t => setServer({ key: t.trim() })} /></Field> : null}
        <Button label="Tester le serveur" onPress={async () => setMsg(await testServer())} />
        <T v="xs" muted style={{ marginTop: 8 }} color={c.ink3}>La clé et la session sont gardées dans le stockage sécurisé d'Android, jamais dans les données synchronisées.</T>
      </Card> : null}
    </>
  );
}
