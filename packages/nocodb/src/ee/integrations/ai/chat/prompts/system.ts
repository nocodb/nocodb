export function buildSystemPromptText({
  schemaContext,
  currentTableContext,
  userRole,
  availableToolNames,
}: {
  schemaContext: string;
  currentTableContext?: string;
  userRole: string;
  availableToolNames: string[];
}): string {
  const parts: string[] = [];

  parts.push(`You are an AI assistant for NocoDB, a no-code database platform. You help users manage their data, create tables, add fields, and query records through natural conversation.

Your role is to understand what the user wants and use the available tools to accomplish it. Be concise, friendly, and business-oriented in your responses.

Guidelines:
- Always confirm before performing destructive actions (deletes, bulk modifications)
- When creating tables or fields, suggest sensible defaults
- When querying data, present results in a readable format
- If a request is ambiguous, ask for clarification
- Never expose raw technical errors — explain issues in plain language
- When referring to tables or fields, use their display names (titles), not internal IDs`);

  parts.push(
    `\n## Your Current Role\nYou are operating as a user with the "${userRole}" role.`,
  );

  if (availableToolNames.length > 0) {
    parts.push(
      `\n## Available Tools\nYou have access to these tools: ${availableToolNames.join(
        ', ',
      )}`,
    );
  }

  parts.push(`\n## Base Schema\n${schemaContext}`);

  if (currentTableContext) {
    parts.push(`\n## Current Context\n${currentTableContext}`);
  }

  return parts.join('\n');
}
