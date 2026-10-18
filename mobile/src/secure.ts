import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Identifiants sensibles (jeton de session, clé historique) : Keystore Android via expo-secure-store.
 *  Sur le web (aperçus de développement uniquement), repli sur le stockage local. Jamais dans l'état synchronisé. */
type SS = { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void>; deleteItemAsync(k: string): Promise<void> };
let mod: SS | null = null;
function native(): SS | null {
  if (Platform.OS === 'web') return null;
  if (mod) return mod;
  try { mod = require('expo-secure-store') as SS; return mod; } catch { return null; } // APK antérieur sans le module : repli
}
export const secureGet = async (k: string) => { const m = native(); try { return m ? await m.getItemAsync(k) : await AsyncStorage.getItem(`secure:${k}`); } catch { return null; } };
export const secureSet = async (k: string, v: string) => { const m = native(); try { if (m) await m.setItemAsync(k, v); else await AsyncStorage.setItem(`secure:${k}`, v); } catch {} };
export const secureDel = async (k: string) => { const m = native(); try { if (m) await m.deleteItemAsync(k); else await AsyncStorage.removeItem(`secure:${k}`); } catch {} };
