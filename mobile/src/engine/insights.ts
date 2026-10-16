import { comparable, runsList, trend, weightSeries } from './coach';
import { addDays, fmtShort, num } from './dates';
import { EX } from './library';
import { weekSuccess } from './journey';
import type { AppState, ISODate } from './types';

export type Confidence = 'observation' | 'tendance' | 'confirmée';
export interface Insight { id: string; domain: 'running' | 'force' | 'régularité' | 'récupération' | 'poids' | 'douleurs'; level: Confidence; text: string; basis: string }
const pace = (a: { durationMin?: number | null; distanceKm?: number | null }) => (a.durationMin! * 60) / a.distanceKm!;
const span = (a: ISODate, b: ISODate) => `du ${fmtShort(a)} au ${fmtShort(b)}`;

/** Insights traçables : chaque phrase indique sur quoi elle repose. Rien n'est affiché sans données suffisantes. Une corrélation n'est jamais présentée comme une cause. */
export function insights(s: AppState, today: ISODate): Insight[] {
  const out: Insight[] = [];
  const runs = runsList(s).filter(r => r.type === 'running');
  const easy = runs.filter(r => (r.kind || 'facile') === 'facile');
  const last = easy[easy.length - 1];
  if (last) {
    const cmp = easy.filter(r => r.id !== last.id && r.date < last.date && comparable(r, last)).slice(-4);
    if (cmp.length >= 2) {
      const d = cmp.reduce((t, r) => t + pace(r), 0) / cmp.length - pace(last);
      const eff = last.effort != null && cmp.every(r => r.effort != null) ? last.effort - cmp.reduce((t, r) => t + (r.effort || 0), 0) / cmp.length : null;
      if (d > 5 && (eff == null || eff <= 0.5)) out.push({ id: 'run-pace', domain: 'running', level: 'tendance', text: `Sur des parcours comparables, tu cours ${Math.round(d)} s/km plus vite${eff != null ? ' à effort similaire' : ''}.`, basis: `${cmp.length + 1} sorties faciles comparables ${span(cmp[0].date, last.date)}` });
      const hr = [...cmp, last].filter(r => r.avgHr);
      if (hr.length >= 3) { const first = hr[0], end = hr[hr.length - 1]; const dp = Math.abs(pace(first) - pace(end)); const dh = (first.avgHr || 0) - (end.avgHr || 0);
        if (dp < 10 && dh >= 4) out.push({ id: 'run-hr', domain: 'running', level: 'tendance', text: `À allure proche, ta fréquence cardiaque a baissé de ${Math.round(dh)} bpm.`, basis: `${hr.length} sorties comparables avec FC ${span(first.date, end.date)}` }); }
    }
    const prev = easy.filter(r => r.id !== last.id && r.date < last.date).slice(-1)[0];
    if (prev && pace(last) - pace(prev) > 10 && (last.elevM || 0) / last.distanceKm! - (prev.elevM || 0) / prev.distanceKm! > 8) out.push({ id: 'run-elev', domain: 'running', level: 'observation', text: `Ta dernière sortie était plus lente, mais avec plus de dénivelé (${last.elevM} m contre ${prev.elevM || 0} m). Elle ne traduit pas une régression.`, basis: `sorties du ${fmtShort(prev.date)} et du ${fmtShort(last.date)}` });
  }
  const refs = [...s.events.filter(e => e.result && e.distanceKm && e.distanceKm >= 9.9 && e.distanceKm <= 10.3).map(e => ({ d: e.date, p: e.result!.time / e.distanceKm!, n: e.name })), ...runs.filter(r => r.kind === 'test' && r.distanceKm! >= 9.9).map(r => ({ d: r.date, p: pace(r), n: 'test 10 km' }))].sort((a, b) => a.d.localeCompare(b.d));
  if (refs.length >= 2 && refs[refs.length - 1].p < refs[0].p - 3) out.push({ id: 'run-ref', domain: 'running', level: 'confirmée', text: `Progression confirmée sur 10 km : ${Math.round(refs[0].p - refs[refs.length - 1].p)} s/km de mieux.`, basis: `${refs[0].n} (${fmtShort(refs[0].d)}) puis ${refs[refs.length - 1].n} (${fmtShort(refs[refs.length - 1].d)})` });

  for (const id of ['f1', 'm2', 'm3', 'm1', 'm4']) {
    const pts = Object.keys(s.strength).filter(d => d <= today).sort().map(d => ({ d, kg: Math.max(0, ...(s.strength[d].ex?.[id]?.kg || []).map(num).filter((n): n is number => !!n)) })).filter(p => p.kg > 0);
    if (pts.length >= 3 && pts[pts.length - 1].kg > pts[0].kg) { out.push({ id: 'str-' + id, domain: 'force', level: 'tendance', text: `${EX[id].name.split(',')[0]} : de ${String(pts[0].kg).replace('.', ',')} à ${String(pts[pts.length - 1].kg).replace('.', ',')} kg.`, basis: `${pts.length} séances ${span(pts[0].d, pts[pts.length - 1].d)}` }); break; }
  }
  const ws = weekSuccess(s, today); let streak = 0; for (let i = ws.length - 1; i >= 0 && ws[i].ok; i--) streak++;
  if (streak >= 3) out.push({ id: 'reg', domain: 'régularité', level: 'tendance', text: `${streak} semaines réussies d'affilée.`, basis: `semaines ${ws.length - streak + 1} à ${ws.length}` });

  // Association sommeil ↔ ressenti : au moins 8 séances avec check-in et effort, et un écart net.
  const pairs = s.activities.filter(a => !a.complementary && a.effort != null && s.checkins[a.date]?.sleep).map(a => ({ good: ['bien', 'tres'].includes(s.checkins[a.date].sleep!), e: a.effort! }));
  const g = pairs.filter(p => p.good), b = pairs.filter(p => !p.good);
  if (pairs.length >= 8 && g.length >= 3 && b.length >= 3) { const dg = g.reduce((t, p) => t + p.e, 0) / g.length, db = b.reduce((t, p) => t + p.e, 0) / b.length;
    if (db - dg >= 1) out.push({ id: 'sleep', domain: 'récupération', level: 'observation', text: 'Tes séances ont souvent semblé plus faciles après des nuits que tu avais notées bonnes. C\'est une association, pas une preuve.', basis: `${pairs.length} séances avec check-in : effort moyen ${dg.toFixed(1).replace('.', ',')}/10 après une bonne nuit, ${db.toFixed(1).replace('.', ',')}/10 sinon` }); }

  const ms = weightSeries(s); const recent = ms.filter(m => m.date >= addDays(today, -35));
  if (recent.length >= 4) { const tr = trend(ms); const i0 = ms.indexOf(recent[0]); const d = tr[tr.length - 1] - tr[i0];
    out.push({ id: 'weight', domain: 'poids', level: ms.filter(m => m.date >= addDays(today, -63)).length >= 8 ? 'confirmée' : 'tendance', text: Math.abs(d) < 0.3 ? 'Ta tendance de poids est stable sur le mois.' : d < 0 ? `Ta tendance de poids baisse de ${Math.abs(d).toFixed(1).replace('.', ',')} kg sur le mois.` : `Ta tendance de poids remonte de ${d.toFixed(1).replace('.', ',')} kg sur le mois : à relire sur plusieurs semaines.`, basis: `${recent.length} pesées ${span(recent[0].date, recent[recent.length - 1].date)}, tendance lissée` }); }

  const zones = Object.entries(s.checkins).filter(([d, c]) => d >= addDays(today, -14) && c.pain === 'oui' && c.painZone).map(([, c]) => c.painZone!);
  const z = zones.find(x => zones.filter(y => y === x).length >= 3);
  if (z) out.push({ id: 'pain', domain: 'douleurs', level: 'observation', text: `Douleur ${z === 'épaule' ? 'à l\'épaule' : `au ${z}`} signalée ${zones.filter(y => y === z).length} fois en deux semaines. Si elle persiste, un avis kiné ou médical est préférable.`, basis: 'check-ins des 14 derniers jours' });
  return out;
}
