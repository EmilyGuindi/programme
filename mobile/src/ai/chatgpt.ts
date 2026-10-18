import type { CoachProvider } from './provider';

/** Connexion « Sign in with ChatGPT » : non activée. Raisons vérifiées (octobre 2026), détaillées dans docs/coach-ia.md.
 *  Aucun cookie, aucune API payante, aucun mécanisme non documenté : tant que ces points ne sont pas levés, ce fournisseur ne répond pas. */
export const BLOCKERS = [
  'L\'accès libre est réservé aux outils open source qui tournent en local ; le dépôt BYYND n\'a pas encore de licence open source.',
  'Le retour de connexion se fait sur http://127.0.0.1:1455 : il faut un petit serveur local natif dans l\'APK Android (nouvel APK).',
  'Paramètres d\'enregistrement (ext_agent_host_id) et liste des modèles à confirmer dans la documentation officielle.',
  'Nécessite un abonnement ChatGPT Plus ou Pro, avec un plafond d\'usage hebdomadaire par application.',
];
export const chatgptProvider: CoachProvider = {
  id: 'chatgpt', name: 'ChatGPT',
  status: () => ({ available: false, label: 'Non disponible', detail: 'La connexion officielle à ton abonnement ChatGPT n\'est pas encore possible dans BYYND.', blockers: BLOCKERS }),
  respond: async () => ({ text: 'ChatGPT n\'est pas connecté. Le coach BYYND local répond à sa place.', cards: [] }),
};
