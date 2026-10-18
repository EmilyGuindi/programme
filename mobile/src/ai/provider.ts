import type { AppState, CoachCard, CoachMsg, DataScope, ISODate, ToolCall } from '@/engine/types';

/** Ce qu'un fournisseur peut faire : lire via des fonctions autorisées, proposer des actions. Rien d'autre. */
export interface CoachContext {
  today: ISODate;
  /** Lecture contrôlée (fonction connue, permission, paramètres). Renvoie { error } si refusée. */
  read(call: ToolCall): { data?: any; error?: string };
  /** Proposition d'écriture : devient une carte à confirmer. Jamais exécutée ici. */
  propose(call: ToolCall): CoachCard | { error: string };
  /** État en lecture seule, pour les fournisseurs locaux uniquement (un fournisseur externe ne reçoit que minimalContext). */
  state: Readonly<AppState>;
  history: readonly CoachMsg[];
  /** Pièces jointes du message en cours (photo, PDF, texte). */
  attachments?: readonly import('./attachments').Attachment[];
}
export interface CoachReply { text: string; cards: CoachCard[]; suggestions?: string[]; memo?: string[] }
export interface ProviderStatus { available: boolean; label: string; detail: string; blockers?: string[] }
export interface CoachProvider { id: 'local' | 'chatgpt' | 'claude'; name: string; status(): ProviderStatus; respond(input: string, ctx: CoachContext): Promise<CoachReply> }
export type { DataScope };
