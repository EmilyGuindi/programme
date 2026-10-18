import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** Pièce jointe envoyée au coach. Le contenu ne sert qu'au message en cours : il n'est ni stocké, ni synchronisé, ni renvoyé ensuite. */
export type Attachment =
  | { kind: 'image'; name: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string; uri: string }
  | { kind: 'pdf'; name: string; data: string }
  | { kind: 'text'; name: string; text: string };
export const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_B64 = 3_800_000, MAX_PDF_B64 = 4_000_000, MAX_TEXT = 60_000;
const IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|gpx|tcx|xml)$/i;

export type PickResult = { ok: true; item: Attachment } | { ok: false; message: string } | null;

/** Photo de la galerie, compressée en JPEG (une photo de téléphone tient alors sous la limite). */
export async function pickPhoto(): Promise<PickResult> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.45, base64: true, allowsMultipleSelection: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0]; if (!a.base64) return { ok: false, message: 'Photo illisible.' };
  if (a.base64.length > MAX_IMAGE_B64) return { ok: false, message: 'Photo trop lourde : recadre-la ou fais une capture d\'écran.' };
  const mt = ((IMG as readonly string[]).includes(a.mimeType || '') ? a.mimeType : 'image/jpeg') as (typeof IMG)[number];
  return { ok: true, item: { kind: 'image', name: a.fileName || 'photo.jpg', mediaType: mt, data: a.base64, uri: a.uri } };
}

/** Fichier : PDF, texte (txt, md, csv, json, gpx…) ou image. */
export async function pickFile(): Promise<PickResult> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/*', 'application/json', 'image/*', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0]; const name = (a.name || 'fichier').slice(0, 80); const type = a.mimeType || ''; const f = new File(a.uri);
  try {
    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      const data = await f.base64(); if (data.length > MAX_PDF_B64) return { ok: false, message: 'PDF trop lourd (3 Mo maximum).' };
      return { ok: true, item: { kind: 'pdf', name, data } };
    }
    if ((IMG as readonly string[]).includes(type)) {
      const data = await f.base64(); if (data.length > MAX_IMAGE_B64) return { ok: false, message: 'Image trop lourde : utilise « Photo », qui la compresse.' };
      return { ok: true, item: { kind: 'image', name, mediaType: type as (typeof IMG)[number], data, uri: a.uri } };
    }
    if (type.startsWith('text/') || type === 'application/json' || TEXT_EXT.test(name)) {
      const text = await f.text(); return { ok: true, item: { kind: 'text', name, text: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + '\n[… tronqué]' : text } };
    }
    return { ok: false, message: 'Format non pris en charge : photo, PDF ou fichier texte (txt, csv, json, gpx…).' };
  } catch { return { ok: false, message: 'Fichier illisible.' }; }
}
export const attachmentLabel = (a: { kind: string; name: string }) => `${a.kind === 'image' ? 'Photo' : a.kind === 'pdf' ? 'PDF' : 'Fichier'} : ${a.name}`;
