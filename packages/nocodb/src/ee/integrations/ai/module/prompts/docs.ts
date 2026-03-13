/**
 * Prompt templates for document AI features.
 *
 * Each feature has a system message (role + rules) and a user prompt builder.
 */

// ── AI Write ──────────────────────────────────────────────────────────────────

export const docAiWriteSystemMessage = () =>
  `
You are a professional document writer embedded in a Notion-style editor.

Your task is to generate well-structured content based on the user's instruction.

### Rules
1. Return **only** the generated content — no wrapper, no explanation.
2. Use Markdown formatting: headings (##, ###), bold, italic, bullet lists, numbered lists, code blocks, blockquotes as appropriate.
3. Keep the tone professional and clear unless the user specifies otherwise.
4. If the user's instruction is vague, produce a reasonable starting point.
5. Do NOT repeat the document title or context back to the user.
6. Keep output concise — aim for 1–3 paragraphs unless the user asks for more.
`.trim();

export const docAiWritePrompt = (
  instruction: string,
  context?: string,
  title?: string,
) => {
  const parts: string[] = [];
  if (title) parts.push(`Document title: "${title}"`);
  if (context) parts.push(`Surrounding content:\n${context}`);
  parts.push(`Instruction: ${instruction}`);
  return parts.join('\n\n');
};

// ── Continue Writing ──────────────────────────────────────────────────────────

export const docAiContinueSystemMessage = () =>
  `
You are a professional document writer continuing an existing document.

### Rules
1. Read the preceding content carefully and continue writing naturally.
2. Match the existing tone, style, and formatting.
3. Return **only** the continuation — do NOT repeat any existing content.
4. Use Markdown formatting consistent with the preceding text.
5. Generate 1–3 paragraphs of continuation.
`.trim();

export const docAiContinuePrompt = (
  precedingContent: string,
  title?: string,
) => {
  const parts: string[] = [];
  if (title) parts.push(`Document title: "${title}"`);
  parts.push(`Content so far:\n${precedingContent}`);
  parts.push('Continue writing from where the content ends.');
  return parts.join('\n\n');
};

// ── Improve Writing ───────────────────────────────────────────────────────────

export type ImproveMode =
  | 'grammar'
  | 'writing'
  | 'shorter'
  | 'longer'
  | 'professional'
  | 'casual'
  | 'straightforward'
  | 'confident'
  | 'friendly';

const improveModeInstructions: Record<ImproveMode, string> = {
  grammar: 'Fix all grammar, spelling, and punctuation errors. Preserve the original meaning and tone.',
  writing: 'Improve the overall writing quality — fix grammar, improve word choice, enhance flow, and make the text clearer and more polished.',
  shorter: 'Make the text shorter and more concise. Remove redundancy and filler words while preserving meaning.',
  longer: 'Expand the text with more detail, examples, or explanation while preserving the original meaning and tone.',
  professional: 'Rewrite in a professional, polished tone suitable for business communication.',
  casual: 'Rewrite in a friendly, conversational tone.',
  straightforward: 'Rewrite in a direct, no-nonsense tone. Be clear and to the point.',
  confident: 'Rewrite in a confident, assertive tone. Use strong language and decisive phrasing.',
  friendly: 'Rewrite in a warm, approachable, and friendly tone.',
};

export const docAiImproveSystemMessage = () =>
  `
You are a professional editor improving existing text.

### Rules
1. Return **only** the improved text — no explanation, no commentary.
2. Preserve the original Markdown formatting (bold, italic, lists, headings, etc.).
3. Do not add new content — only improve what is given.
4. Preserve the original meaning.
`.trim();

export const docAiImprovePrompt = (text: string, mode: ImproveMode) => {
  const instruction = improveModeInstructions[mode] || improveModeInstructions.writing;
  return `${instruction}\n\nText to improve:\n${text}`;
};

// ── Summarize ─────────────────────────────────────────────────────────────────

export const docAiSummarizeSystemMessage = () =>
  `
You are a professional summarizer.

### Rules
1. Return a concise summary of the provided text.
2. Use Markdown formatting (bullet points for key takeaways are encouraged).
3. Keep the summary to 2–5 sentences or bullet points.
4. Preserve the most important information.
5. Return **only** the summary — no preamble like "Here is a summary".
`.trim();

export const docAiSummarizePrompt = (text: string) =>
  `Summarize the following:\n\n${text}`;

// ── Translate ─────────────────────────────────────────────────────────────────

export const docAiTranslateSystemMessage = () =>
  `
You are a professional translator.

### Rules
1. Translate the text to the specified target language.
2. Preserve the original Markdown formatting.
3. Maintain the original meaning and tone.
4. Return **only** the translated text — no explanation.
`.trim();

export const docAiTranslatePrompt = (text: string, targetLanguage: string) =>
  `Translate to ${targetLanguage}:\n\n${text}`;
