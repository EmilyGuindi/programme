import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/* Dictée : la reconnaissance vocale d'Android (gratuite) transforme la voix en texte dans le champ de saisie.
   Rien n'est envoyé au coach tant que tu n'appuies pas sur Envoyer. Module natif (APK 5.4) chargé à la demande :
   sur une version qui ne l'a pas, le bouton micro est simplement masqué. */
type Mod = { start(o: object): void; stop(): void; abort(): void; requestPermissionsAsync(): Promise<{ granted: boolean }>; isRecognitionAvailable(): boolean; addListener(e: string, f: (x: any) => void): { remove(): void } };
let mod: Mod | null | undefined;
function speech(): Mod | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web') return (mod = null);
  try { mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule as Mod; if (!mod?.start) mod = null; } catch { mod = null; }
  return mod;
}
export const dictationSupported = () => { const m = speech(); try { return !!m && m.isRecognitionAvailable(); } catch { return false; } };

const ERR: Record<string, string> = {
  'not-allowed': 'Micro refusé : autorise-le dans les réglages Android de BYYND.',
  'no-speech': 'Je n\'ai rien entendu.', 'speech-timeout': 'Je n\'ai rien entendu.', 'nomatch': 'Je n\'ai pas compris, réessaie.',
  'network': 'Pas de réseau pour la dictée.', 'audio-capture': 'Micro indisponible.', 'busy': 'Micro déjà utilisé par une autre app.',
  'service-not-allowed': 'Reconnaissance vocale indisponible : installe ou active l\'appli Google.', 'language-not-supported': 'Français non disponible pour la dictée sur ce téléphone.',
};

/** Dictée dans un champ : `base` = texte déjà tapé, le texte dicté s'ajoute à la suite et s'affiche pendant que tu parles. */
export function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false); const [error, setError] = useState('');
  const base = useRef(''); const finals = useRef('');
  useEffect(() => {
    const m = speech(); if (!m) return;
    const subs = [
      m.addListener('result', (e: { isFinal: boolean; results: { transcript: string }[] }) => {
        const t = (e.results?.[0]?.transcript || '').trim(); if (!t) return;
        const join = (...xs: string[]) => xs.filter(Boolean).join(' ');
        if (e.isFinal) { finals.current = join(finals.current, t); onText(join(base.current, finals.current)); }
        else onText(join(base.current, finals.current, t));
      }),
      m.addListener('end', () => setListening(false)),
      m.addListener('error', (e: { error: string }) => { setListening(false); if (e?.error !== 'aborted') setError(ERR[e?.error] || 'Dictée interrompue.'); }),
    ];
    return () => { subs.forEach(x => x.remove()); try { m.abort(); } catch {} };
  }, []);
  async function start(current: string) {
    const m = speech(); if (!m) return; setError('');
    const p = await m.requestPermissionsAsync().catch(() => ({ granted: false })); if (!p.granted) { setError(ERR['not-allowed']); return; }
    base.current = current.trim(); finals.current = '';
    try { m.start({ lang: 'fr-FR', interimResults: true, continuous: true, addsPunctuation: true }); setListening(true); } catch { setError('Dictée indisponible.'); }
  }
  function stop() { try { speech()?.stop(); } catch {} setListening(false); }
  return { supported: dictationSupported(), listening, error, start, stop };
}
