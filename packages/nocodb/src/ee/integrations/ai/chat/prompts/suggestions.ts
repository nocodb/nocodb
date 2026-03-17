import type { ModelMessage } from 'ai';
import type { UserType } from 'nocodb-sdk';

export const SUGGESTION_TYPES = {
  RECOMMENDED: 'recommended',
  ASK: 'ask',
  ANALYZE: 'analyze',
  BUILD: 'build',
} as const;

export type SuggestionType =
  (typeof SUGGESTION_TYPES)[keyof typeof SUGGESTION_TYPES];

const OUTPUT_FORMAT = `
## Output format

- Each suggestion must be concise — max 80 characters.
- Use natural language, not NocoDB jargon.
- Output raw text, one suggestion per line. No numbering, bullets, or JSON.

## IMPORTANT: Use real data
- Each table includes sampleRecords with actual data values — USE them.
- Every suggestion MUST reference specific names, values, or dates from the sample data.
- NEVER write generic suggestions. Use actual record names, field values, and dates you see.
- Good: "Find the contact details for Andrew Goodman" (real record name from sampleRecords)
- Bad: "Summarize the key details in Customers" (generic, no real data)`;

// ---------------------------------------------------------------------------
// Per-category user prompts
// ---------------------------------------------------------------------------

const promptBySuggestionType: Record<SuggestionType, string> = {
  [SUGGESTION_TYPES.RECOMMENDED]: `Generate exactly 3 suggestions. Mix question-style and action-style.

Suggest:
- A question using a real record name from sampleRecords (e.g. "Find the contact details for Andrew Goodman")
- An analytical question using real field values (e.g. "What companies are customers from Nepal associated with?")
- Something to create that references existing tables (e.g. "Create a dashboard for Orders to track monthly revenue")

**Output exactly 3 suggestions.**
${OUTPUT_FORMAT}`,

  [SUGGESTION_TYPES.ASK]: `Give me 3 questions about my data. Use real values from sampleRecords.

One from each category:
- **Find**: Reference a real record name (e.g. "Find the contact details for Andrew Goodman from Stewart-Flynn")
- **List**: Use a real field value as filter (e.g. "List customers from the United States of America")
- **Summarize**: Ask about real data patterns (e.g. "What companies are customers from Nepal associated with?")

Do not start with "Create" or "Generate".

**Output exactly 3 suggestions.**
${OUTPUT_FORMAT}`,

  [SUGGESTION_TYPES.ANALYZE]: `Give me 3 analytical questions. Use real values from sampleRecords.

One from each category:
- **Trends**: Reference real date fields and values (e.g. "What are the trends in subscription dates across all customers?")
- **Breakdown**: Use real category values (e.g. "Find the number of customers by country")
- **Extremes**: Reference real fields (e.g. "Who is the customer with the earliest subscription date?")

Do not start with "Create" or "Generate".

**Output exactly 3 suggestions.**
${OUTPUT_FORMAT}`,

  [SUGGESTION_TYPES.BUILD]: `Generate exactly 3 things to create. Use the schema to understand what exists.

Categories (pick from any):
- **Field**: "Create a field in [table] to calculate [something useful based on existing fields]"
- **Table**: "Create a [name] table to track [something missing from the base]"
- **Dashboard**: "Create a dashboard for [table] to visualize [specific field]"
- **View**: A kanban/calendar/gallery/form view for a specific table

Every suggestion must reference real table names.

**Output exactly 3 suggestions.**
${OUTPUT_FORMAT}`,
};

// ---------------------------------------------------------------------------
// Follow-up suggestions — generated after each AI response
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared NocoDB context block — included in all suggestion system prompts
// to provide enough static content for prompt caching (1024+ token threshold).
// ---------------------------------------------------------------------------

