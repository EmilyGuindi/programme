# BYYND

Coach sportif personnel, adaptatif. PWA + Worker Cloudflare (gratuit).

- `index.html`, `sw.js`, `manifest.json`, icônes : l'application.
- `worker/` : l'API (Cloudflare Workers + D1).
- `.github/workflows/deploy.yml` : déploiement automatique à chaque push.

Aucun secret dans ce dépôt : la clé d'accès, le jeton Cloudflare et, plus tard, le secret Strava vivent dans les secrets GitHub et Cloudflare.

