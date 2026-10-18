# Coach IA de BYYND

## Claude (actif dès que la clé est configurée)

- **Modèle** : Claude Haiku (`claude-haiku-5-5`), appelé par le Worker (`worker/coach.js`) avec le SDK officiel `@anthropic-ai/sdk`. Effort « low » pour des réponses rapides.
- **Clé** : secret GitHub `ANTHROPIC_API_KEY`, poussé vers le Worker au déploiement. Elle n'est jamais sur le téléphone ni dans le dépôt.
- **Accès** : réservé à une personne authentifiée (session Google ou clé historique). Quota de 60 messages par jour et par personne, réglable avec le secret `COACH_DAILY_LIMIT`.
- **Données envoyées** : `coachContext()` (`mobile/src/engine/tools.ts`), filtré par les permissions du coach.
  - Contenu : programme, séances de J-7 à J+14, compétitions, activités chiffrées des 4 dernières semaines, records, allures, récupération, check-ins.
  - Exclus : titres d'activités, notes libres, e-mail, jetons.
  - Taille : environ 1 500 jetons.
- **Actions** :
  - Claude ne dispose que de trois outils de **proposition** : `apply_workout_reschedule`, `adapt_today`, `create_program_draft`.
  - Le téléphone revalide chaque proposition avec les règles BYYND (`checkCall` / `prepare`) et l'affiche en carte.
  - Rien n'est appliqué sans « Accepter » ; à l'exécution, les contrôles sont refaits.
- **Secours** : si Claude est hors ligne, sans crédit, au-delà du quota ou non configuré, le coach à règles répond et le dit.
- **Coût** : environ 0,07 centime par message, sur un crédit prépayé sans rechargement automatique.

## Mise en place
1. Sur console.anthropic.com, créer un compte, acheter quelques dollars de crédit et **désactiver le rechargement automatique**.
2. Créer une clé API, puis l'ajouter dans GitHub → Settings → Secrets and variables → Actions → `ANTHROPIC_API_KEY`.
3. Relancer le déploiement (workflow « Déployer BYYND sur Cloudflare » → Run workflow), ou attendre le prochain merge.

## ChatGPT : faisabilité (historique)

_Vérifié le 18 octobre 2026._

## En bref

- BYYND n'est **pas** connecté à ChatGPT aujourd'hui. Aucun faux chatbot : le coach actuel est un **coach à règles local**, présenté comme tel dans l'app (« Coach BYYND, règles appliquées sur ton téléphone, aucune donnée envoyée à un service d'IA »).
- Le seul moyen officiel d'utiliser un abonnement ChatGPT existant depuis une application tierce est **Sign in with ChatGPT** (https://developers.openai.com/siwc/quickstart). Il n'est pas activable en l'état, pour les raisons ci-dessous.
- Aucun contournement n'est utilisé : pas de cookie de session récupéré, pas d'API payante, pas de mécanisme non documenté.

## Ce que dit la documentation (et ce qui n'a pas pu être vérifié)

L'environnement de développement n'avait pas d'accès réseau à `developers.openai.com` ni à `auth.openai.com`. Les points ci-dessous viennent de recherches sur ces pages. Ils sont à relire sur la documentation officielle avant toute implémentation.

| Point | Ce qui a été trouvé | Conséquence pour BYYND |
|---|---|---|
| Qui peut l'utiliser | En libre-service, sans validation, pour les **outils open source et projets personnels qui tournent en local**. Les apps payantes ou hébergées demandent un accès. | Le dépôt n'a **pas de licence**. Choisir une licence open source est une décision de la propriétaire du dépôt. |
| Flux | OAuth « authorization code » + PKCE (S256), `client_id=dynamic_agent_client` à la première inscription, puis l'identifiant attribué est conservé. | Faisable dans l'app. |
| Retour de connexion | `http://127.0.0.1:1455/auth/callback`, avec un serveur local qui écoute **avant** l'ouverture du navigateur. | Android n'a pas de serveur HTTP local en JavaScript : il faut un **module natif** (nouvel APK). |
| Scopes | `openid profile email offline_access` + `resource.invoke chatgpt.tokens.use.direct`. | Jetons à garder dans le Keystore (expo-secure-store), jamais synchronisés. |
| Appels au modèle | API Responses, depuis l'appareil de l'utilisatrice. | Le Worker ne doit pas recevoir ces jetons. |
| Durée des jetons | 1 h pour l'accès, 30 jours pour le renouvellement (avec rotation). **Non vérifié.** | |
| Abonnement | Plus ou Pro, plafond d'usage hebdomadaire par application. L'application n'a pas accès aux conversations ni à la mémoire de ChatGPT. | La mémoire du coach reste celle de BYYND. |
| `ext_agent_host_id`, modèles disponibles | Sémantique et liste **non vérifiées**. | À confirmer avant de coder. |

Rien n'indique qu'un compte ChatGPT permette de brancher un **serveur MCP personnalisé** : BYYND ne le suppose pas (voir `docs/mcp.md`).

## Ce qui débloquerait l'intégration

1. Ajouter une licence open source au dépôt (décision de la propriétaire).
2. Relire le quickstart officiel : paramètres d'inscription, modèles, durée des jetons.
3. Écrire un petit module natif Android qui écoute sur `127.0.0.1:1455` le temps de la connexion (nouvel APK).
4. Implémenter `src/ai/chatgpt.ts` derrière l'interface `CoachProvider` (`src/ai/provider.ts`) :
   - le modèle reçoit `minimalContext()` (catégories autorisées seulement) et les schémas de `toolSchemas()` ;
   - ses réponses ne sont que des **propositions d'appels** ;
   - elles repassent par `checkCall()`, `prepare()` et la confirmation, comme pour le coach local.
5. Coût : nul pour BYYND. L'usage compte dans le quota de l'abonnement ChatGPT.

## Sécurité du coach (déjà en place)

Le parcours d'une demande est toujours le même :

1. **Comprendre** : le fournisseur (local aujourd'hui) interprète uniquement le message tapé.
2. **Choisir une fonction autorisée** : liste fermée dans `src/engine/tools.ts`.
3. **Vérifier les permissions** par catégorie : programmes, historique, Strava, récupération, mensurations, sensible. Elles sont révocables dans Coach → Historique et données.
4. **Valider les paramètres** : types, bornes, dates ; les clés inconnues sont refusées.
5. **Préparer et montrer les conséquences** sur une carte native : jamais de HTML ni de code rendu.
6. **Confirmer** : Accepter, Modifier ou Refuser. Aucune écriture sans confirmation.
7. **Exécuter** : les contrôles sont refaits au moment de l'exécution, sur l'état du moment. Ensuite, la synchronisation authentifiée envoie le résultat au serveur, qui vérifie la session.
8. **Mémoriser** : la décision est notée, et l'utilisatrice peut la supprimer durablement, sur tous les appareils.

Les titres d'activités Strava, les imports et les anciennes conversations ne sont jamais interprétés comme des consignes. Un test le vérifie (`src/engine/__tests__/coach.test.ts`). Le modèle ne reçoit jamais de jeton, de clé, d'adresse e-mail ni de note libre.
