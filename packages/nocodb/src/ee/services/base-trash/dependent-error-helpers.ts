import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';
import {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';

const logger = new Logger('TrashDependentErrorHelpers');

export interface Dependent {
  id: string;
  type: string;
}

/**
 * Clear the `error` on each recorded dependent only if all its referenced
 * columns are alive in the current state. If any referenced column is still
 * soft-deleted the error is left in place, so the dependent stays flagged
 * until the last missing reference is restored.
 *
 * Guards against: L depends on A + B; trashing A then B both record L as a
 * dependent. Restoring A alone would otherwise blindly clear L's error even
 * though B is still trashed.
 */
export async function clearDependentErrorsIfResolved(
  ctx: NcContext,
  dependents: Dependent[],
): Promise<void> {
  for (const dep of dependents) {
    try {
      const stillBroken = await dependentStillBroken(ctx, dep);
      if (stillBroken) continue;

      switch (dep.type) {
        case 'lookup':
          await LookupColumn.update(ctx, dep.id, { error: null });
          break;
        case 'rollup':
          await RollupColumn.update(ctx, dep.id, { error: null });
          break;
        case 'qrcode':
          await QrCodeColumn.update(ctx, dep.id, { error: null });
          break;
        case 'barcode':
          await BarcodeColumn.update(ctx, dep.id, { error: null });
          break;
        case 'formula':
          await FormulaColumn.update(ctx, dep.id, { error: null } as any);
          break;
        case 'button':
          await ButtonColumn.update(ctx, dep.id, { error: null } as any);
          break;
      }
    } catch (e) {
      logger.error(
        `Failed to clear error on dependent ${dep.id}: ${e.message}`,
        e.stack,
      );
    }
  }
}

/** True if any column the dependent references is still soft-deleted. */
async function dependentStillBroken(
  ctx: NcContext,
  dep: Dependent,
): Promise<boolean> {
  const col = await Column.get(ctx, { colId: dep.id });
  if (!col) return false;

  const refIsTrashed = async (colId?: string | null) => {
    if (!colId) return false;
    const ref = await Column.get(ctx, { colId, includeDeleted: true });
    return !!ref?.deleted;
  };

  switch (dep.type) {
    case 'lookup': {
      const opt = await col.getColOptions<LookupColumn>(ctx);
      return (
        (await refIsTrashed(opt?.fk_relation_column_id)) ||
        (await refIsTrashed(opt?.fk_lookup_column_id))
      );
    }
    case 'rollup': {
      const opt = await col.getColOptions<RollupColumn>(ctx);
      return (
        (await refIsTrashed(opt?.fk_relation_column_id)) ||
        (await refIsTrashed(opt?.fk_rollup_column_id))
      );
    }
    case 'qrcode': {
      const opt = await col.getColOptions<QrCodeColumn>(ctx);
      return await refIsTrashed(opt?.fk_qr_value_column_id);
    }
    case 'barcode': {
      const opt = await col.getColOptions<BarcodeColumn>(ctx);
      return await refIsTrashed(opt?.fk_barcode_value_column_id);
    }
    case 'formula':
    case 'button': {
      // Walk the formula against every currently-soft-deleted column in the
      // same table. If any is still referenced → dependent is still broken.
      const opts =
        dep.type === 'formula'
          ? await col.getColOptions<FormulaColumn>(ctx)
          : await col.getColOptions<ButtonColumn>(ctx);
      if (!opts) return false;
      if (dep.type === 'button' && (opts as ButtonColumn).type !== 'url') {
        return false;
      }
      const hasFormula = !!(opts as FormulaColumn | ButtonColumn).formula;
      if (!hasFormula) return false;

      const siblings = await Column.list(ctx, {
        fk_model_id: col.fk_model_id,
        includeDeleted: true,
      });
      const stillTrashed = siblings.filter((c) => c.deleted);
      for (const other of stillTrashed) {
        // Probe against a fresh copy — addFormulaErrorIfMissingColumn mutates.
        const probe = {
          ...(opts as any),
          error: '',
        } as FormulaColumn | ButtonColumn;
        const modified = addFormulaErrorIfMissingColumn({
          formula: probe,
          columnId: other.id,
          title: other.title,
        });
        if (modified) return true;
      }
      return false;
    }
  }
  return false;
}
