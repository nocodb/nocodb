import { Injectable } from '@nestjs/common';
import { isLinksOrLTAR, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '../../types';
import {
  BarcodeColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import { MetaTable } from '~/cli';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import Column from '~/models/Column';

interface AffectedColumn {
  fk_column_id: string;
  type: 'lookup' | 'rollup' | 'qrcode' | 'barcode';
  context: NcContext;
}

interface ColumnDeleteAffectedResult extends AffectedDependencyResult {
  _affectedColumns?: AffectedColumn[];
  _error?: string;
}

/**
 * When a column is deleted, mark dependent virtual columns (Lookup, Rollup, QR Code, Barcode)
 * with an error instead of cascade-deleting them. This preserves the column metadata for
 * potential restore (soft-delete / base trash).
 */
@Injectable()
export class ColumnDeleteDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<ColumnDeleteAffectedResult | undefined> {
    const deletedColumn = param.oldEntity;
    if (!deletedColumn?.id) return undefined;

    const id = deletedColumn.id;
    const error = `Field '${
      deletedColumn.title || deletedColumn.column_name
    }' was deleted`;
    const affectedColumns: AffectedColumn[] = [];

    // QR Codes referencing this column as their value source
    const qrCodeCols = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_QRCODE,
      { condition: { fk_qr_value_column_id: id } },
    );
    for (const col of qrCodeCols) {
      affectedColumns.push({
        fk_column_id: col.fk_column_id,
        type: 'qrcode',
        context,
      });
    }

    // Barcodes referencing this column as their value source
    const barcodeCols = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BARCODE,
      { condition: { fk_barcode_value_column_id: id } },
    );
    for (const col of barcodeCols) {
      affectedColumns.push({
        fk_column_id: col.fk_column_id,
        type: 'barcode',
        context,
      });
    }

    // Lookups referencing this column as their lookup target
    {
      const cachedList = await NocoCache.getList(
        context,
        CacheScope.COL_LOOKUP,
        [id],
      );
      let { list: lookups } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !lookups.length) {
        lookups = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COL_LOOKUP,
          { condition: { fk_lookup_column_id: id } },
        );
      }
      for (const lookup of lookups) {
        affectedColumns.push({
          fk_column_id: lookup.fk_column_id,
          type: 'lookup',
          context,
        });
      }
    }

    // Rollups referencing this column as their rollup target
    {
      const cachedList = await NocoCache.getList(
        context,
        CacheScope.COL_ROLLUP,
        [id],
      );
      let { list: rollups } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !rollups.length) {
        rollups = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COL_ROLLUP,
          { condition: { fk_rollup_column_id: id } },
        );
      }
      for (const rollup of rollups) {
        affectedColumns.push({
          fk_column_id: rollup.fk_column_id,
          type: 'rollup',
          context,
        });
      }
    }

    // If the deleted column is a link/LTAR, also find lookups/rollups referencing it as their relation
    if (isLinksOrLTAR(deletedColumn.uidt)) {
      {
        const cachedList = await NocoCache.getList(
          context,
          CacheScope.COL_LOOKUP,
          [id],
        );
        let { list: lookups } = cachedList;
        const { isNoneList } = cachedList;
        if (!isNoneList && !lookups.length) {
          lookups = await ncMeta.metaList2(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_LOOKUP,
            { condition: { fk_relation_column_id: id } },
          );
        }
        for (const lookup of lookups) {
          // Avoid duplicates (a lookup might reference both target and relation)
          if (
            !affectedColumns.some((a) => a.fk_column_id === lookup.fk_column_id)
          ) {
            affectedColumns.push({
              fk_column_id: lookup.fk_column_id,
              type: 'lookup',
              context,
            });
          }
        }
      }

      {
        const cachedList = await NocoCache.getList(
          context,
          CacheScope.COL_ROLLUP,
          [id],
        );
        let { list: rollups } = cachedList;
        const { isNoneList } = cachedList;
        if (!isNoneList && !rollups.length) {
          rollups = await ncMeta.metaList2(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_ROLLUP,
            { condition: { fk_relation_column_id: id } },
          );
        }
        for (const rollup of rollups) {
          if (
            !affectedColumns.some((a) => a.fk_column_id === rollup.fk_column_id)
          ) {
            affectedColumns.push({
              fk_column_id: rollup.fk_column_id,
              type: 'rollup',
              context,
            });
          }
        }
      }
    }

    // Cross-base lookups and rollups
    {
      const columns = await Column.list(context, {
        fk_model_id: deletedColumn.fk_model_id,
      });

      for (const column of columns) {
        if (!isLinksOrLTAR(column.uidt)) continue;

        const colOptions = await column.getColOptions<any>(context, ncMeta);

        if (
          !colOptions?.fk_related_base_id ||
          colOptions.fk_related_base_id === deletedColumn.base_id
        )
          continue;

        const crossBaseContext = {
          ...context,
          base_id: colOptions.fk_related_base_id,
        };

        const crossBaseLookups = await ncMeta.metaList2(
          context.workspace_id,
          colOptions.fk_related_base_id,
          MetaTable.COL_LOOKUP,
          { condition: { fk_lookup_column_id: id } },
        );
        for (const lookup of crossBaseLookups) {
          affectedColumns.push({
            fk_column_id: lookup.fk_column_id,
            type: 'lookup',
            context: crossBaseContext,
          });
        }

        const crossBaseRollups = await ncMeta.metaList2(
          context.workspace_id,
          colOptions.fk_related_base_id,
          MetaTable.COL_ROLLUP,
          { condition: { fk_rollup_column_id: id } },
        );
        for (const rollup of crossBaseRollups) {
          affectedColumns.push({
            fk_column_id: rollup.fk_column_id,
            type: 'rollup',
            context: crossBaseContext,
          });
        }
      }
    }

    if (affectedColumns.length === 0) return undefined;

    return {
      _affectedColumns: affectedColumns,
      _error: error,
    };
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: ColumnDeleteAffectedResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const { _affectedColumns, _error } = param.affectedDependencyResult;
    if (!_affectedColumns?.length || !_error) return;

    for (const affected of _affectedColumns) {
      const ctx = affected.context;

      switch (affected.type) {
        case 'lookup':
          await LookupColumn.update(
            ctx,
            affected.fk_column_id,
            { error: _error },
            ncMeta,
          );
          break;
        case 'rollup':
          await RollupColumn.update(
            ctx,
            affected.fk_column_id,
            { error: _error },
            ncMeta,
          );
          break;
        case 'qrcode':
          await QrCodeColumn.update(
            ctx,
            affected.fk_column_id,
            { error: _error },
            ncMeta,
          );
          break;
        case 'barcode':
          await BarcodeColumn.update(
            ctx,
            affected.fk_column_id,
            { error: _error },
            ncMeta,
          );
          break;
      }
    }
  }
}
