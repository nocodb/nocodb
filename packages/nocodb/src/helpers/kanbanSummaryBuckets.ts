import {
  getKanbanStackType,
  isKanbanJunctionLink,
  KanbanStackType,
  parseProp,
} from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn } from '~/models';

export { KANBAN_SUMMARY_COLUMN_KEY } from 'nocodb-sdk';

/**
 * What a viewer needs to format a hidden summary field's totals — its values
 * never leave the server, only the field's name and display settings.
 */
export function kanbanSummaryColumnInfo(column: Column) {
  return {
    id: column.id,
    title: column.title,
    uidt: column.uidt,
    meta: parseProp(column.meta),
  };
}

/**
 * Foreign key column a link stack groups by (a link column's own filters
 * compare the related display value, not the record id), or undefined for
 * select and user stacks.
 */
export async function getKanbanStackFkColumnId(
  column: Column,
): Promise<string | undefined> {
  const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();
  if (getKanbanStackType({ ...column, colOptions }) !== KanbanStackType.Link)
    return undefined;
  return colOptions?.fk_child_column_id;
}

/** Whether a stack column is a link kept in a junction table (no foreign key). */
export async function isKanbanJunctionStack(column: Column): Promise<boolean> {
  const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();
  return isKanbanJunctionLink({ ...column, colOptions });
}

/**
 * Server-built stack buckets for a Kanban summary over a field the viewer
 * can't see. The board sends `(Stack,gb_eq,Value)` / `(Stack,gb_null)` per
 * stack, `(FkId,eq,Id)` / `(FkId,null)` on the foreign key of a link stack, or
 * `(Link.Id,eq,Id)` / `(Link,blank)` for a junction link; anything else is
 * dropped, and the value becomes a literal filter
 * value — so a viewer can't splice extra conditions into a bucket and
 * narrow a hidden total down to one record.
 */
export function buildKanbanStackBuckets(
  entries: unknown,
  stackColumn: { id: string; title: string },
  fkColumnId?: string,
  junction = false,
): Array<{ alias: string; filterArrJson: string }> {
  if (!Array.isArray(entries)) return [];

  const columnId = fkColumnId ?? stackColumn.id;
  const eqOp = fkColumnId || junction ? 'eq' : 'gb_eq';
  const nullOp = fkColumnId ? 'null' : junction ? 'blank' : 'gb_null';
  const ref = fkColumnId ?? stackColumn.title;
  const eqPrefix = `(${ref}${junction ? '.Id' : ''},${eqOp},`;
  const nullWhere = `(${ref},${nullOp})`;
  const buckets: Array<{ alias: string; filterArrJson: string }> = [];

  for (const entry of entries) {
    const alias = entry?.alias;
    const where = entry?.where;
    if (typeof alias !== 'string' || !alias || alias.length > 255) continue;
    if (typeof where !== 'string') continue;

    let filter: Record<string, unknown> | null = null;
    if (where === nullWhere) {
      filter = { fk_column_id: columnId, comparison_op: nullOp };
    } else if (where.startsWith(eqPrefix) && where.endsWith(')')) {
      filter = {
        fk_column_id: columnId,
        comparison_op: eqOp,
        value: where.slice(eqPrefix.length, -1),
        ...(junction ? { meta: { ltarSubField: 'Id' } } : {}),
      };
    }

    if (filter)
      buckets.push({ alias, filterArrJson: JSON.stringify([filter]) });
  }

  return buckets;
}
