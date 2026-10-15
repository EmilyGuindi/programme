import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { View } from 'react-native';
import { radius, space, useTheme } from '@/theme/tokens';
import { Button, T } from './ui';

/** Affiché quand une mise à jour a été téléchargée en arrière-plan. */
export function UpdateBanner() {
  const { c } = useTheme();
  if (!Updates.isEnabled) return null;
  const { isUpdatePending, isRestarting } = Updates.useUpdates();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { checkForUpdate(); }, []);
  if (!isUpdatePending) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: c.accentSoft, borderRadius: radius.r2, padding: space.s3, marginBottom: space.s3 }}>
      <T v="small" style={{ flex: 1 }}>Nouvelle version de BYYND prête.</T>
      <Button small kind="primary" label={isRestarting ? '…' : 'Mettre à jour'} onPress={() => Updates.reloadAsync()} />
    </View>
  );
}

/** Vérifie et télécharge une mise à jour au retour au premier plan (en plus du contrôle au lancement). */
export async function checkForUpdate() {
  if (!Updates.isEnabled) return;
  try { const r = await Updates.checkForUpdateAsync(); if (r.isAvailable) await Updates.fetchUpdateAsync(); } catch {}
}

/** Vérification manuelle, avec un résultat lisible. */
export async function manualUpdateCheck(): Promise<string> {
  if (!Updates.isEnabled) return 'Les mises à jour à distance ne sont pas actives dans cette version.';
  try {
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) return 'Tu as déjà la dernière version.';
    await Updates.fetchUpdateAsync();
    return 'ready';
  } catch (e: any) { return `Impossible de vérifier : ${e?.message || 'erreur inconnue'}`; }
}
