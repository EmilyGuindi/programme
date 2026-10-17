import type { RunSession, Zone } from './types';

export interface Segment { label: string; sec: number | null; zone?: Zone; kind: 'warm' | 'work' | 'rec' | 'easy' | 'free' | 'cool'; step: number }

/** Découpe une séance en segments chronométrés à partir de ses consignes écrites.
 *  « 12 min facile » → 12 min ; « 4 × 1 min allure 10 km, récup 2 min de trot » → 4 répétitions + 3 récupérations.
 *  Une consigne sans durée (accélérations, lignes droites) reste un segment libre, validé à la main. */
export function segments(run: RunSession): Segment[] {
  const out: Segment[] = [];
  run.steps.forEach((st, i) => {
    const t = st.text.replace(/(\d),(\d)/g, '$1.$2');
    const rep = /(\d+)\s*[×x]\s*(\d+(?:\.\d+)?)\s*min(?:[^,]*,\s*récup\s*(\d+(?:\.\d+)?)\s*min)?/i.exec(t);
    if (rep) {
      const n = +rep[1], w = +rep[2] * 60, r = rep[3] ? +rep[3] * 60 : null;
      for (let k = 0; k < n; k++) {
        out.push({ label: `Répétition ${k + 1} / ${n}`, sec: w, zone: st.zone ?? undefined, kind: 'work', step: i });
        if (r && k < n - 1) out.push({ label: 'Récupération en trot', sec: r, zone: 'easy', kind: 'rec', step: i });
      }
      return;
    }
    const sp = /(\d+)\s*(?:lignes droites|accélérations)[^,]*?(\d+)\s*s[^,]*,\s*récup\s*(\d+(?:\.\d+)?)\s*(s|min)/i.exec(t);
    if (sp) {
      const n = +sp[1], w = +sp[2], r = sp[4] === 'min' ? +sp[3] * 60 : +sp[3];
      for (let k = 0; k < n; k++) { out.push({ label: `Accélération ${k + 1} / ${n} · rapide et relâchée`, sec: w, kind: 'work', step: i }); out.push({ label: 'Récupération en marchant', sec: r, kind: 'rec', step: i }); }
      return;
    }
    const m = /^(\d+(?:\.\d+)?)\s*min/i.exec(t.trim());
    const kind: Segment['kind'] = /échauffement/i.test(t) || (i === 0 && run.steps.length > 1) ? 'warm' : /marche pour finir|marche$/i.test(t) || i === run.steps.length - 1 && /min de marche/.test(t) ? 'cool' : 'easy';
    out.push({ label: st.text, sec: m ? +m[1] * 60 : null, zone: st.zone ?? undefined, kind: m ? kind : 'free', step: i });
  });
  return out;
}
export const totalSec = (segs: Segment[]) => segs.reduce((t, s) => t + (s.sec || 0), 0);
