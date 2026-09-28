import { z } from 'zod';

export const sortSchema = z
  .array(
    z.object({
      field: z.string().describe('Field Name'),
      direction: z.enum(['asc', 'desc']).describe('Sort Direction'),
    }),
  )
  .describe(
    'Sort order, applied in array order, e.g. [{"field":"Amount","direction":"desc"}]',
  );

export type McpSort = z.infer<typeof sortSchema>;

// v3 documents `sort` as a JSON string. Passing the array through instead reaches
// the paged-response link builder, which renders every query value with String()
// — so `next`/`prev` come back carrying "[object Object]" and cannot be replayed.
export function serializeSort(sort: McpSort): string {
  return JSON.stringify(sort);
}
