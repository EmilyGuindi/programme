import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Sheet } from '@/components/sheet';
import { Button, T } from '@/components/ui';
import { stravaStatus, stravaSyncNow } from '@/store/store';

/** Point d'arrivée du lien byynd://strava après l'autorisation. */
export default function StravaReturn() {
  const { ok, err } = useLocalSearchParams<{ ok?: string; err?: string }>();
  useEffect(() => { if (ok === '1') { stravaStatus(); setTimeout(() => stravaSyncNow(90), 3000); } }, [ok]);
  return (
    <Sheet title={ok === '1' ? 'Strava connecté' : 'Connexion Strava'}>
      <T>{ok === '1' ? 'Tes activités des 90 derniers jours arrivent. Les nouvelles séances seront cochées automatiquement.' : `La connexion n'a pas abouti${err ? ` (${err})` : ''}. Tu peux réessayer depuis Profil.`}</T>
      <Button kind="primary" block label="Continuer" style={{ marginTop: 16 }} onPress={() => router.replace('/profile')} />
    </Sheet>
  );
}
