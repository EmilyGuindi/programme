# BYYND — app Android

React Native + Expo (SDK 57), TypeScript, Expo Router.

- `src/engine/` : moteur de coaching (règles explicites, sans IA), testé : `npx tsx --test src/engine/__tests__/*.test.ts`
- `src/store/` : état local (AsyncStorage) + synchro avec le Worker BYYND
- `src/components/`, `src/theme/` : design system
- `src/app/` : écrans (Expo Router)

Build : GitHub Actions → EAS Build (plan gratuit, APK). Aucun secret dans ce dossier.

Dernière mise à jour du pipeline : 2026-10-15.
