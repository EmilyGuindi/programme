/* ============================================================
   Barre de navigation — calcul de mise en page (pur, testé).
   Diagnostic V3 : la capsule active occupait toute la colonne (barre à 92 %, padding 6, marges 2),
   soit 66,6 px à 320 px de large, alors que « Progression » mesure 64 px en Inter SemiBold 11 px.
   Le libellé n'était pas une contrainte du layout : agrandi de 20 % par le réglage Android, il débordait
   ou était tronqué par numberOfLines. Ici, la largeur des libellés pilote la taille du texte, jamais l'inverse.
   ============================================================ */

/** Largeurs des libellés en em, mesurées sur Inter Medium 500 (moteur de rendu Chromium, police du dépôt),
 *  majorées de 4 % pour couvrir l'écart de rendu Android. Pour une nouvelle étiquette : la mesurer de la même façon. */
export const LABEL_EM: Record<string, number> = { "Aujourd'hui": 5.522, Programme: 5.547, Progression: 5.723, Profil: 2.5 };
const SAFETY = 1.04;
export const NAV_LABELS = ["Aujourd'hui", 'Programme', 'Progression', 'Profil'] as const;

export const NAV = {
  label: 12,          // taille de base, jamais réduite
  maxScale: 1.6,      // plafond d'agrandissement, même si la place le permet
  icon: 24,
  pillW: 56, pillH: 32,
  gapIconLabel: 4,
  padV: 8,            // marge verticale dans la barre
  minLabelGap: 6,     // espace minimal entre deux libellés voisins
  dockTop: 8,         // fond opaque au-dessus de la barre (masque le contenu qui défile)
  dockBottom: 8,      // en plus de la zone système
  breathing: 24,      // respiration sous le dernier contenu d'une page
} as const;

export interface NavLayout { barW: number; margin: number; colW: number; label: number; lineH: number; barH: number; dockH: number; contentInset: number; widestPx: number; fits: boolean }

/** Mise en page de la barre pour une largeur d'écran (dp / CSS px), une échelle de police système et une zone système basse. */
export function navLayout(screenW: number, fontScale = 1, bottomInset = 0, labels: readonly string[] = NAV_LABELS): NavLayout {
  // Marges latérales proportionnées : presque pleine largeur sur les petits écrans, flottante au-delà.
  // L'indicateur actif est une pastille derrière l'icône : la colonne entière reste disponible pour le libellé.
  const margin = screenW < 340 ? 4 : screenW < 380 ? 10 : 14;
  const barW = Math.min(480, screenW - 2 * margin);
  const colW = barW / labels.length;
  const em = Math.max(...labels.map(l => (LABEL_EM[l] ?? l.length * 0.6) * SAFETY));
  // Le texte grandit avec le réglage Android tant qu'il tient dans sa colonne ; jamais sous la taille de base.
  const fitScale = (colW - NAV.minLabelGap) / (em * NAV.label);
  const scale = Math.max(1, Math.min(fontScale, NAV.maxScale, fitScale));
  const label = Math.floor(NAV.label * scale * 4) / 4; // par quarts de pixel, arrondi vers le bas : jamais plus large que la place
  const lineH = Math.ceil(label * 1.34);
  const barH = NAV.padV * 2 + NAV.pillH + NAV.gapIconLabel + lineH;
  const dockH = NAV.dockTop + barH + NAV.dockBottom + bottomInset;
  const widestPx = em * label;
  return { barW, margin, colW, label, lineH, barH, dockH, contentInset: dockH + NAV.breathing, widestPx, fits: widestPx + NAV.minLabelGap <= colW + 0.01 };
}
