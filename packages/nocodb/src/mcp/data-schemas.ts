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

// `getRecord` documented a CSV string and `queryRecords` an array, for the same
// parameter. `getAst` has always accepted either, so both tools take both.
// Trimming matters because `getAst`'s `split(',')` does not, and V3 sets
// `throwErrorIfInvalidParams` — so "Title, Amount" used to 400 on ' Amount'.
export const fieldsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((f) =>
    (Array.isArray(f) ? f : f.split(',')).map((s) => s.trim()).filter(Boolean),
  )
  .describe(
    'Fields to return — an array of field names, or a comma-separated list. Linked-record fields returned with this option omit their display values.',
  );

export const viewIdSchema = z
  .string()
  .optional()
  .describe(
    'Optional view ID to use view-specific configurations — the view filters, ' +
      'sorts and field visibility are applied. Obtain one from getTableSchema.',
  );
