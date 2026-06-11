import { customAlphabet } from 'nanoid';
import { AppEvents, EventType, RelationTypes, UITypes } from 'nocodb-sdk';
import type { ColumnReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  IColumnConversionHost,
  LtarSideEffectIds,
  ReusableParams,
} from '~/services/columns.service.type';
import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import { Column, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { _wherePk } from '~/helpers/dbHelpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NocoSocket from '~/socket/NocoSocket';
import { processConcurrently } from '~/utils/dataUtils';
import {
  getLtarDisplayValueContext,
  resolveLtarDisplayValuesToPks,
} from '~/helpers/ltarDisplayValueResolver';
import { captureForTrace } from '~/decorators/trace-command.decorator';
import { getReplay, isReplay, setReplay } from '~/helpers/replayScope';
import { ColumnDataBackupHandler } from '~/services/column-data-backup-handler.service';

// Hard cap on the number of rows a synchronous (in-request) text↔link
// conversion will process. Above this the per-row link read/write would risk
// a request timeout; reject with a clear error rather than start an op that
// can't finish. text→link counts only rows whose source cell has a value (the
// rows it actually links); link→text counts all rows (it reads every row's
// links). (A background-job path can lift this later.)
const LTAR_CONVERSION_MAX_ROWS = 5_000;

// Lowercase alphanumeric — safe inside a PG identifier when concatenated. Gives
// the freshly-created column a temporary, clash-free title until it's renamed
// to the source column's title at the end of the conversion.
const tempTitleSuffix = customAlphabet(
  'abcdefghijklmnopqrstuvwxyz0123456789',
  8,
);

/**
 * Text ↔ link (LTAR) column conversion plus its undo/redo inverses, extracted
 * from `ColumnsService` following the `baseModelInsert` factory pattern
 * (`db/BaseModelSqlv2/insert.ts`): a factory that receives the service as its
 * host (`svc`) and returns the conversion operations as closures. The service
 * keeps thin public methods that delegate here.
 */
export const ltarColumnConversion = (svc: IColumnConversionHost) => {
  /**
   * Emit the final, authoritative `COLUMN_UPDATE` audit event + meta socket
   * broadcast for a completed column type-conversion. The forward path does
   * this inline in `columnUpdate`; the undo/redo inverses
   * ({@link revertTextColumnToLink} / {@link revertLinkColumnToText}) call this
   * so the frontend (which refreshes purely from realtime events) replaces the
   * transient temp-named column from `createLTARColumn`/`columnAdd` with the
   * final renamed column + its data. Best-effort — the schema change is already
   * committed, so a notification failure must not abort the op.
   */
  const broadcastColumnConversion = async (
    context: NcContext,
    param: {
      tableId: string;
      columnId: string;
      oldColumn?: Column;
      req: NcRequest;
    },
  ) => {
    try {
      const freshTable = await Model.get(context, param.tableId);
      if (!freshTable) return;
      await freshTable.getColumns(context);
      const column = await Column.get(context, { colId: param.columnId });
      if (!column) return;

      // The new relation can make the loaded column graph circular — build a
      // serialization-safe clone for the wire payloads.
      const seen = new WeakSet();
      const safeTable = JSON.parse(
        JSON.stringify(freshTable, (_k, v) => {
          if (v && typeof v === 'object') {
            if (seen.has(v)) return undefined;
            seen.add(v);
          }
          return v;
        }),
      );
      // The column itself carries the same circular relation graph; broadcast
      // the already-safe clone from `safeTable.columns`, not the raw instance,
      // or serializing the socket payload blows the stack (e.g. restoring a
      // junction-less hm/bt pair on undo).
      const safeColumn =
        (safeTable.columns as Array<{ id?: string }> | undefined)?.find(
          (c) => c.id === param.columnId,
        ) ?? safeTable.columns?.[0];

      svc.appHooksService.emit(AppEvents.COLUMN_UPDATE, {
        table: freshTable,
        oldColumn: param.oldColumn ?? column,
        column,
        columnId: param.columnId,
        req: param.req,
        context,
        columns: safeTable.columns,
      });
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'column_update',
            payload: { table: safeTable, column: safeColumn },
          },
        },
        context.socket_id,
      );
    } catch (e) {
      svc.logger.warn(
        `column conversion notification failed for ${param.columnId}: ${
          (e as Error).message
        }`,
      );
    }
  };

  /**
   * Guard a synchronous text↔link conversion against oversized tables. The
   * conversion does per-row link reads/writes in the request thread; above
   * {@link LTAR_CONVERSION_MAX_ROWS} that risks a request timeout, so reject up
   * front with a clear message. Skipped under replay (undo/redo/sandbox merge):
   * those must always complete, and the forward already enforced the cap so the
   * table can't have grown past it through the conversion.
   *
   * `sourceColumn` scopes the count to the rows the op actually touches:
   *  - text→link: pass the source text column → count only rows whose cell has
   *    a value (the rows that get linked), not the whole table.
   *  - link→text: omit it → count all rows (every row's links are read).
   */
  const assertConvertibleRowCount = async (
    context: NcContext,
    baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>,
    sourceColumn?: Column,
  ): Promise<void> => {
    if (isReplay()) return;
    // text→link only counts rows with a non-blank source cell (the rows it
    // links); link→text counts the whole table. `notblank` excludes both null
    // and empty string, matching the conversion's own per-row value filter.
    const filterArr = sourceColumn
      ? [
          new Filter({
            fk_column_id: sourceColumn.id,
            comparison_op: 'notblank',
          } as Filter),
        ]
      : undefined;
    const rowCount = Number(await baseModel.count({ filterArr }, true));
    if (Number.isFinite(rowCount) && rowCount > LTAR_CONVERSION_MAX_ROWS) {
      NcError.get(context).badRequest(
        `Cannot convert: this conversion would process ${rowCount.toLocaleString()} ` +
          `records, which exceeds the ${LTAR_CONVERSION_MAX_ROWS.toLocaleString()}-` +
          `record limit for converting between text and link fields.`,
      );
    }
  };

  /**
   * Convert a SingleLineText column into a link (LTAR) field.
   *
   * Flow: snapshot the existing text per row → create the LTAR column (with a
   * temporary title so it doesn't clash with the source column) → backfill
   * links by resolving each row's cell text to related records → drop the
   * source text column → rename the LTAR to the source column's title/order
   * so the field "becomes" the link.
   *
   * Backfill is append-only, runs synchronously (matching other column ops),
   * skips unmatched values, and for single-link relations takes the first
   * match. `colBody.meta.delimiter` (default ',') splits multi-value cells.
   *
   * Undo/redo: recorded under the `columnUpdate` op, which backs up the text
   * column's data + captures the link side-effect ids. Undo dispatches
   * `columnRevertLinkToText` ({@link revertLinkColumnToText}); redo re-runs this
   * conversion honoring the captured ids.
   */
  const convertSingleLineTextToLtar = async (
    context: NcContext,
    param: {
      column: Column;
      colBody: Column & { meta?: Record<string, any> };
      table: Model;
      source: Source;
      user: UserType;
      req: NcRequest;
      reuse?: ReusableParams;
      /**
       * Set only when undoing a junction-less `bt`→text conversion. The forward
       * dropped the whole hm/bt pair; here we recreate it from the `hm`
       * perspective (so `createHmAndBtColumn` rebuilds the right relationship),
       * but the user-facing column to restore is the *reverse* (`bt`) column,
       * not the saved (`hm`) one. So: rename the reverse column to the user
       * title + give the saved column its own captured title, and backfill the
       * links onto the reverse (`bt`) column. Defaults off — every other caller
       * keeps the original single-column rename/backfill behavior.
       */
      reverseRestore?: {
        reverseColumnId: string;
        savedColumnTitle: string;
        reverseColumnTitle: string;
      };
    },
  ) => {
    const { column, colBody, table, source, user, req } = param;

    const originalTitle = column.title;
    const delimiter = (colBody.meta?.delimiter as string) || ',';

    // Build local handles for the snapshot read. Do NOT share these (or the
    // caller's `reuse`) with createLTARColumn/columnDelete below — passing
    // mutated Model/baseModel instances through their `reuse` pollutes the meta
    // cache and breaks `hash(columns)` in a later `Model.get`. Each sub-op gets
    // a fresh reuse, exactly like a standalone columnAdd/columnDelete.
    const base = await source.getProject(context);
    const dbDriver = await NcConnectionMgrv2.get(source);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: table.id,
      dbDriver,
    });

    // Cap the synchronous conversion at a manageable size — only on the real
    // forward request (undo/redo/sandbox replay must always finish, and the
    // forward already enforced the cap). text→link only links rows that have a
    // value, so count those rows, not the whole table.
    await assertConvertibleRowCount(context, baseModel, column);

    await table.getColumns(context);
    const pkTitles = table.primaryKeys.map((pk) => pk.title);

    // Snapshot (pk, text) for every row that has a value, before any schema
    // change. Paged to keep memory bounded on large tables.
    const snapshot: { pk: string | number; text: string }[] = [];
    const PAGE = 1000;
    let offset = 0;
    for (;;) {
      const page = await baseModel.list(
        {
          fieldsSet: new Set([...pkTitles, column.title]),
          limit: PAGE,
          offset,
        },
        { ignoreViewFilterAndSort: true },
      );
      if (!page.length) break;
      for (const row of page) {
        const text = row[column.title];
        if (text === null || text === undefined || String(text).trim() === '') {
          continue;
        }
        snapshot.push({
          pk: baseModel.extractPksValues(row, true),
          text: String(text),
        });
      }
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    // Snapshot the source text column (incl. id) so undo can recreate it, and
    // back up its cell data so undo can restore the values.
    const textColumnSnapshot: Record<string, any> = {
      id: column.id,
      fk_model_id: column.fk_model_id,
      column_name: column.column_name,
      title: column.title,
      uidt: column.uidt,
      dt: column.dt,
      dtxp: column.dtxp,
      dtxs: column.dtxs,
      np: (column as any).np,
      ns: (column as any).ns,
      clen: (column as any).clen,
      ct: (column as any).ct,
      cdf: (column as any).cdf,
      rqd: (column as any).rqd,
      un: (column as any).un,
      meta: column.meta,
      order: column.order,
    };
    let dataBackup: ColumnBackupRef | undefined;
    try {
      dataBackup = await svc.columnDataBackupHandler.backup(context, {
        sourceColumn: column,
        backupUid: ColumnDataBackupHandler.newBackupUid(),
        forUndo: !!getReplay('replayBackup'),
      });
      captureForTrace('backup', dataBackup);
      setReplay('columnBackupOut', dataBackup);
    } catch (e) {
      svc.logger.warn(
        `Text→link backup failed for ${column.id}: ${
          (e as Error).message
        }. Conversion will proceed without undo support.`,
      );
    }

    // Under replay (redo / sandbox merge), reuse the originally-created link
    // ids so later ops that reference them stay valid. The handler deposits
    // these into the replay scope before calling this service.
    const replayLinkColumnId = isReplay()
      ? (getReplay('convertedLinkId') as string | undefined)
      : undefined;

    // Create the LTAR column with a temporary title to avoid clashing with the
    // still-present source column. `colBody` carries the relationship config
    // (parentId/childId/type) from the field-edit modal, but it is the SOURCE
    // text column's body — strip its identity (id / column_name / fk_model_id /
    // colOptions / order) so a fresh LTAR column is created instead of trying
    // to reuse the source column's id.
    const tempTitle = `${originalTitle}_link_${tempTitleSuffix()}`;
    const {
      id: _id,
      column_name: _columnName,
      fk_model_id: _fkModelId,
      fk_column_id: _fkColumnId,
      colOptions: _colOptions,
      order: _order,
      ...ltarRest
    } = colBody as Record<string, any>;
    const ltarReq = {
      ...ltarRest,
      title: tempTitle,
      ...(replayLinkColumnId ? { id: replayLinkColumnId } : {}),
    };
    const ltarCapture: LtarSideEffectIds = {};
    const ltarColumn = await svc.createLTARColumn(context, {
      tableId: table.id,
      column: ltarReq as unknown as ColumnReqType,
      source,
      base,
      user,
      req,
      reuse: {},
      _ltarCapture: ltarCapture,
    });
    captureForTrace('ltar', ltarCapture);
    captureForTrace('convertedLink', {
      linkColumnId: ltarColumn.id,
      textColumn: textColumnSnapshot,
    });

    // Drop the source text column and rename the LTAR to the original title
    // BEFORE backfilling. The schema steps recompute the parent model's
    // columnsHash; running them before the link backfill keeps that hash off
    // the meta cache state that the backfill's record reads/links churn (which
    // can transiently leave lazy-loaded promises on cached models and crash
    // object-hash). Use the simple-update path (title only) — a full
    // `Column.update` would re-process the LTAR relationship.
    await svc.columnDelete(
      context,
      // Hard-delete (skipTrash): undo recreates the text column with this same
      // id, so the meta row must be gone — its data is preserved via the
      // backup, not trash.
      { columnId: column.id, skipTrash: true, req, reuse: {} },
      svc.metaService,
    );

    if (param.reverseRestore) {
      // hm/bt pair restore: `ltarColumn` is the saved (hm) column — keep its
      // own captured title; the reverse (bt) column reclaims the user-facing
      // title (the text column's slot it's replacing).
      await Column.update2(context, {
        colId: ltarColumn.id,
        column: { title: param.reverseRestore.savedColumnTitle },
        isSimpleUpdate: true,
      });
      await Column.update2(context, {
        colId: param.reverseRestore.reverseColumnId,
        column: { title: param.reverseRestore.reverseColumnTitle },
        isSimpleUpdate: true,
      });
    } else {
      await Column.update2(context, {
        colId: ltarColumn.id,
        column: { title: originalTitle },
        isSimpleUpdate: true,
      });
    }

    // Backfill links from the snapshot (runs last — no more columnsHash in this
    // flow after this point). In the hm/bt pair-restore case the snapshot is
    // keyed by the bt-side rows, so links must be applied to the reverse (bt)
    // column, not the saved (hm) one.
    const backfillColumn = param.reverseRestore
      ? (await Column.get(context, {
          colId: param.reverseRestore.reverseColumnId,
        })) ?? ltarColumn
      : ltarColumn;
    const linkStats = await backfillLtarFromText(context, {
      baseModel,
      ltarColumn: backfillColumn,
      snapshot,
      delimiter,
      req,
    });
    svc.logger.log(
      `Converted "${originalTitle}" to link: ${linkStats.linksCreated} links created, ${linkStats.valuesUnmatched} unmatched.`,
    );

    return ltarColumn.id;
  };

  /**
   * Resolve the snapshot's display values to related-record pks and create the
   * links via `addLinks` (append-only). Returns counts for logging.
   */
  const backfillLtarFromText = async (
    context: NcContext,
    params: {
      baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>;
      ltarColumn: Column;
      snapshot: { pk: string | number; text: string }[];
      delimiter: string;
      req: NcRequest;
    },
  ): Promise<{ linksCreated: number; valuesUnmatched: number }> => {
    const { baseModel, ltarColumn, snapshot, delimiter, req } = params;
    if (!snapshot.length) return { linksCreated: 0, valuesUnmatched: 0 };

    const groupCtx = await getLtarDisplayValueContext(context, ltarColumn);

    const perRow = snapshot.map(({ pk, text }) => {
      const values = String(text)
        .split(delimiter)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      return { pk, values };
    });

    const distinct = new Set<string>();
    for (const r of perRow) for (const v of r.values) distinct.add(v);

    const valueToPk = new Map<string, string | number>();
    const distinctArr = [...distinct];
    const RESOLVE_CHUNK = 200;
    for (let i = 0; i < distinctArr.length; i += RESOLVE_CHUNK) {
      const resolved = await resolveLtarDisplayValuesToPks(
        groupCtx,
        distinctArr.slice(i, i + RESOLVE_CHUNK),
      );
      for (const [k, v] of resolved) valueToPk.set(k, v);
    }

    let linksCreated = 0;
    let valuesUnmatched = 0;
    // Apply links with bounded concurrency instead of one sequential await per
    // row — a large table would otherwise serialize N `addLinks` round-trips.
    // Mirrors the data-import link phase. The counters are mutated only in
    // synchronous (post-await) statements, so single-threaded JS keeps them
    // race-free; each `pk` is distinct so concurrent writes never collide.
    await processConcurrently(perRow, async ({ pk, values }) => {
      const seen = new Set<string>();
      const childIds: (string | number)[] = [];
      for (const v of values) {
        const matched = valueToPk.get(v);
        if (matched === undefined || matched === null) {
          valuesUnmatched += 1;
          continue;
        }
        const key = String(matched);
        if (seen.has(key)) continue;
        seen.add(key);
        childIds.push(matched);
      }
      if (!childIds.length) return;

      const finalChildIds = groupCtx.isSingleLink ? [childIds[0]] : childIds;
      try {
        await baseModel.addLinks({
          cookie: req,
          colId: ltarColumn.id,
          rowId: String(pk),
          childIds: finalChildIds,
        });
        linksCreated += finalChildIds.length;
      } catch (e) {
        svc.logger.warn(
          `Failed to link row ${pk} during text→link conversion: ${
            (e as Error).message
          }`,
        );
      }
    });

    return { linksCreated, valuesUnmatched };
  };

  /**
   * Inverse of {@link convertSingleLineTextToLtar}: drop the link column
   * (cascades its junction / back-link / FK columns and link rows), recreate
   * the original SingleLineText column with its original id, and restore the
   * backed-up cell data. Runs under the undo/redo replay scope, so the
   * recreated column's pre-set id is honored.
   */
  const revertLinkColumnToText = async (
    context: NcContext,
    param: {
      linkColumnId: string;
      textColumn: Record<string, any>;
      backupRef?: ColumnBackupRef;
      req: NcRequest;
    },
  ) => {
    const { linkColumnId, textColumn, backupRef, req } = param;
    const tableId = textColumn.fk_model_id as string;

    // 1. Drop the link column — cascades junction model, FK + back-link
    //    columns, and all link rows. Hard-delete so redo can recreate the link
    //    (and its junction/back-links) with the same ids. Skip the link
    //    placeholder: the original was a plain text column with no relationship,
    //    so a placeholder on the related table would be spurious (and gets a
    //    fresh id on every replay).
    await svc.columnDelete(
      context,
      {
        columnId: linkColumnId,
        skipTrash: true,
        skipLinkPlaceholder: true,
        req,
        reuse: {},
      },
      svc.metaService,
    );

    // 2. Recreate the text column with its original id (honored under replay).
    const recreateReq: Record<string, any> = {
      id: textColumn.id,
      column_name: textColumn.column_name,
      title: textColumn.title,
      uidt: textColumn.uidt ?? UITypes.SingleLineText,
      dt: textColumn.dt,
      dtxp: textColumn.dtxp,
      dtxs: textColumn.dtxs,
      np: textColumn.np,
      ns: textColumn.ns,
      clen: textColumn.clen,
      ct: textColumn.ct,
      cdf: textColumn.cdf,
      rqd: textColumn.rqd,
      un: textColumn.un,
      meta: textColumn.meta,
      ...(textColumn.order != null
        ? { column_order: { order: textColumn.order } }
        : {}),
    };
    await svc.columnAdd(context, {
      tableId,
      column: recreateReq as unknown as ColumnReqType,
      user: req.user as UserType,
      req,
      reuse: {},
    });

    // 3. Restore the cell data from the backup.
    if (backupRef) {
      const recreated = await Column.get(context, { colId: textColumn.id });
      if (recreated) {
        await svc.columnDataBackupHandler.restore(context, {
          destinationColumn: recreated,
          backupRef,
        });
      }
    }

    // Tell the frontend (which refreshes from realtime events only) the final
    // recreated text column, replacing the transient one from columnAdd.
    await broadcastColumnConversion(context, {
      tableId,
      columnId: textColumn.id,
      req,
    });

    return Column.get(context, { colId: textColumn.id });
  };

  /**
   * Convert a link (LTAR) column into a SingleLineText column: each row's
   * linked records' display values are joined (delimiter, default ',') into
   * the new text column, then the link column is dropped and the text column
   * takes its title. The inverse (undo) recreates the link and re-links by
   * resolving those display values — see {@link convertSingleLineTextToLtar}.
   */
  const convertLtarToSingleLineText = async (
    context: NcContext,
    param: {
      column: Column;
      colBody: Column & { meta?: Record<string, any> };
      table: Model;
      source: Source;
      user: UserType;
      req: NcRequest;
    },
  ) => {
    const { column, colBody, table, source, user, req } = param;
    const originalTitle = column.title;
    const delimiter = (colBody.meta?.delimiter as string) || ',';

    const dbDriver = await NcConnectionMgrv2.get(source);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: table.id,
      dbDriver,
    });

    // Cap the synchronous conversion at a manageable table size (forward only).
    await assertConvertibleRowCount(context, baseModel);

    // Display-value column of the related records (custom override or PV).
    const groupCtx = await getLtarDisplayValueContext(context, column);
    const dvTitle = groupCtx.displayValueColumn.title;
    const relType = groupCtx.colOptions.type as RelationTypes;

    await table.getColumns(context);
    // Read ALL pk columns — composite-pk tables need every part so
    // `extractPksValues` builds the full `a___b` key the WHERE clause matches.
    const pkTitles = table.primaryKeys.map((pk) => pk.title);

    // V2 links (om/mo/mm and V2 oo) are junction-backed; V1 links (hm/bt) are
    // FK-based. The correct reader depends on that split, not on the relation
    // type alone — so resolve it once and branch on it below.
    const hasJunction = !!(groupCtx.colOptions as { fk_mm_model_id?: string })
      .fk_mm_model_id;

    const readLinked = async (pk: string | number): Promise<any[]> => {
      const dvSet = new Set([dvTitle]);
      // Multi-target links (mm / hm / om): many linked records per row.
      if (
        relType === RelationTypes.MANY_TO_MANY ||
        relType === RelationTypes.HAS_MANY ||
        relType === RelationTypes.ONE_TO_MANY
      ) {
        // Junction-backed (mm + every V2 link, incl. om) → `mmList`. Only the
        // V1 FK-based `hm` reads via `hmList`: routing a junction-backed `om`
        // there finds no local FK, so it reads the wrong rows and emits the
        // parent row's own display value instead of the children's.
        if (hasJunction) {
          return (
            (await baseModel.mmList(
              { colId: column.id, parentId: pk },
              { fieldsSet: dvSet },
              true,
            )) || []
          );
        }
        return (
          (await baseModel.hmList(
            { colId: column.id, id: pk },
            { fieldSet: dvSet },
            true, // selectAllRecords — read every child, no 25-row cap
          )) || []
        );
      }
      // bt / mo / oo — single linked record. V2 links (mo, V2 oo, and any
      // single-target link backed by a junction) resolve through `mmRead`.
      if (hasJunction) {
        const rec = await baseModel.mmRead(
          { colId: column.id, parentId: pk },
          { fieldsSet: dvSet },
        );
        return rec ? (Array.isArray(rec) ? rec : [rec]) : [];
      }
      // Junction-less V1 link. `mmRead` returns null here (no mm model), which
      // would silently empty the column. The read depends on which side holds
      // the FK:
      //  - FK side (`bt`, or the bt-flagged `oo` reverse) → `btRead`.
      //  - has-one side (`oo` primary, no FK on its own table) → `hmList`;
      //    `btRead` would read the wrong row (it assumes the FK is local).
      const colMeta =
        typeof column.meta === 'string'
          ? (() => {
              try {
                return JSON.parse(column.meta as unknown as string);
              } catch {
                return {};
              }
            })()
          : (column.meta as Record<string, any> | undefined) ?? {};
      const isFkSide =
        relType === RelationTypes.BELONGS_TO ||
        (relType === RelationTypes.ONE_TO_ONE && !!colMeta?.bt);
      if (isFkSide) {
        const rec = await baseModel.btRead(
          { colId: column.id, id: pk },
          { fieldSet: dvSet },
        );
        return rec ? (Array.isArray(rec) ? rec : [rec]) : [];
      }
      return (
        (await baseModel.hmList(
          { colId: column.id, id: pk },
          { fieldSet: dvSet },
          true, // selectAllRecords — read every child, no 25-row cap
        )) || []
      );
    };

    // Read each row's linked records and join their display values.
    const rows: { pk: string | number; text: string }[] = [];
    const PAGE = 500;
    let offset = 0;
    for (;;) {
      const page = await baseModel.list(
        {
          fieldsSet: new Set(pkTitles.filter(Boolean) as string[]),
          limit: PAGE,
          offset,
        },
        { ignoreViewFilterAndSort: true },
      );
      if (!page.length) break;
      // Resolve each row's linked records with bounded concurrency — one
      // sequential `readLinked` per row would serialize N read round-trips on
      // a large table.
      const pageRows = await processConcurrently(page, async (row) => {
        const pk = baseModel.extractPksValues(row, true);
        const linked = await readLinked(pk);
        if (!linked.length) return null;
        const text = linked
          .map((r) => (r == null ? null : r[dvTitle]))
          .filter((v) => v !== null && v !== undefined && String(v).length > 0)
          .join(delimiter);
        return text.length ? { pk, text } : null;
      });
      for (const r of pageRows) if (r) rows.push(r);
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    // Create the text column with a temp title (avoid clash with the link col).
    // Under replay (redo / sandbox merge) reuse the originally-created text
    // column id so later ops referencing it stay valid; the handler deposits
    // it into the replay scope before calling this service.
    const replayTextColumnId = isReplay()
      ? (getReplay('convertedTextId') as string | undefined)
      : undefined;
    const tempTitle = `${originalTitle}_text_${tempTitleSuffix()}`;
    await svc.columnAdd(context, {
      tableId: table.id,
      column: {
        uidt: UITypes.SingleLineText,
        title: tempTitle,
        ...(replayTextColumnId ? { id: replayTextColumnId } : {}),
      } as unknown as ColumnReqType,
      user,
      req,
      reuse: {},
    });
    const textColumn = (
      await Column.list(context, { fk_model_id: table.id })
    ).find((c) => c.title === tempTitle);
    if (!textColumn) {
      NcError.get(context).badRequest('Failed to create text column');
    }

    // Capture the new text column id so redo / sandbox replay recreates it
    // with the same id (undo rebuilds the link from this column's joined text).
    captureForTrace('convertedText', { textColumnId: textColumn.id });

    // Populate the text column with the joined display values (direct per-row
    // update — unambiguous about pk vs value, unlike the bulk CASE builder).
    if (rows.length && table.primaryKeys.length) {
      const tnPath = baseModel.getTnPath(table.table_name);
      // Bounded-concurrent per-row updates instead of one sequential await per
      // row; each row targets a distinct pk so the writes don't collide.
      await processConcurrently(rows, async (r) => {
        // Route through execAndParse, not a bare builder await: for mux/external
        // sources `baseModel.dbDriver` is a pool-less local knex that ships SQL
        // to the executor. Awaiting the builder directly hits the (nonexistent)
        // local pool and throws "Unable to acquire a connection". Mirrors every
        // other write here (addLinks) and in add-remove-links.ts.
        await baseModel.execAndParse(
          baseModel
            .dbDriver(tnPath)
            .update({ [textColumn.column_name]: r.text })
            // composite-pk safe — `_wherePk` splits the `a___b` key `r.pk`
            // back into per-column conditions (single-pk passes through).
            .where(_wherePk(table.primaryKeys, r.pk)),
          null,
          { raw: true },
        );
      });
    }

    // Drop the link column (skipTrash so undo can recreate it with the same
    // id), then rename the text column to the original title. Skip the link
    // placeholder — the conversion intentionally drops the relationship, and a
    // placeholder text column left on the related table would get a fresh id on
    // every replay (breaking id-preservation) and pollute the related table.
    await svc.columnDelete(
      context,
      {
        columnId: column.id,
        skipTrash: true,
        skipLinkPlaceholder: true,
        req,
        reuse: {},
      },
      svc.metaService,
    );
    await Column.update2(context, {
      colId: textColumn.id,
      column: { title: originalTitle },
      isSimpleUpdate: true,
    });

    svc.logger.log(
      `Converted link "${originalTitle}" to text: ${rows.length} rows populated.`,
    );

    return textColumn.id;
  };

  /**
   * Inverse of {@link convertLtarToSingleLineText}: drop the text column the
   * forward conversion created, recreate the original link column (reusing its
   * id), and re-link each row by resolving the joined display values back to
   * related records. Delegates to {@link convertSingleLineTextToLtar}, which
   * already drops the source text column, recreates the link (honoring the
   * pre-set id under replay), and backfills the links. Runs under the
   * undo/redo replay scope.
   */
  const revertTextColumnToLink = async (
    context: NcContext,
    param: {
      textColumnId: string;
      link: {
        id: string;
        fk_model_id: string;
        title?: string;
        uidt?: string;
        type?: string;
        parentId?: string;
        childId?: string;
        ref_base_id?: string | null;
        fk_target_view_id?: string | null;
        fk_display_value_column_id?: string | null;
        meta?: Record<string, any> | string | null;
        pairedColumnId?: string;
        pairedColumnTitle?: string;
      };
      req: NcRequest;
    },
  ) => {
    const { textColumnId, link, req } = param;

    const textColumn = await Column.get(context, { colId: textColumnId });
    if (!textColumn) {
      NcError.get(context).genericNotFound('Column', textColumnId);
    }

    const table = await Model.get(context, textColumn.fk_model_id);
    if (!table) {
      NcError.get(context).tableNotFound(textColumn.fk_model_id);
    }
    const source = await Source.get(context, table.source_id);

    // A junction-less `bt` is the reverse half of an hm/bt pair, and converting
    // it dropped BOTH columns. Recreate the pair from the `hm` perspective so
    // `createHmAndBtColumn` rebuilds the correct relationship, then map the
    // original ids onto the right columns:
    //   hm (saved column)   ← link.pairedColumnId  (via `convertedLinkId`)
    //   bt (reverse column) ← link.id              (via `ltarReplayIds.reverseColumnId`)
    // `link.parentId`/`childId` were captured from the bt's perspective
    // (parentId = bt's own table, childId = the related/parent table), so swap
    // them: the hm lives on the related table, the bt on its own table.
    const pairedHmColumnId = link.pairedColumnId;
    if (link.type === 'bt' && pairedHmColumnId) {
      setReplay('convertedLinkId', pairedHmColumnId);
      setReplay('ltarReplayIds', {
        ...(getReplay('ltarReplayIds') ?? {}),
        reverseColumnId: link.id,
      });

      const hmColBody = {
        uidt: UITypes.LinkToAnotherRecord,
        type: RelationTypes.HAS_MANY,
        parentId: link.childId, // hm lives on the related (parent) table
        childId: link.parentId, // bt lives on its own table
        title: link.pairedColumnTitle ?? textColumn.title,
        ...(link.ref_base_id ? { ref_base_id: link.ref_base_id } : {}),
        ...(link.meta ? { meta: link.meta } : {}),
      };

      await convertSingleLineTextToLtar(context, {
        column: textColumn,
        colBody: hmColBody as unknown as Column & {
          meta?: Record<string, any>;
        },
        table,
        source,
        user: req.user as UserType,
        req,
        reverseRestore: {
          reverseColumnId: link.id,
          savedColumnTitle: link.pairedColumnTitle ?? textColumn.title,
          reverseColumnTitle: link.title ?? textColumn.title,
        },
      });

      await broadcastColumnConversion(context, {
        tableId: table.id,
        columnId: link.id,
        req,
      });

      return Column.get(context, { colId: link.id });
    }

    // Reuse the original link column id when recreating it (honored by
    // `convertSingleLineTextToLtar` via `getReplay('convertedLinkId')`).
    if (link.id) setReplay('convertedLinkId', link.id);

    const colBody = {
      uidt: link.uidt ?? UITypes.LinkToAnotherRecord,
      title: link.title ?? textColumn.title,
      parentId: link.parentId ?? link.fk_model_id,
      childId: link.childId,
      type: link.type,
      ...(link.ref_base_id ? { ref_base_id: link.ref_base_id } : {}),
      ...(link.fk_target_view_id
        ? { fk_target_view_id: link.fk_target_view_id }
        : {}),
      ...(link.fk_display_value_column_id
        ? { fk_display_value_column_id: link.fk_display_value_column_id }
        : {}),
      ...(link.meta ? { meta: link.meta } : {}),
    };

    await convertSingleLineTextToLtar(context, {
      column: textColumn,
      colBody: colBody as unknown as Column & { meta?: Record<string, any> },
      table,
      source,
      user: req.user as UserType,
      req,
    });

    // Tell the frontend (which refreshes from realtime events only) the final
    // recreated link column, replacing the transient temp-named one that
    // `createLTARColumn` broadcast mid-conversion.
    await broadcastColumnConversion(context, {
      tableId: table.id,
      columnId: link.id,
      req,
    });

    return Column.get(context, { colId: link.id });
  };

  return {
    convertSingleLineTextToLtar,
    convertLtarToSingleLineText,
    revertLinkColumnToText,
    revertTextColumnToLink,
  };
};
