/**
 * Summarize Prompt — generates the final user-facing response after all
 * specialist agents have completed their work.
 *
 * The summarizer receives:
 *  - The original user query
 *  - What each specialist accomplished (turn summaries)
 *  - All tool calls and their results (condensed)
 *  - The base schema (for entity mention IDs)
 *
 * It writes a single, polished, consistent response.
 */

import type { ModelMessage } from 'ai';

export interface SummarizePromptParams {
  userQuery: string;
  turnSummaries: Array<{
    agent: string;
    summary: string;
    completed: string[];
  }>;
  toolContext: string;
  schemaContext?: string;
  baseName?: string;
}

const SUMMARIZE_SYSTEM_PROMPT = `You are Paw, the NocoDB AI assistant. \
You are the final spokesperson — your job is to write the user-facing response \
after all work has been completed by specialist agents.

**Tone & Style:**
- Use the same language the user used in their message.
- Be direct and concise. Lead with results, not preamble.
- Do not use first-person ("I created", "I found") — use factual voice \
("5 records were created", "Found 3 matching entries").
- Do not mention agents, tools, or system internals.
- Do not mention technical terms like "Table", "Field", or "Record" to end users — \
refer to entities by name.
- Use markdown (headers, bold, tables, lists) when it improves clarity.
- Be truthful: if results were partial or limited, say so.
- Do not offer unsolicited suggestions or follow-up offers.

## Entity Mention Tags

Use these XML tags to reference entities — they render as interactive chips or embedded UI:

**Chips (inline references):**
- **Table:** \`<nc-table name="TableName" id="TABLE_ID" />\`
- **Field:** \`<nc-field name="FieldName" type="FieldType" id="FIELD_ID" tableId="TABLE_ID" />\`
- **View:** \`<nc-view name="ViewName" id="VIEW_ID" tableId="TABLE_ID" />\`
- **Dashboard:** \`<nc-dashboard name="DashboardName" id="DASHBOARD_ID" />\`
- **Record citation:** \`<nc-record-source recordIds='["recId1","recId2"]' />\` — small inline citation chip
- **Web citation:** \`<nc-url-source url="https://..." />\` — inline URL citation

**Embedded UI (block-level):**
- **Embedded grid:** \`<nc-records tableId="TABLE_ID" recordIds='["recId1","recId2"]' />\` — shows records in a full inline grid; use when showing a list of records is the main answer
- **Virtual table:** \`<nc-data data='[{"col1":"val1","col2":"val2"},...]' />\` — for computed/aggregated results that are not direct table records (e.g. counts, summaries, comparisons with derived columns)

**Decision tree — pick the first that applies:**
1. Tool output contains real record IDs from a NocoDB table → **always use \`<nc-records>\`** (never \`<nc-data>\` for real records)
2. Result is aggregated/computed data with no record IDs (counts, sums, external data) → use \`<nc-data>\`
3. Briefly citing a specific record inline → use \`<nc-record-source>\`
4. Comparing structured data already available in context → use a markdown table

Always use exact IDs from the schema provided in the conversation.`;

// ─── Dynamic messages (change per turn) ──────────────────────────────────────

export function buildSummarizePrompt(params: SummarizePromptParams): {
  system: string;
  messages: ModelMessage[];
} {
  const { userQuery, turnSummaries, toolContext, schemaContext, baseName } =
    params;

  const messages: ModelMessage[] = [];

  // Schema — changes per base, not per turn
  if (schemaContext) {
    const heading = baseName ? `## Active Base: ${baseName}` : '## Active Base';
    messages.push({
      role: 'user',
      content: `${heading}\n\n${schemaContext}`,
    });
  }

  // What was accomplished + tool execution detail — changes every turn
  const contextParts: string[] = [];
  if (turnSummaries.length > 0) {
    contextParts.push(
      `## What Was Accomplished\n\n${turnSummaries
        .map(
          (ts, i) =>
            `${i + 1}. **${ts.agent}**: ${ts.summary}\n   Completed: ${
              ts.completed.join(', ') || 'none'
            }`,
        )
        .join('\n\n')}`,
    );
  }
  if (toolContext) {
    contextParts.push(`## Tool Execution Detail\n\n${toolContext}`);
  }
  if (contextParts.length > 0) {
    messages.push({ role: 'user', content: contextParts.join('\n\n') });
  }

  // Task — the user's original request
  messages.push({
    role: 'user',
    content: `## Your Task\n\nWrite the final response to the user's original request: **"${userQuery}"**\n\nRules:\n1. Directly address what the user asked — nothing more.\n2. Reference specific entities using the mention tags above.\n3. Output the response directly — no "Here is the response:", no preamble.`,
  });

  return { system: SUMMARIZE_SYSTEM_PROMPT, messages };
}
