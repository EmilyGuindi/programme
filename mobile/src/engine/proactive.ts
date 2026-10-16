import { activitiesOn, adapted, daysBetweenSafe, planFor, recovery } from './coach';
import { addDays, DAYS_SHORT, dow, fmtShort } from './dates';
import type { Adjustment, AppState, ISODate } from './types';

export interface Proposal { id: string; title: string; changes: { date: ISODate; label: string; adj: Adjustment }[]; why: string; impact: string; caution?: string }

const isHardRun = (s: AppState, d: ISODate) => { const p = planFor(s, d); return p.type === 'run' && !!p.run && (p.run.kind === 'qualite' || p.run.kind === 'test'); };
const dayLabel = (d: ISODate) => `${DAYS_SHORT[dow(d)]} ${fmtShort(d)}`;

/** Propositions du coach : anticipent les contraintes connues. Rien n'est appliqué sans « Accepter ». */
export function proposals(s: AppState, today: ISODate): Proposal[] {
  const out: Proposal[] = []; const decided = s.proposals || {};
  const push = (p: Proposal) => { if (!decided[p.id] && p.changes.length) out.push(p); };
  const next = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, i));

  // 1. Compétition dans les 3 jours : pas de séance dure juste avant
  for (const ev of s.events.filter(e => e.status !== 'annulé' && !e.result && e.date > today && daysBetweenSafe(today, e.date) <= 3)) {
    const ch = next(daysBetweenSafe(today, ev.date)).filter(d => d < ev.date && !s.overrides[d]?.adj).flatMap((d): Proposal['changes'] => {
      const p = planFor(s, d);
      if (isHardRun(s, d)) return [{ date: d, label: `${dayLabel(d)} : ${p.title} → footing facile`, adj: { kind: 'easy' as const, reason: `Course ${ev.name} dans ${daysBetweenSafe(d, ev.date)} jour(s) : on garde les jambes fraîches.`, proposalId: `race-${ev.id}` } }];
      if (p.type === 'renfo' && !p.short && daysBetweenSafe(d, ev.date) <= 2) return [{ date: d, label: `${dayLabel(d)} : renforcement → version réduite`, adj: { kind: 'reduced' as const, reason: `Course ${ev.name} imminente.`, proposalId: `race-${ev.id}` } }];
      return [];
    });
    push({ id: `race-${ev.id}`, title: `Préparer ${ev.name}`, changes: ch, why: `Ta course est le ${fmtShort(ev.date)}. Une séance intense dans les 72 h avant fatigue les jambes sans te rendre plus en forme.`, impact: 'Aucune perte de forme : l\'entraînement des dernières semaines est déjà fait. Tu arrives plus fraîche.' });
  }

  // 2. Fatigue sur plusieurs jours
  const last3 = [0, 1, 2].map(i => addDays(today, -i)).map(d => recovery(s, d).level);
  const tired = last3.filter(l => l === 'orange' || l === 'rouge').length;
  if (tired >= 2) {
    const ch = next(4).filter(d => !s.overrides[d]?.adj).flatMap((d): Proposal['changes'] => {
      if (isHardRun(s, d)) return [{ date: d, label: `${dayLabel(d)} : séance d'allure → footing facile`, adj: { kind: 'easy' as const, reason: 'Plusieurs jours de fatigue : intensité réduite.', proposalId: `fatigue-${today}` } }];
      if (planFor(s, d).type === 'renfo') return [{ date: d, label: `${dayLabel(d)} : renforcement → version réduite`, adj: { kind: 'reduced' as const, reason: 'Plusieurs jours de fatigue : volume réduit.', proposalId: `fatigue-${today}` } }];
      return [];
    });
    push({ id: `fatigue-${today}`, title: 'Alléger les prochains jours', changes: ch, why: `${tired} de tes 3 derniers check-ins montrent de la fatigue (sommeil, énergie ou charge récente).`, impact: 'La progression reprend dès que la récupération suit. Forcer maintenant risque de prolonger la fatigue.' });
  }

  // 3. Charge élevée : au moins 3 séances à 8/10 ou plus en 5 jours, séance d'allure dans les 2 jours
  const hard = [1, 2, 3, 4, 5].flatMap(i => activitiesOn(s, addDays(today, -i)).filter(a => (a.effort ?? 0) >= 8)).length;
  if (hard >= 3) {
    const ch = next(3).filter(d => isHardRun(s, d) && !s.overrides[d]?.adj).map(d => ({ date: d, label: `${dayLabel(d)} : ${planFor(s, d).title} → footing facile`, adj: { kind: 'easy' as const, reason: 'Charge élevée ces derniers jours.', proposalId: `load-${today}` } }));
    push({ id: `load-${today}`, title: 'Charge élevée cette semaine', changes: ch, why: `${hard} séances ressenties à 8/10 ou plus sur les 5 derniers jours.`, impact: 'La séance d\'allure revient la semaine suivante, dans de meilleures conditions.' });
  }

  // 4. Douleur récurrente
  const zones = Object.entries(s.checkins).filter(([d, c]) => d >= addDays(today, -14) && d <= today && c.pain === 'oui' && c.painZone).map(([, c]) => c.painZone!);
  const z = zones.find(x => zones.filter(y => y === x).length >= 3);
  if (z) {
    const ch = next(7).filter(d => !s.overrides[d]?.adj && (planFor(s, d).type === 'renfo' || (z !== 'épaule' && isHardRun(s, d)))).map(d => ({ date: d, label: z === 'épaule' ? `${dayLabel(d)} : variantes épaule sur tout le renforcement` : `${dayLabel(d)} : ${planFor(s, d).title} → version douce`, adj: { kind: (z === 'épaule' ? 'shoulder' : planFor(s, d).type === 'renfo' ? 'reduced' : 'easy') as Adjustment['kind'], reason: `Douleur ${z} récurrente.`, proposalId: `pain-${z}-${today}` } }));
    push({ id: `pain-${z}-${today}`, title: `Ménager ${z === 'épaule' ? 'ton épaule' : `ton ${z}`}`, changes: ch, why: `Douleur ${z === 'épaule' ? 'à l\'épaule' : `au ${z}`} signalée ${zones.filter(y => y === z).length} fois en deux semaines.`, impact: 'Tu continues à t\'entraîner, en réduisant ce qui sollicite la zone.', caution: 'BYYND ne remplace pas un avis médical : si la douleur persiste ou s\'aggrave, consulte un kiné ou un médecin.' });
  }
  return out;
}

export function acceptProposal(s: AppState, p: Proposal) {
  p.changes.forEach(c => { s.overrides[c.date] = { ...(s.overrides[c.date] || {}), adj: c.adj }; });
  s.proposals = { ...(s.proposals || {}), [p.id]: { decision: 'accepted', at: Date.now() } };
}
export function keepProgram(s: AppState, p: Proposal) { s.proposals = { ...(s.proposals || {}), [p.id]: { decision: 'kept', at: Date.now() } }; }
export function undoAdjustment(s: AppState, d: ISODate) { if (s.overrides[d]) delete s.overrides[d].adj; }
export const _u = { adapted };
