import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { BLOCKERS } from '@/ai/chatgpt';
import { deleteThread, forgetAll, memory, setPerm } from '@/ai/studio';
import { localProvider } from '@/ai/local';
import { Sheet } from '@/components/sheet';
import { Button, Chip, ListGroup, ListRow, T, Toggle } from '@/components/ui';
import { sportDay } from '@/engine/dates';
import { minimalContext, permsOf, SCOPE_LABEL } from '@/engine/tools';
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
  const ctx = minimalContext(s, sportDay());
  return (
    <Sheet title="Coach : mémoire et données" sub="Tu gardes la main">
      <ListGroup title="Assistant">
        <ListRow chevron={false} title={localProvider.name} sub={localProvider.status().detail} right={<Chip tone="accent" label="Actif" />} />
        <ListRow last chevron={false} title="ChatGPT (ton abonnement)" sub="Pas encore disponible : voir ci-dessous. Aucune connexion non officielle n'est utilisée." right={<Chip label="Indisponible" />} />
      </ListGroup>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
        <T v="label" style={{ marginBottom: 6 }}>Ce qui manque pour connecter ChatGPT</T>
        {BLOCKERS.map(b => <T key={b} v="small" style={{ marginBottom: 4 }}>{`• ${b}`}</T>)}
        <T v="xs" muted style={{ marginTop: 4 }}>Détails dans docs/coach-ia.md du dépôt. Le coach actuel fonctionne sans ChatGPT.</T>
      </View>

      <ListGroup title="Données que le coach peut lire">
        {(Object.keys(SCOPE_LABEL) as DataScope[]).map((k, i, a) => <ListRow key={k} last={i === a.length - 1} chevron={false} title={SCOPE_LABEL[k]} sub={SCOPE_HINT[k]}
          right={k === 'sensitive' ? <Chip label="Jamais" /> : <Toggle label={SCOPE_LABEL[k]} value={perms[k]} onChange={v => update(st => setPerm(st, k, v))} />} />)}
      </ListGroup>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.r2, padding: space.s4, marginBottom: space.s4 }}>
        <T v="label" style={{ marginBottom: 4 }}>Ce qu'un assistant externe recevrait</T>
        <T v="small" muted>{`Avec ces réglages : ${Object.keys(ctx).filter(k => k !== 'today').map(k => ({ program: 'programme en cours', events: 'compétitions', recentTraining: '14 derniers jours d\'entraînement', recovery: 'récupération du jour', weight: '4 dernières pesées' } as Record<string, string>)[k]).join(', ') || 'rien'}. Jamais de jeton, de clé, d'adresse e-mail ni de note libre.`}</T>
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