const NOCODB_AI_CONTEXT = `
## What NocoDB AI can do

NocoDB is a no-code database platform that turns databases into collaborative spreadsheet interfaces. The AI assistant understands the user's base schema and can answer questions, retrieve records, analyse data, and create or modify database structure — all through natural language.

### Query & find data
- Find records matching specific criteria ("Find all tasks assigned to Alice that are overdue")
- List records filtered by field values ("List all customers from Germany")
- Retrieve specific record details by name, ID, or any field value
- Search across linked tables and follow relationships between records
- Filter by date ranges, select options, checkbox state, numeric ranges, or text patterns

### Analyse & summarise data
- Count records by group or condition ("How many orders were placed in January?")
- Calculate aggregates: sum, average, min, max across any numeric field
- Identify trends over time using date fields ("What are the subscription trends this year?")
- Find top/bottom performers, outliers, and duplicates
- Compare subsets ("Compare revenue across product categories")
- Answer pattern questions ("Which region has the most open support tickets?")
- Summarise key facts from a table or filtered subset as a concise report
- Cross-reference data from multiple linked tables in a single answer

### Create database structure
- Add a new table with specified fields and types
- Add a field to an existing table — supports all NocoDB field types: Single Line Text, Long Text, Number, Decimal, Currency, Percentage, Duration, Rating, Checkbox, Single Select, Multi Select, Date, Date & Time, Time, Year, Phone, Email, URL, Attachment, Link (HasMany / BelongsTo / ManyToMany), Formula, Rollup, Lookup, Count, Auto Number, Barcode, QR Code, Geometry, JSON, User
- Create a view: Grid, Kanban (group by any single-select field), Calendar (group by any date field), Gallery (cover image support), Form (data collection), List (hierarchical grouping)
- Create a dashboard with metric widgets, bar charts, line charts, pie charts, and embedded grids
- Configure field settings: select option labels and colours, date/time format, currency symbol, formula expression, rollup function, lookup target field, number precision, rating icon and max value

### Modify database structure
- Rename tables and fields
- Update field types or settings
- Add, rename, reorder, or delete select field options
- Reorder or hide/show fields in a specific view
- Update a formula expression or rollup function

### Modify data (destructive actions require user approval)
- Create new records in any table
- Update one or more field values in existing records
- Bulk-update all records matching a filter condition
- Delete records matching a condition

## What makes a good suggestion
A good suggestion is **specific** — it references real names, values, or dates from the user's actual data (from sampleRecords in the schema). Generic suggestions like "Summarise the Customers table" have zero value. Specific suggestions like "Find the contact details for Andrew Goodman from Stewart-Flynn" or "List customers whose subscription date is before 2023-01-01" are immediately useful.

A good suggestion is **actionable** — something the user can click and send as-is without editing.

A good suggestion is **varied** — across a set of suggestions, mix different intents: a data lookup, an analytical question, and a create/build action.

A good suggestion is **honest** — only reference tables, fields, and values that actually exist in the base schema. Never invent entity names.

## Output format
- Raw text only — no JSON, no markdown bullets, no numbering
- One suggestion per line, max 80 characters per line
- Use natural language: say "customer" not "record in the Customers table", say the actual field name not "a field"
- Do not start with "I" or "Let me" — write imperative or question-form suggestions directly`;

const FOLLOW_UP_PROMPT = `Suggest exactly 3 follow-ups that naturally continue THIS conversation.

## Rules
- Each follow-up MUST directly build on the topic, data, or result just discussed — not generic table-level questions
- Reference specific records, values, fields, or patterns mentioned in the assistant's response
- Vary the intent: dig deeper into a detail, compare/contrast, take an action (create field, view, dashboard)
- NEVER suggest something the assistant already answered
- NEVER produce generic suggestions like "Summarize the Customers table" — be specific to what was just said

## Output format
- Max 80 characters each
- Raw text, one per line — no numbering, bullets, or extra text
- Exactly 3 lines, nothing else`;

// ---------------------------------------------------------------------------
// Session title generation
// ---------------------------------------------------------------------------

