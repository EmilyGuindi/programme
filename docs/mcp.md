# MCP : préparé, pas déployé

Les fonctions métier existent et sont testées (`mobile/src/engine/tools.ts`) :

- `get_active_program`, `get_training_history`, `get_running_progress`, `get_recovery_summary` ;
- `get_upcoming_events`, `get_personal_records` ;
- `preview_workout_reschedule`, `create_program_draft`, `preview_program`, `confirm_program_activation`.

`toolSchemas()` produit leurs schémas JSON (`additionalProperties: false`).

**Aucun serveur MCP n'est déployé.** Ce serait aujourd'hui une surface d'attaque sans client capable de s'en servir :

- rien ne garantit qu'un compte ChatGPT puisse se connecter à un serveur MCP personnel ;
- un serveur public exposerait des données sportives.

Conditions pour le faire plus tard :

1. Un client MCP réellement disponible pour la propriétaire.
2. Le serveur MCP sur le Worker, derrière la même authentification que l'app :
   - session BYYND ou OAuth ;
   - chaque appel résolu sur l'utilisateur de la session, jamais sur un identifiant fourni.
3. Les écritures (`create_program_draft`, `confirm_program_activation`, déplacements) restent des **propositions** :
   - l'activation se confirme dans l'app ;
   - le serveur n'active jamais un programme sur simple appel MCP.
4. Mêmes permissions par catégorie que le coach, et journal des appels.
5. Aucun coût : le Worker et D1 restent dans l'offre gratuite de Cloudflare.
