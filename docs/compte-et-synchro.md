# Compte Google, sessions et synchronisation

## Mise en place (une fois, gratuit)

1. **Google Cloud Console** → nouveau projet → *API et services* → *Écran de consentement OAuth*.
   - Type externe, en mode test.
   - Ajoute ton adresse comme utilisatrice de test.
   - Scopes : uniquement `openid`, `email`, `profile`. Ni Gmail ni Drive.
2. *Identifiants* → **ID client OAuth de type « Application Web »**. Son identifiant (`xxxx.apps.googleusercontent.com`) est le `GOOGLE_WEB_CLIENT_ID` : c'est l'audience vérifiée par le serveur.
3. *Identifiants* → **ID client OAuth de type « Android »** :
   - package `com.emilyguindi.byynd` ;
   - empreinte SHA-1 du keystore EAS : `npx eas credentials` → Android → Keystore.
   - Rien à copier dans l'app : Google associe ce client au package.
4. **Secrets GitHub** du dépôt :
   - `GOOGLE_WEB_CLIENT_ID` : l'identifiant de l'étape 2 ;
   - `ALLOWED_EMAILS` (facultatif) : adresses autorisées, séparées par des virgules. Sans cette liste, seul le premier compte peut s'inscrire.
5. Fusionner sur `main` : le Worker est redéployé avec ces secrets et le schéma D1 est mis à jour.
6. Installer le **nouvel APK 5.0.0**, puis Profil → Compte, synchronisation et Strava → *Se connecter avec Google*.

Aucun secret n'est dans le dépôt. L'identifiant client Web est public par nature ; l'app le lit sur `/api/health`.

## Sécurité

- **Vérification serveur de l'ID token Google** : signature RS256 (clés publiques Google), émetteur, audience, expiration, adresse vérifiée.
- **Session BYYND** :
  - 256 bits aléatoires, remis une seule fois ;
  - le serveur n'en stocke que le SHA-256 ;
  - expiration glissante de 90 jours ;
  - révocation par appareil, ou de tous les appareils.
- **Cloisonnement** : chaque lecture et chaque écriture sont résolues sur l'utilisateur de la session. Aucun identifiant d'utilisateur n'est lu dans la requête. Tests dans `worker/test/auth.test.mjs`.
- **Strava** : réservé au compte propriétaire de l'instance.
- **Stockage sur le téléphone** :
  - jeton et ancienne clé dans le Keystore Android (expo-secure-store), jamais dans les données synchronisées ;
  - l'ancienne clé, autrefois en clair, y est déplacée au premier lancement.
- **Logs** : pas de jeton ni de contenu ; les erreurs ne renvoient que des codes.
- **Correctif** : `.git/` (dont `.git/config`) était publié comme fichier statique par le Worker. Il est désormais exclu (`.assetsignore`), et le checkout CI ne garde plus d'identifiants.
  - À faire de ton côté : le jeton exposé était un `GITHUB_TOKEN` éphémère de GitHub Actions, déjà expiré. Aucune action n'est requise. Vérifie seulement qu'aucun autre secret n'a jamais été commité.

## Migration des données existantes (non destructive)

1. Avant la connexion, le téléphone garde une copie complète de ses données (*Copie de ce téléphone*).
2. Lors de la première connexion avec la clé historique, le serveur :
   - sauvegarde l'état historique (« avant rattachement au compte ») ;
   - puis le rattache au compte, sans rien écraser.
3. L'app montre les deux versions (téléphone et compte) avec leurs volumes. Tu choisis : **fusionner** (recommandé, rien n'est perdu) ou **reprendre la version du compte**.
4. Les sauvegardes du serveur (quotidiennes, avant restauration, avant rattachement) sont restaurables depuis l'app.

## Synchronisation

- Toute modification est écrite d'abord sur le téléphone, puis envoyée.
- **Concurrence optimiste** : le serveur refuse (409) une écriture fondée sur une version qu'il n'a pas. L'app fusionne alors et renvoie. Une vieille version locale ne peut donc jamais écraser une version récente.
- **Fusion**, élément par élément :
  - coches, séries et déplacements : la plus récente gagne ;
  - activités : union, et les suppressions sont respectées ;
  - programmes : union, et le programme en cours ne recule jamais ;
  - conversations du coach : les suppressions sont durables.
- **Hors ligne** : statut « envoi en attente », puis nouvel essai à 30 s, 1 min, 2 min… jusqu'à 10 min.
- Un téléphone neuf reprend la version du serveur telle quelle, sans y mêler ses valeurs par défaut.

## Coûts

Aucun coût récurrent :

- Cloudflare Workers et D1 dans l'offre gratuite ;
- Google Sign-In gratuit ;
- pas d'API d'IA payante ;
- EAS : les builds restent dans le quota gratuit.
