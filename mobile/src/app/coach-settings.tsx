import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { deleteThread, ensureMemory, forgetAll, memory, setPerm } from '@/ai/studio';
import { localProvider } from '@/ai/local';
import { setupRemoteCoach } from '@/ai/remote';
import { providerFor } from '@/ai/studio';
import { useEffect, useState } from 'react';
import { Segmented } from '@/components/ui';
import { Sheet } from '@/components/sheet';
import { Button, Chip, ListGroup, ListRow, T, Toggle } from '@/components/ui';
import { sportDay } from '@/engine/dates';
import { coachContext, permsOf, SCOPE_LABEL } from '@/engine/tools';
import type { DataScope } from '@/engine/types';
import { update, useApp } from '@/store/store';
import { radius, space, useTheme } from '@/theme/tokens';

const SCOPE_HINT: Record<DataScope, string> = {
  programs: 'Programme, semaine type, compétitions. Nécessaire pour déplacer une séance ou préparer un programme.',
  history: 'Séances faites : date, type, distance, durée, allure, FC, effort. Jamais tes notes libres.',
  strava: 'Activités importées de Strava. Désactivé : seules tes saisies manuelles sont lues.',
  recovery: 'Sommeil, énergie, courbatures du check-in, pour adapter une séance.',
  body: 'Poids et mensurations. Désactivé par défaut.',
  sensitive: 'Cycle menstruel, douleurs détaillées, notes. Jamais utilisé par le coach actuel.',
};
const when = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Historique, mémoire et permissions du coach. Tout est visible, révocable, supprimable. */
export default function CoachSettings() {
  const s = useApp(); const { c } = useTheme(); const m = memory(s); const perms = permsOf(s);
  const ctx = coachContext(s, sportDay()); const [, tick] = useState(0); useEffect(() => { setupRemoteCoach().then(() => tick(x => x + 1)); }, []);
  const cur = providerFor(s); const pref = s.coach?.provider === 'local' ? 'local' : 'claude';
  return (
    <Sheet title="Coach : mémoire et données" sub="Tu gardes la main">
      <View style={{ marginBottom: space.s3 }}><Segmented options={[['claude', 'Claude'], ['local', 'Règles locales']]} value={pref} onChange={v => update(st => { ensureMemory(st).provider = v as 'claude' | 'local'; })} /></View>
      <ListGroup title="Assistant">
        <ListRow chevron={false} title="Claude (Haiku)" sub={cur.id === 'claude' ? 'Conversation libre avec tes données BYYND, via ton serveur. Propose des changements, tu valides.' : pref === 'claude' ? 'Pas disponible pour l\'instant : le coach à règles répond.' : 'Désactivé : le coach à règles répond.'}
          right={<Chip tone={cur.id === 'claude' ? 'accent' : 'neutral'} label={cur.id === 'claude' ? 'Actif' : pref === 'claude' ? 'Indisponible' : 'Désactivé'} />} />
        <ListRow last chevron={false} title={localProvider.name} sub="Règles BYYND sur ton téléphone, sans envoi de données. Secours hors ligne." right={<Chip tone={cur.id === 'local' ? 'accent' : 'neutral'} label={cur.id === 'local' ? 'Actif' : 'Secours'} />} />
      </ListGroup>

      <ListGroup title="Données que le coach peut lire">
        {(Object.keys(SCOPE_LABEL) as DataScope[]).map((k, i, a) => <ListRow key={k} last={i === a.length - 1} chevron={false} title={SCOPE_LABEL[k]} sub={SCOPE_HINT[k]}
          right={k === 'sensitive' ? <Chip label="Jamais" /> : <Toggle label={SCOPE_LABEL[k]} value={perms[k]} onChange={v => update(st => setPerm(st, k, v))} />} />)}
      </ListGroup>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
        <T v="label" style={{ marginBottom: 4 }}>Ce que Claude reçoit à chaque message</T>
        <T v="small" muted>{`Avec ces réglages : ${Object.keys(ctx).filter(k => k !== 'aujourdhui').map(k => ({ programme: 'programme et phase', objectifs: 'objectifs', planning: 'séances des 7 derniers et 14 prochains jours', competitions: 'compétitions', autresProgrammes: 'autres programmes', activitesRecentes: 'activités des 4 dernières semaines (chiffres seulement)', records: 'records', allures: 'allures', recuperation: 'récupération', checkins: 'check-ins de la semaine', poids: 'dernières pesées' } as Record<string, string>)[k] || k).join(', ') || 'rien'}. Jamais de jeton, de clé, d'adresse e-mail, de note libre ni de titre d'activité. Par défaut, Anthropic n'utilise pas les données envoyées par l'API pour entraîner ses modèles.`}</T>
      </View>

      <ListGroup title="Conversations">
        {m.threads.length ? m.threads.map((t, i) => <ListRow key={t.id} last={i === m.threads.length - 1} title={t.title} sub={`${t.messages.length} messages, ${when(t.at)}`}
          onPress={() => Alert.alert(t.title, undefined, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => update(st => deleteThread(st, t.id)) }, { text: 'Ouvrir', onPress: () => router.replace({ pathname: '/coach', params: { thread: t.id } }) }])} />)
          : <ListRow last chevron={false} title="Aucune conversation" />}
      </ListGroup>
      <ListGroup title="Décisions mémorisées">
        {m.decisions.length ? m.decisions.slice(0, 12).map((d, i, a) => <ListRow key={d.id} last={i === a.length - 1} chevron={false} title={d.text} sub={`${d.outcome === 'accepted' ? 'Acceptée' : 'Refusée'}, ${when(d.at)}`} />)
          : <ListRow last chevron={false} title="Aucune décision" sub="Chaque proposition acceptée ou refusée est notée ici." />}
      </ListGroup>
      <Button kind="danger" block label="Tout oublier" onPress={() => Alert.alert('Effacer la mémoire du coach ?', 'Conversations et décisions seront supprimées sur tous tes appareils. Ton programme et tes séances ne changent pas.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Effacer', style: 'destructive', onPress: () => update(st => forgetAll(st)) }])} />
    </Sheet>
  );
}
