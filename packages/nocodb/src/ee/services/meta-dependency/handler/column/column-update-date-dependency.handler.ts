import { Injectable } from '@nestjs/common';
import { isLinksOrLTAR, MetaEventType, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Column, DateDependency } from '~/models';
import Noco from '~/Noco';

/**
 * Valid UITypes per date dependency field.
 * When a column's type changes to something outside this set the
 * reference is no longer valid and must be cleared.
 */
const VALID_TYPES: Record<string, Set<UITypes>> = {
  fk_start_date_field_id: new Set([UITypes.Date]),
  fk_end_date_field_id: new Set([UITypes.Date]),
  fk_duration_field_id: new Set([UITypes.Duration, UITypes.Number]),
  // linkrow validation is structural (HM self-ref) — a uidt change away
  // from Links/LTAR always invalidates it
};

/**
 * @class ColumnUpdateDateDependencyHandler
 * @description When a column's type (uidt) changes, checks whether any date
 * dependency rule references that column. If the new type is incompatible
 * with the field slot the column occupies, the reference is nullified and
 * the rule is deactivated when appropriate.
 */
@Injectable()
export class ColumnUpdateDateDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    // Only care about type changes
    if (oldCol.uidt === newCol.uidt) return undefined;

    const isUsed = await DateDependency.isColumnUsed(
      context,
      oldCol.id,
      ncMeta as any,
    );

    if (!isUsed) return undefined;

    // Iterate ALL rules referencing this column — both the table-level
    // default and any per-Gantt-view rules can hold the column in one of
    // their slots. `getByModelId` only returns the table-level default
    // (post-Gantt-PR semantic), so using it here would silently miss
    // view-owned references; the user could retype a column that the
    // Gantt view still depends on and the FK would survive the dance.
    const rules = await DateDependency.listByModelId(
      context,
      oldCol.fk_model_id,
      ncMeta as any,
    );
    if (!rules?.length) return undefined;

    const checkSlot = async (key: string): Promise<boolean> => {
      if (key === 'fk_dependency_linkrow_field_id') {
        if (!isLinksOrLTAR(newCol)) return true;
        const col = await Column.get(context, { colId: newCol.id }, ncMeta);
        if (col) {
          const colOptions = await col.getColOptions<any>(context, ncMeta);
          if (
            !colOptions ||
            !['hm', 'om', 'oo'].includes(colOptions.type) ||
            colOptions.fk_related_model_id !== col.fk_model_id
          ) {
            return true;
          }
        }
        return false;
      }
      const validSet = VALID_TYPES[key];
      return !!validSet && !validSet.has(newCol.uidt);
    };

    for (const rule of rules) {
      const fieldSlots: Array<{ key: string; colId: string | null }> = [
        { key: 'fk_start_date_field_id', colId: rule.fk_start_date_field_id },
        { key: 'fk_end_date_field_id', colId: rule.fk_end_date_field_id },
        { key: 'fk_duration_field_id', colId: rule.fk_duration_field_id },
        {
          key: 'fk_dependency_linkrow_field_id',
          colId: rule.fk_dependency_linkrow_field_id,
        },
      ];

      for (const { key, colId } of fieldSlots) {
        if (colId !== oldCol.id) continue;
        if (await checkSlot(key)) {
          return { columns: [oldCol] };
        }
      }
    }

    return undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const columnId = param.oldEntity?.id;
    if (!columnId) return;

    await DateDependency.clearColumnRef(context, columnId, ncMeta as any);
  }
}
