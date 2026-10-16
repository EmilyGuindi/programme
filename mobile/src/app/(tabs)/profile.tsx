import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { APP_VERSION } from '@/changelog';
import { Icon } from '@/components/icons';
import { Wordmark } from '@/components/logo';
import { ListGroup, ListRow, Screen, T } from '@/components/ui';
import { phaseOf, weekOf } from '@/engine/coach';
import { DAYS_SHORT, sportDay } from '@/engine/dates';
import { stravaStatus, useApp, useServer, useStrava, useSync } from '@/store/store';
import { space } from '@/theme/tokens';

const open = (section: string) => router.push({ pathname: '/settings/[section]', params: { section } });
const h = (t: string) => { const [a, b] = t.split(':'); return `${+a} h${b !== '00' ? ` ${b}` : ''}`; };

export default function Profile() {
  const s = useApp(); const sv = useServer(); const sync = useSync(); const st = useStrava();
  useEffect(() => { stravaStatus(); }, [sv.url, sv.key]);
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, sportDay()))); const ph = phaseOf(w); const pr = s.user.prefs;
  const rem = [pr.notifCheckin ? `check-in ${h(pr.checkinTime)}` : '', pr.notifWeigh ? `pesée ${DAYS_SHORT[pr.weighDay].toLowerCase()}. ${h(pr.weighTime)}` : '', pr.notifRecap !== false ? 'bilan dim.' : ''].filter(Boolean);
  const conn = !sv.url ? 'Données sur ce téléphone uniquement' : [sync.status === 'ok' ? 'Serveur synchronisé' : sync.status === 'err' ? 'Serveur : erreur' : 'Serveur configuré', st?.connected ? 'Strava connecté' : 'Strava non connecté'].join(' · ');
  return (
    <Screen>
      <View style={{ paddingTop: space.s4, marginBottom: space.s5 }}>
        <T v="title">{s.user.name}</T>
        <T muted>{`${s.program.name} · semaine ${w} · phase ${ph.n}`}</T>
      </View>
      <ListGroup title="Mon entraînement">
        <ListRow title="Objectifs" sub={`10 km à 5'30/km · ${String(s.user.goals.weightTarget).replace('.', ',')} kg souhaités`} left={<Icon name="target" />} onPress={() => open('goals')} />
        <ListRow title="Programme" sub={`Phase ${ph.n} · ${ph.name}`} left={<Icon name="cycle" />} onPress={() => open('program')} />
        <ListRow last title="Rappels" sub={rem.length ? rem.join(' · ') : 'Désactivés'} left={<Icon name="bell" />} onPress={() => open('reminders')} />
      </ListGroup>
      <ListGroup title="Connexions">
        <ListRow last title="Serveur et Strava" sub={conn} left={<Icon name="link" />} onPress={() => open('connections')} />
      </ListGroup>
      <ListGroup title="Application">
        <ListRow title="Mes données" sub="Sauvegarde, import, préférences" left={<Icon name="data" />} onPress={() => open('data')} />
        <ListRow last title="Quoi de neuf" sub={`Version ${APP_VERSION}`} left={<Icon name="spark" />} onPress={() => open('news')} />
      </ListGroup>
      <View style={{ alignItems: 'center', marginTop: space.s4, gap: 6 }}><Wordmark height={12} tagline /></View>
    </Screen>
  );
}