// Static system prompt
export const TITLE_GENERATION_SYSTEM_PROMPT = `Generate a short, descriptive title (max 50 characters) for a NocoDB AI chat session.

NocoDB AI Assistant helps users query and analyze data, create and modify database structure (tables, fields, views, dashboards), and automate data operations — all through natural language.

Your task: given the user's opening message, generate a concise title that captures the main topic or action.

Rules:
- Keep it under 50 characters
- Be specific and descriptive — reference actual names or actions from the message
- Do not use quotes
- Focus on the main topic or action
- Use sentence case (capitalize first word only)
- Do not start with "How", "Can you", "Please" — extract the intent directly

Examples:
- "How do I create a view?" → "Creating views"
- "Show me all tasks assigned to John" → "Tasks assigned to John"
- "Help me build an automation for new records" → "Automation for new records"
- "What's the total revenue from Q3 orders?" → "Q3 revenue analysis"
- "Create a new table for tracking expenses" → "Expense tracking table"
- "Find all customers from the United States" → "Customers from United States"
- "Summarize the key metrics in my Sales table" → "Sales table metrics"
- "Add a Status field to the Projects table" → "Add Status field to Projects"
- "Show me overdue tasks assigned to Alice" → "Alice's overdue tasks"
- "Create a Kanban view for the Tasks table" → "Kanban view for Tasks"

Return only the title text, nothing else.`;

export function buildTitleGenerationMessages(userMessage: string): ModelMessage[] {
  return [{ role: 'user', content: `"${userMessage}"` }];
}

// ---------------------------------------------------------------------------
// Follow-up suggestions
// ---------------------------------------------------------------------------

export function buildFollowUpMessages(params: {
  schema: string;
  lastAssistantText: string;
  lastUserMessage: string;
}): ModelMessage[] {
  const { schema, lastAssistantText, lastUserMessage } = params;

  return [
    {
      role: 'system',
      content: `You are a follow-up suggestions engine for NocoDB's AI Assistant. Generate contextual follow-up suggestions based on the conversation and the user's base schema.${NOCODB_AI_CONTEXT}`,
    },
    {
      role: 'user',
      content: `<baseSchema>\n${schema}\n</baseSchema>`,
    },
    { role: 'user', content: lastUserMessage },
    { role: 'assistant', content: lastAssistantText },
    { role: 'user', content: FOLLOW_UP_PROMPT },
  ];
}

// ---------------------------------------------------------------------------
// Empty-state suggestion messages
// ---------------------------------------------------------------------------

export function buildSuggestionMessages(params: {
  schema: string;
  user: UserType;
  type?: SuggestionType;
  fileNames?: string[];
}): ModelMessage[] {
  const { schema, user, type, fileNames } = params;

  const systemPrompt = `You are a suggestions engine for NocoDB's AI Assistant. You suggest inputs that users can try to get the most value out of the assistant.

You must take the context of the user's base schema into account to create specific suggestions tailored to their base data. Each table includes sampleRecords with real data — use specific names, values, and dates from them.

Rules:
- Use real record names, field values, and dates from sampleRecords — never write generic suggestions.
- Do not reveal internal IDs. Do not wrap in JSON.
- If the base schema is empty (no tables), suggest building common starter projects — e.g. "Build a CRM to track leads and customers", "Create an inventory management system", "Set up a project tracker with tasks and milestones", "Build an event planning database". Make these actionable and varied.${NOCODB_AI_CONTEXT}`;

  const fileContext =
    fileNames?.length
      ? `\n\nThe user has uploaded the following files: ${fileNames.join(', ')}. \
Incorporate these files into your suggestions — suggest things like analyzing, summarizing, \
extracting data from, or comparing the uploaded files with base data. \
Reference the actual file names in your suggestions.`
      : '';

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `User: ${user.display_name || 'User'} (${
        user.email
      })\n\n<baseSchema>\n${schema}\n</baseSchema>${fileContext}`,
    },
    {
      role: 'user',
      content: promptBySuggestionType[type || SUGGESTION_TYPES.RECOMMENDED],
    },
  ];
}
