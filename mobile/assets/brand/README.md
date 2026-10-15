# BYYND — Brand assets

Ready for Claude Code / a front-end project.

- `logo_primary.svg`: main horizontal lockup for light UI.
- `logo_white.svg`: for dark UI.
- `logo_black.svg`: monochrome logo.
- `symbol_*.svg`: standalone mark.
- `app_icon_blue.svg`: preferred app icon, plus PNG exports (192 / 512 / 1024).
- `favicon.svg`: browser icon.
- `brand-tokens.json`: official palette.

**Implementation:** put assets in `public/brand/`, set PWA manifest icons to 192 and 512 PNG variants, use SVG primary mark in the app header, and don't embed the big presentation board as the logo. For the logo wordmark, SVG text remains editable and uses system fallback; tune to your chosen font before shipping.

**Design fidelity:** These are usable clean vector reconstructions following the approved concept (split Y, cobalt and charcoal). The image-generated presentation is a visual reference and is not a vector source; exact pixel reproduction is not guaranteed.
