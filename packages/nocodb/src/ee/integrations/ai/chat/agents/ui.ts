/**
 * UI Agent — self-contained config + prompt.
 *
 * Specialist for app navigation — opens tables, views, dashboards.
 * Gets high-level schema depth (table names + relationships only).
 * Simplest agent — few tools, low maxTurns.
 */

import type {
  AgentDefinition,
  AgentPromptParams,
  SpecialistPromptParams,
} from '~/integrations/ai/chat/agents/types';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import {
  appendDynamicSections,
  buildSpecialistSuffix,
} from '~/integrations/ai/chat/agents/helpers';

export const uiAgent: AgentDefinition = {
  name: 'ui',
  description: 'Navigates the app — opens tables, views, and dashboards',
  tools: [
    ChatToolName.OPEN_TABLE,
    ChatToolName.OPEN_VIEW,
    ChatToolName.OPEN_DASHBOARD,
    ChatToolName.LIST_TABLES,
    ChatToolName.LIST_VIEWS,
    ChatToolName.ANNOUNCE,
  ],
  maxTurns: 5,
  schemaDepth: 'high-level',
  modelTier: 'low',

  buildPrompt(params: AgentPromptParams): string {
    const p = params as SpecialistPromptParams;
    const parts: string[] = [];

    // ─── Identity ──────────────────────────────────────────────────────────
    parts.push(`You are Paw, the NocoDB AI assistant — acting as the UI specialist. \
You navigate the app — open tables, views, and dashboards.

**Tone:**
- Formal, do not use first-person language.
- Be concise — navigation confirmations should be one sentence.
- Use the same language the user uses.`);

    // ─── Tools ─────────────────────────────────────────────────────────────
    parts.push(`
## Your Tools

\`open_table\`, \`open_view\`, \`open_dashboard\`, \
\`list_tables\`, \`list_views\`, \`return_to_router\`

- \`open_table\`: Open a specific table in the current base
- \`open_view\`: Open a specific view of a table
- \`open_dashboard\`: Open a dashboard`);

    // ─── Rules ─────────────────────────────────────────────────────────────
    parts.push(`
## Rules

- If the user says "open X" and X is ambiguous (multiple matches), use \`return_to_router\` — the router handles clarification.`);

    // ─── UI-specific discipline ──────────────────────────────────────────
    parts.push(`
### Navigation Confirmation

- **When navigation succeeds, explicitly state what was opened or changed.** Do not silently succeed.
- **If the requested view/table cannot be found, do not guess** — list nearest matches or route to the router.
- **Only use UI actions when the user's request is actually navigational.** If they want data or schema changes, route instead.`);

    // ─── Shared completion contract + operational rules ──────────────────
    parts.push(buildSpecialistSuffix());

    // ─── Dynamic sections ──────────────────────────────────────────────────
    appendDynamicSections(parts, p, {
      skipRoles: true,
    });

    return parts.join('\n');
  },
};
