/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_EM, NAV, NAV_LABELS, navLayout } from '../../theme/nav-layout';

/* Régression barre de navigation : largeurs demandées × échelles de police Android (100 % à 200 %) × zones système. */
const WIDTHS = [320, 360, 393, 430];
const SCALES = [1, 1.15, 1.3, 1.5, 1.8, 2];
const INSETS = [0, 24, 48];

test('chaque libellé tient dans sa colonne, sans réduction sous 12 px, à toutes les largeurs et tailles de police', () => {
  for (const w of WIDTHS) for (const fs of SCALES) {
    const L = navLayout(w, fs);
    assert.ok(L.fits, `${w}px ×${fs}`);
    assert.ok(L.label >= NAV.label, `${w}px ×${fs} : ${L.label}px`);
    for (const l of NAV_LABELS) assert.ok(LABEL_EM[l] * 1.04 * L.label + NAV.minLabelGap <= L.colW + 0.01, `${l} à ${w}px ×${fs}`);
  }
});
test('quatre zones égales qui remplissent la barre, sans dépasser l\'écran', () => {
  for (const w of WIDTHS) { const L = navLayout(w); assert.equal(L.colW * 4, L.barW); assert.ok(L.barW + 2 * L.margin <= w); }
});
test('la pastille active ne déborde jamais de sa colonne', () => {
  for (const w of WIDTHS) for (const fs of SCALES) { const L = navLayout(w, fs); assert.ok(NAV.pillW <= L.colW - 8, `${w}px`); assert.ok(NAV.pillH + NAV.gapIconLabel + L.lineH <= L.barH); }
});
test('cibles tactiles d\'au moins 48 × 48', () => {
  for (const w of WIDTHS) for (const fs of SCALES) { const L = navLayout(w, fs); assert.ok(L.colW >= 48 && L.barH >= 48); }
});
test('le texte suit le réglage Android tant qu\'il y a de la place', () => {
  assert.ok(navLayout(430, 1.3).label > navLayout(430, 1).label);
  assert.ok(navLayout(393, 2).label > 12);
});
test('zone système prise en compte : le socle opaque et l\'espace de défilement grandissent avec elle', () => {
  for (const w of WIDTHS) for (const inset of INSETS) {
    const L = navLayout(w, 1, inset);
    assert.equal(L.dockH, NAV.dockTop + L.barH + NAV.dockBottom + inset);
    assert.ok(L.contentInset >= L.dockH + 16, 'le dernier contenu reste au-dessus de la barre');
  }
});
