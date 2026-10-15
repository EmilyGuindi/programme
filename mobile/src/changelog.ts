/** Historique « Quoi de neuf ». La première entrée est la version en cours. */
export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  { version: '2.2.0', date: '15 oct. 2026', items: ['Connexion Strava : import automatique de tes activités.', 'Séances cochées toutes seules quand la correspondance est sûre, question rapide sinon.', 'Effort demandé pour les cours sans fréquence cardiaque.', 'Promenades avec Sirius rangées en activités complémentaires.'] },
  { version: '2.1.0', date: '15 oct. 2026', items: ['Mises à jour automatiques : plus besoin de réinstaller l\'app pour les nouveautés.', 'Bandeau « Nouvelle version prête » sur Aujourd\'hui.', 'Historique des nouveautés dans Profil.'] },
  { version: '2.0.2', date: '15 oct. 2026', items: ['Wordmark BYYND vectorisé et tagline « Go beyond. ».'] },
  { version: '2.0.1', date: '15 oct. 2026', items: ['Identité BYYND : icône, écran de démarrage, couleurs cobalt / charcoal / mist.'] },
  { version: '2.0.0', date: '15 oct. 2026', items: ['Première version native Android.'] },
];
export const APP_VERSION = CHANGELOG[0].version;
