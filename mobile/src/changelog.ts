/** Historique « Quoi de neuf ». La première entrée est la version en cours. */
export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  { version: '2.8.0', date: '16 oct. 2026', items: ['Mon parcours : étapes running et physique, avec critère, progression et prochaine action.', 'Records et paliers : tes meilleures marques et des paliers qui récompensent la régularité sur la semaine.', 'Insights avec niveau de confiance (observation, tendance, progression confirmée) et leur source.'] },
  { version: '2.7.0', date: '16 oct. 2026', items: ['Mode course : compte à rebours, préparation, stratégie, checklist et débrief pour chaque compétition.', 'Écran de fin de séance : ce que tu as fait, ce que ça t\'apporte, la suite.', 'Bilan de la semaine chaque dimanche soir, avec archives dans Progression.', 'Records personnels détectés automatiquement, sans GPS aberrant.'] },
  { version: '2.6.0', date: '16 oct. 2026', items: ['Rappels à l\'heure exacte, même téléphone en veille prolongée.', 'Un check-in fait après minuit compte pour la veille : le rappel du matin reste programmé.'] },
  { version: '2.5.0', date: '16 oct. 2026', items: ['Bouton « Rechercher une mise à jour » dans Quoi de neuf.', 'Notifications : check-in chaque matin et pesée hebdo, même app fermée, sans doublon.', 'Notification de test dans Profil → Rappels.', 'Profil en cartes illustrées, comme Progression.'] },
  { version: '2.4.0', date: '16 oct. 2026', items: ['Icône de l\'app en version noire.', 'Wordmark BYYND redessiné fidèlement à la planche de marque (ligature N–D).', 'Salutation selon l\'heure : bonjour, bon après-midi, bonsoir, bonne nuit.'] },
  { version: '2.3.1', date: '16 oct. 2026', items: ['Progression : plus de chiffres affichés d\'emblée, quatre cartes illustrées à ouvrir quand tu veux.'] },
  { version: '2.3.0', date: '15 oct. 2026', items: ['Chaque jour du programme s\'ouvre : ce qui est prévu, pourquoi, comment le faire.', 'Running : échauffement détaillé, explication de chaque terme, comment ressentir chaque allure, retour au calme.', 'Renforcement : mode d\'emploi complet de chaque exercice (installation, exécution, respiration, erreurs, variantes, vidéo).', 'Récupération active guidée : marche et mobilité, exercice par exercice.'] },
  { version: '2.2.3', date: '15 oct. 2026', items: ['Correctif : l\'adresse et la clé du serveur sont enregistrées dès la saisie.'] },
  { version: '2.2.2', date: '15 oct. 2026', items: ['Bouton « Connecter Strava » toujours actif, avec un message clair si quelque chose manque.'] },
  { version: '2.2.1', date: '15 oct. 2026', items: ['Correctif : une séance cochée ne disparaît plus après une synchronisation.', 'Synchro par fusion : rien n\'est écrasé entre ton téléphone et le serveur.'] },
  { version: '2.2.0', date: '15 oct. 2026', items: ['Connexion Strava : import automatique de tes activités.', 'Séances cochées toutes seules quand la correspondance est sûre, question rapide sinon.', 'Effort demandé pour les cours sans fréquence cardiaque.', 'Promenades avec Sirius rangées en activités complémentaires.'] },
  { version: '2.1.0', date: '15 oct. 2026', items: ['Mises à jour automatiques : plus besoin de réinstaller l\'app pour les nouveautés.', 'Bandeau « Nouvelle version prête » sur Aujourd\'hui.', 'Historique des nouveautés dans Profil.'] },
  { version: '2.0.2', date: '15 oct. 2026', items: ['Wordmark BYYND vectorisé et tagline « Go beyond. ».'] },
  { version: '2.0.1', date: '15 oct. 2026', items: ['Identité BYYND : icône, écran de démarrage, couleurs cobalt / charcoal / mist.'] },
  { version: '2.0.0', date: '15 oct. 2026', items: ['Première version native Android.'] },
];
export const APP_VERSION = CHANGELOG[0].version;
