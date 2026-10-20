import { UITypes } from 'nocodb-sdk';
import { z } from 'zod-v4';
import type { NcContext } from '~/interface/config';
import { Model } from '~/models';
import { columnBuilder } from '~/utils/api-v3-data-transformation.builder';
import { typedFieldDefault } from '~/mcp/tools/field-defaults';

const SYSTEM_AUDIT_TYPES = new Set<string>([
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
]);

export const includeSystemSchema = z
  .boolean()
  .optional()
  .describe(
    'Also return the system CreatedAt, UpdatedAt, CreatedBy and UpdatedBy ' +
      'fields the table has, marked `system: true` — e.g. to sort or filter ' +
      'an interface page by them. Default false.',
  );

/**
 * The v3 table read drops system columns. MCP callers asking for them get the
 * audit columns (created/updated at/by) appended — never link storage or other
 * housekeeping columns.
 */
export async function systemAuditFields(context: NcContext, tableId: string) {
  const model = await Model.get(context, tableId);
  if (!model) return [];

  return (await model.getColumns())
    .filter((c) => c.system && SYSTEM_AUDIT_TYPES.has(c.uidt))
    .map((c) =>
      typedFieldDefault({ ...columnBuilder().build(c), system: true }),
    );
}
