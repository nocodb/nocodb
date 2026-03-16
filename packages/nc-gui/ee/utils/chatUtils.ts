/**
 * Extract the most useful inline argument from a tool's input to display
 * as a compact label next to the tool name.
 *
 * Shared between ToolCall.vue and ActionChip.vue.
 */
export function extractKeyArg(input: Record<string, unknown> | undefined | null): string | null {
  if (!input || typeof input !== 'object') return null
  if (input.table_name) return input.table_name as string
  if (input.title) return input.title as string
  const firstStr = Object.values(input).find((v) => typeof v === 'string' && (v as string).length < 40)
  return (firstStr as string) || null
}
