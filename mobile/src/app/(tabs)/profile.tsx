import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { APP_VERSION } from '@/changelog';
import { Icon } from '@/components/icons';
import { Wordmark } from '@/components/logo';
import { ListGroup, ListRow, Meter, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { phaseOf, programName, weekOf } from '@/engine/coach';
import { DAYS_SHORT, sportDay } from '@/engine/dates';
import { stravaStatus, useApp, useServer, useStrava, useSync } from '@/store/store';
import { space } from '@/theme/tokens';

const open = (section: string) => router.push({ pathname: '/settings/[section]', params: { section } });
const h = (t: string) => { const [a, b] = t.split(':'); return `${+a} h${b !== '00' ? ` ${b}` : ''}`; };

export default function Profile() {
  const s = useApp(); const sv = useServer(); const sync = useSync(); const st = useStrava(); const { c } = useTheme();
  useEffect(() => { stravaStatus(); }, [sv.url, sv.key, sv.session]);
  const w = Math.min(s.program.weeks, Math.max(1, weekOf(s, sportDay()))); const ph = phaseOf(w); const pr = s.user.prefs;
  const rem = [pr.notifCheckin ? `check-in ${h(pr.checkinTime)}` : '', pr.notifWeigh ? `pesée ${DAYS_SHORT[pr.weighDay].toLowerCase()}. ${h(pr.weighTime)}` : '', pr.notifRecap !== false ? 'bilan dim.' : ''].filter(Boolean);
  const conn = !(sv.session || sv.key) ? 'Non connecté : données sur ce téléphone uniquement' : `${sv.account?.email || 'Clé historique'}, ${sync.status === 'ok' ? 'synchronisé' : sync.status === 'err' ? 'erreur de synchronisation' : sync.status === 'pending' || sync.status === 'off' ? 'envoi en attente' : 'connecté'}, ${st?.connected ? 'Strava connecté' : 'Strava non connecté'}`;
  return (
    <Screen>
      <Row gap={space.s4} style={{ paddingTop: space.s5, marginBottom: space.s5 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.stage, alignItems: 'center', justifyContent: 'center' }}><T v="display" color={c.stageInk} style={{ fontSize: 30, lineHeight: 32 }}>{s.user.name.charAt(0)}</T></View>
        <View style={{ flex: 1 }}>
          <T v="title">{s.user.name}</T>
          <T v="small" muted>{`Semaine ${w} sur ${s.program.weeks}, ${ph.name.toLowerCase()}`}</T>
          <View style={{ marginTop: 8 }}><Meter value={w / s.program.weeks} color={c.accent} /></View>
        </View>
      </Row>
      <ListGroup title="Mon entraînement">
        <ListRow title="Objectifs" sub={`10 km à 5'30/km, ${String(s.user.goals.weightTarget).replace('.', ',')} kg souhaités`} left={<Icon name="target" />} onPress={() => open('goals')} />
        <ListRow title="Programme" sub={programName(s)} left={<Icon name="cycle" />} onPress={() => open('program')} />
        <ListRow last title="Rappels" sub={rem.length ? rem.join(', ').replace(/^./, x => x.toUpperCase()) : 'Désactivés'} left={<Icon name="bell" />} onPress={() => open('reminders')} />
      </ListGroup>
      <ListGroup title="Connexions">
        <ListRow last title="Compte, synchronisation et Strava" sub={conn} left={<Icon name="link" />} onPress={() => open('connections')} />
      </ListGroup>
      <ListGroup title="Application">
        <ListRow title="Retours et animations" sub={[pr.haptics !== false ? 'haptique' : 'sans haptique', pr.motion === 'reduced' ? 'animations réduites' : 'animations', pr.celebrate !== false ? 'accomplissements mis en scène' : ''].filter(Boolean).join(', ').replace(/^./, x => x.toUpperCase())} left={<Icon name="spark" />} onPress={() => open('feedback')} />
        <ListRow title="Mes données" sub="Sauvegarde, import, préférences" left={<Icon name="data" />} onPress={() => open('data')} />
        <ListRow last title="Quoi de neuf" sub={`Version ${APP_VERSION}`} left={<Icon name="story" />} onPress={() => open('news')} />
      </ListGroup>
      <View style={{ alignItems: 'center', marginTop: space.s4, gap: 6 }}><Wordmark height={12} tagline /></View>
    </Screen>
  );
}
