import { Injectable, Logger } from '@nestjs/common';
import {
  AuditV1OperationTypes,
  isLinksOrLTAR,
  NcBaseErrorv2,
  NcErrorType,
  serializeDecimalValue,
  serializeDurationValue,
  serializeIntValue,
  UITypes,
} from 'nocodb-sdk';
import type { Job } from 'bull';
import type {
  ColumnType,
  FileImportOptions,
  FileImportSheet,
  FileImportType,
  NcRequest,
  UserType,
} from 'nocodb-sdk';
import type { DataImportJobData } from '~/interface/Jobs';
import type { NcContext } from '~/interface/config';
import { getCheckboxValue } from '~/modules/jobs/jobs/data-import/csv-type-detector';
import { describeRowError } from '~/modules/jobs/jobs/data-import/error-formatter';
import {
  deleteImportAttachment,
  openImportAttachmentStream,
} from '~/modules/jobs/jobs/data-import/attachment-stream';
import { getImportHandler } from '~/modules/jobs/jobs/data-import/handlers';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { Audit, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { generateAuditV1Payload } from '~/utils/audit';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { processConcurrently } from '~/utils';
import {
  getLtarDisplayValueContext,
  resolveLtarDisplayValuesToPks,
} from '~/helpers/ltarDisplayValueResolver';

const BATCH_SIZE = 1000;
const MAX_ERROR_SAMPLES = 1000;
const MAX_SYSTEM_ERRORS = 20;
/** Distinct display values resolved per related-table lookup query. */
const LINK_RESOLVE_CHUNK = 200;
/** Parent rows linked in parallel during the link phase. */
const LINK_CONCURRENCY = 25;
/** Default delimiter for multiple display values in one LTAR cell. */
const DEFAULT_LINK_DELIMITER = ',';

/** Row-level errors are retried one-by-one; everything else fails the batch. */
const ROW_LEVEL_ERRORS = new Set<NcErrorType>([
  NcErrorType.ERR_DUPLICATE_RECORD,
  NcErrorType.FIELD_UNIQUE_CONSTRAINT_VIOLATION,
  NcErrorType.ERR_INVALID_VALUE_FOR_FIELD,
  NcErrorType.ERR_INVALID_JSON,
  NcErrorType.ERR_INVALID_ATTACHMENT_JSON,
]);

interface ColumnMapEntry {
  destCn: string;
  uidt: string;
  col: ColumnType;
}

/** A source column mapped to a link (LTAR) destination column. */
interface LtarColMapEntry {
  colId: string;
  delimiter: string;
}

/** One inserted parent row's pk + the display values to link for a column. */
interface LinkAccumEntry {
  pk: string | number;
  values: string[];
}

/** Split an LTAR cell into trimmed, non-empty display values. */
function splitDisplayValues(raw: any, delimiter: string): string[] {
  if (raw === null || raw === undefined) return [];
  return String(raw)
    .split(delimiter)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** Coerce a raw imported value into the type expected by the destination column. */
function coerceValue(raw: any, mapping: ColumnMapEntry): any {
  const value = raw === '' || raw === undefined || raw === null ? null : raw;

  switch (mapping.uidt) {
    case UITypes.Checkbox:
      return getCheckboxValue(value);

    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      return (value ?? '').toString().trim() || null;

    case UITypes.Decimal:
    case UITypes.Percent:
      return serializeDecimalValue(value, undefined, { col: mapping.col });

    case UITypes.Number:
    case UITypes.Rating:
      return serializeIntValue(value, { col: mapping.col });

    case UITypes.Duration:
      return value === null
        ? null
        : serializeDurationValue(value as string, mapping.col);

    default:
      return value;
  }
}

interface SheetResult {
  sheetName?: string;
  tableId: string;
  tableName: string;
  rowsInserted: number;
  rowsFailed: number;
  /** Record links created during the link phase. */
  linksCreated: number;
  /** Display values that matched no related record (skipped). */
  valuesUnmatched: number;
  errors: Array<{ row: number; error: string }>;
}

@Injectable()
export class DataImportProcessor {
  private readonly logger = new Logger(DataImportProcessor.name);

  constructor(
    private readonly tablesService: TablesService,
    private readonly bulkDataService: BulkDataAliasService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  async job(job: Job<DataImportJobData>) {
    const hrTime = initTime();
    const data = job.data;
    const { attachment, importType, sheets, options, user } = data;

    const log = (msg: string, verbose = false) => {
      this.jobsLogService.sendLog(job, { message: msg });
      if (verbose) this.logger.debug(msg);
      else this.logger.log(msg);
    };

    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);
    const req: NcRequest = {
      user: { id: user?.id, email: user?.email },
      clientIp: data.req?.clientIp,
      ncBaseId: data.baseId,
      ncSourceId: data.sourceId,
      ncParentAuditId: parentAuditId,
    } as NcRequest;

    let auditTableNames: string;
    if (options.importDataOnly) {
      const resolved = await Promise.all(
        sheets
          .map((s) => s.tableId)
          .filter((id): id is string => Boolean(id))
          .map((id) => Model.get(data.context, id)),
      );
      auditTableNames = resolved
        .filter(Boolean)
        .map((m) => m!.title)
        .join(', ');
    } else {
      auditTableNames = sheets
        .map((s) => s.tableName)
        .filter(Boolean)
        .join(', ');
    }

    await Audit.insert(
      await generateAuditV1Payload(AuditV1OperationTypes.DATA_IMPORT, {
        context: data.context,
        details: {
          file_name: attachment.title || `${importType}-import`,
          import_type: importType,
          import_data_only: options.importDataOnly,
          table_name: auditTableNames,
          columns_count: sheets.reduce(
            (sum, s) => sum + (s.columns?.length ?? 0),
            0,
          ),
          sheets_count: sheets.length > 1 ? sheets.length : undefined,
        },
        req,
        id: parentAuditId,
      }),
    );

    log(`Starting ${importType.toUpperCase()} import...`, true);

    const results: SheetResult[] = [];

    try {
      for (const spec of sheets) {
        results.push(
          await this.importSheet({
            context: data.context,
            importType,
            spec,
            options,
            attachment,
            parserConfig: data.parserConfig,
            user,
            baseId: data.baseId,
            sourceId: data.sourceId,
            req,
            log,
          }),
        );
      }

      const rowsInserted = results.reduce((s, r) => s + r.rowsInserted, 0);
      const rowsFailed = results.reduce((s, r) => s + r.rowsFailed, 0);
      const linksCreated = results.reduce((s, r) => s + r.linksCreated, 0);
      const valuesUnmatched = results.reduce(
        (s, r) => s + r.valuesUnmatched,
        0,
      );
      const errorsCount = results.reduce((s, r) => s + r.errors.length, 0);
      const sampleError = results
        .flatMap((r) => r.errors)
        .find((e) => e?.error)?.error;

      elapsedTime(
        hrTime,
        `${importType.toUpperCase()} import completed for ${
          results.length
        } table(s)`,
        'fileImport',
      );
      log(
        JSON.stringify({
          status: 'completed',
          rowsInserted,
          rowsFailed,
          linksCreated,
          valuesUnmatched,
          errorsCount,
          ...(sampleError ? { sampleError } : {}),
        }),
        true,
      );
      log(
        `Import completed: ${rowsInserted} rows inserted, ${rowsFailed} failed` +
          (linksCreated || valuesUnmatched
            ? `, ${linksCreated} links created, ${valuesUnmatched} unmatched.`
            : '.'),
        true,
      );

      return { rowsInserted, rowsFailed, linksCreated, sheets: results };
    } catch (e) {
      this.logger.error(
        `${importType.toUpperCase()} import failed: ${e.message}`,
        e.stack,
      );
      log('Import failed due to an internal error.', true);

      // NcError messages are user-safe; other errors (knex, etc.) may leak
      // schema details — fall back to a generic message.
      const safeMessage =
        e instanceof NcBaseErrorv2
          ? e.message
          : 'Import failed. Please check the file format and try again.';

      const err = new Error(safeMessage) as Error & { data: unknown };
      err.data = { sheets: results };
      if (e?.stack) err.stack = e.stack;
      throw err;
    } finally {
      try {
        await deleteImportAttachment(attachment);
      } catch (e) {
        this.logger.warn(`Failed to cleanup temp file: ${e.message}`);
      }
    }
  }

  /** Create-or-lookup the table, build the column map, then stream rows in. */
  private async importSheet(params: {
    context: NcContext;
    baseId: string;
    sourceId: string;
    importType: FileImportType;
    attachment: DataImportJobData['attachment'];
    parserConfig: DataImportJobData['parserConfig'];
    options: FileImportOptions;
    spec: FileImportSheet;
    user: Partial<UserType>;
    req: NcRequest;
    log: (msg: string, verbose?: boolean) => void;
  }): Promise<SheetResult> {
    const {
      context,
      baseId,
      sourceId,
      importType,
      attachment,
      parserConfig,
      options,
      spec,
      user,
      req,
      log,
    } = params;
    const sheetLabel = spec.sheetName ? ` "${spec.sheetName}"` : '';

    // ── Resolve target table (create or look up)
    let tableId = spec.tableId;
    let tableName = spec.tableName;

    if (!options.importDataOnly) {
      log(`Creating table "${tableName}"...`, true);

      const source = await Source.get(context, sourceId);
      if (!source) NcError.sourceNotFound(sourceId);

      const created = await this.tablesService.tableCreate(context, {
        baseId,
        sourceId,
        table: {
          table_name: tableName,
          title: tableName,
          columns: (spec.columns ?? []).map((col) => ({
            title: col.title,
            column_name: col.column_name,
            uidt: col.uidt as UITypes,
            dtxp: col.dtxp,
            meta: col.meta,
          })),
        },
        user: user as UserType,
        req,
      });

      tableId = created.id;
      tableName = created.title;
      log(`Table "${tableName}" created successfully.`, true);
    }

    if (!tableId) NcError.badRequest('Table ID could not be determined');

    const model = await Model.get(context, tableId);
    if (!model) NcError.tableNotFound(tableId);
    if (!tableName) tableName = model.title;
    await model.getColumns(context);

    // ── Build source-col → dest-col map
    const tableColumns = model.columns as any[];
    const findDest = (name: string) =>
      tableColumns.find((c) => c.column_name === name || c.title === name);

    const colMap: Record<string, ColumnMapEntry> = {};
    // Link (LTAR) destinations are handled in a separate post-insert phase —
    // their cells hold display values to resolve, not scalar data to insert.
    const ltarColMap: Record<string, LtarColMapEntry> = {};

    const classifyDest = (
      srcColName: string,
      dest: any,
      delimiter?: string,
    ) => {
      if (isLinksOrLTAR(dest)) {
        ltarColMap[srcColName] = {
          colId: dest.id,
          delimiter: delimiter || DEFAULT_LINK_DELIMITER,
        };
      } else {
        colMap[srcColName] = {
          destCn: dest.column_name,
          uidt: dest.uidt,
          col: dest,
        };
      }
    };

    if (options.importDataOnly && spec.columnMapping) {
      // Explicit user mapping wins — disabled/renamed entries are respected.
      for (const m of spec.columnMapping) {
        if (!m.enabled) continue;
        const src = (spec.columns ?? []).find(
          (c) => c.column_name === m.sourceCn || c.title === m.sourceCn,
        );
        const dest = findDest(m.destCn);
        if (src && dest) {
          classifyDest(src.column_name, dest, m.linkConfig?.delimiter);
        }
      }
    } else {
      for (const col of spec.columns ?? []) {
        const dest = findDest(col.column_name) ?? findDest(col.title);
        if (dest) classifyDest(col.column_name, dest);
      }
    }

    if (
      Object.keys(colMap).length === 0 &&
      Object.keys(ltarColMap).length === 0
    ) {
      NcError.badRequest(
        'No valid column mappings found. Please check your column configuration.',
      );
    }

    if (!options.shouldImportData) {
      log(`Sheet${sheetLabel}: schema only, no data imported.`, true);
      return {
        sheetName: spec.sheetName,
        tableId,
        tableName: tableName as string,
        rowsInserted: 0,
        rowsFailed: 0,
        linksCreated: 0,
        valuesUnmatched: 0,
        errors: [],
      };
    }

    log(
      spec.sheetName
        ? `Importing sheet "${spec.sheetName}" → "${tableName}"...`
        : 'Importing data...',
      true,
    );

    const stats = await this.streamSheetData({
      context,
      baseId,
      importType,
      attachment,
      parserConfig,
      options,
      spec,
      tableId,
      tableName: tableName as string,
      model,
      colMap,
      ltarColMap,
      req,
      log,
    });

    log(
      `Sheet${sheetLabel}: ${stats.rowsInserted} rows inserted, ${stats.rowsFailed} failed` +
        (stats.linksCreated || stats.valuesUnmatched
          ? `, ${stats.linksCreated} links created, ${stats.valuesUnmatched} unmatched.`
          : '.'),
      true,
    );

    return {
      sheetName: spec.sheetName,
      tableId,
      tableName: tableName as string,
      rowsInserted: stats.rowsInserted,
      rowsFailed: stats.rowsFailed,
      linksCreated: stats.linksCreated,
      valuesUnmatched: stats.valuesUnmatched,
      errors: stats.errors.slice(0, 100),
    };
  }

  /**
   * Stream rows from the handler, coerce types, batch into bulk inserts. On
   * batch failure: retry row-by-row for known row-level errors; bail after
   * too many system-level failures.
   */
  private async streamSheetData(params: {
    context: NcContext;
    baseId: string;
    importType: FileImportType;
    attachment: DataImportJobData['attachment'];
    parserConfig: DataImportJobData['parserConfig'];
    options: FileImportOptions;
    spec: FileImportSheet;
    tableId: string;
    tableName: string;
    model: Model;
    colMap: Record<string, ColumnMapEntry>;
    ltarColMap: Record<string, LtarColMapEntry>;
    req: NcRequest;
    log: (msg: string, verbose?: boolean) => void;
  }) {
    const {
      context,
      baseId,
      importType,
      attachment,
      parserConfig,
      options,
      spec,
      tableId,
      tableName,
      model,
      colMap,
      ltarColMap,
      req,
      log,
    } = params;

    const readStream = await openImportAttachmentStream(
      importType,
      attachment,
      parserConfig.encoding,
    );
    const handler = getImportHandler(importType);

    const stats = {
      rowsInserted: 0,
      rowsFailed: 0,
      linksCreated: 0,
      valuesUnmatched: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };
    let batch: Record<string, any>[] = [];
    let processedRows = 0;
    let systemErrorCount = 0;

    // Link phase bookkeeping: per LTAR column id → inserted rows' pk + the
    // display values to link. Only rows with at least one link value are kept.
    const ltarSrcCols = Object.keys(ltarColMap);
    const hasLtar = ltarSrcCols.length > 0;
    const linkAccum = new Map<string, LinkAccumEntry[]>();
    // Parallel to `batch`: each entry is the row's [colId, values][] or null.
    let batchLtar: Array<Array<[string, string[]]> | null> = [];

    const accumulateRow = (
      pk: string | number,
      rowLtar: Array<[string, string[]]> | null,
    ) => {
      if (!rowLtar || pk === undefined || pk === null) return;
      for (const [colId, values] of rowLtar) {
        let arr = linkAccum.get(colId);
        if (!arr) {
          arr = [];
          linkAccum.set(colId, arr);
        }
        arr.push({ pk, values });
      }
    };

    const insert = (
      rows: Record<string, any>[],
      onInsertedPks?: (pks: (string | number)[]) => void,
    ) =>
      this.bulkDataService.bulkDataInsert(context, {
        baseName: baseId,
        tableName: tableId,
        body: rows,
        cookie: req,
        skip_hooks: true,
        raw: true,
        ...(options.typecast ? { typecast: 'true' } : {}),
        ...(onInsertedPks ? { onInsertedPks } : {}),
      });

    const progressKey = spec.tableName || tableName;

    const reportProgress = () =>
      log(
        JSON.stringify({
          status: 'progress',
          tableName: progressKey,
          sheetName: spec.sheetName,
          rowsInserted: stats.rowsInserted,
          rowsFailed: stats.rowsFailed,
          totalProcessed: processedRows,
        }),
        true,
      );

    const flush = async () => {
      if (!batch.length) return;
      const pending = batch;
      const pendingLtar = batchLtar;
      batch = [];
      batchLtar = [];

      try {
        let insertedPks: (string | number)[] = [];
        await insert(
          pending,
          hasLtar ? (pks) => (insertedPks = pks) : undefined,
        );
        stats.rowsInserted += pending.length;
        if (hasLtar) {
          // PG `returning` / mysql-sqlite one-by-one keep insertion order, so
          // insertedPks[i] corresponds to pending[i].
          for (let i = 0; i < pendingLtar.length; i++) {
            accumulateRow(insertedPks[i], pendingLtar[i]);
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Bulk insert failed for batch of ${pending.length} rows at row ~${processedRows}: ${err.message}`,
          err.stack,
        );

        const isRowLevel =
          err instanceof NcBaseErrorv2 && ROW_LEVEL_ERRORS.has(err.error);
        const batchStartRow = processedRows - pending.length + 1;
        if (!isRowLevel) {
          stats.rowsFailed += pending.length;
          // Surface the underlying message (DB constraint text, etc.) once
          // per batch so the UI has something concrete to show rather than
          // a generic placeholder.
          if (stats.errors.length < MAX_ERROR_SAMPLES) {
            stats.errors.push({
              row: batchStartRow,
              error: describeRowError(err),
            });
          }
          if (++systemErrorCount >= MAX_SYSTEM_ERRORS) throw err;
          return;
        }

        // Retry one-by-one so well-formed rows in the batch still make it in.
        for (let i = 0; i < pending.length; i++) {
          try {
            let rowPk: string | number | undefined;
            await insert(
              [pending[i]],
              hasLtar ? (pks) => (rowPk = pks[0]) : undefined,
            );
            stats.rowsInserted += 1;
            if (hasLtar && rowPk !== undefined) {
              accumulateRow(rowPk, pendingLtar[i]);
            }
          } catch (rowErr) {
            stats.rowsFailed += 1;
            if (stats.errors.length < MAX_ERROR_SAMPLES) {
              // Pass the row so the formatter can match an embedded value
              // (e.g. `numeric: "$500.00"`) back to its column name.
              stats.errors.push({
                row: batchStartRow + i,
                error: describeRowError(rowErr, pending[i]),
              });
            }
          }
        }
      }
    };

    for await (const sourceRow of handler.streamRows(
      readStream,
      parserConfig,
      spec.columns ?? [],
      spec.sheetName,
    )) {
      // Map source columns to dest columns + type coercion
      const dbRow: Record<string, any> = {};
      for (const [srcCol, mapping] of Object.entries(colMap)) {
        dbRow[mapping.destCn] = coerceValue(sourceRow[srcCol], mapping);
      }

      // Extract link display values for the post-insert link phase.
      let rowLtar: Array<[string, string[]]> | null = null;
      if (hasLtar) {
        for (const srcCol of ltarSrcCols) {
          const { colId, delimiter } = ltarColMap[srcCol];
          const values = splitDisplayValues(sourceRow[srcCol], delimiter);
          if (values.length) (rowLtar ??= []).push([colId, values]);
        }
      }

      batch.push(dbRow);
      batchLtar.push(rowLtar);
      processedRows++;
      if (batch.length >= BATCH_SIZE) {
        await flush();
        reportProgress();
      }
    }

    await flush();
    reportProgress();

    if (hasLtar && linkAccum.size) {
      log('Creating record links...', true);
      const linkStats = await this.processLinks({
        context,
        model,
        linkAccum,
        req,
        log,
      });
      stats.linksCreated = linkStats.linksCreated;
      stats.valuesUnmatched = linkStats.valuesUnmatched;
    }

    return stats;
  }

  /**
   * Link phase: for each LTAR column, resolve the captured display values to
   * related-record pks (case-insensitive, batched) and create the links via
   * `addLinks` (append-only — import never unlinks). Unmatched values are
   * skipped and counted; ambiguous values resolve to the first match;
   * single-link relations take only the first matched value.
   */
  private async processLinks(params: {
    context: NcContext;
    model: Model;
    linkAccum: Map<string, LinkAccumEntry[]>;
    req: NcRequest;
    log: (msg: string, verbose?: boolean) => void;
  }): Promise<{ linksCreated: number; valuesUnmatched: number }> {
    const { context, model, linkAccum, req, log } = params;

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    let linksCreated = 0;
    let valuesUnmatched = 0;

    for (const [colId, rows] of linkAccum) {
      const column = (model.columns as any[]).find((c) => c.id === colId);
      if (!column) continue;

      let groupCtx;
      try {
        groupCtx = await getLtarDisplayValueContext(context, column);
      } catch (e) {
        // No usable display value column etc. — skip, count intents as missed.
        this.logger.warn(
          `Skipping links for column "${column.title}": ${e.message}`,
        );
        for (const r of rows) valuesUnmatched += r.values.length;
        continue;
      }

      // Collect distinct display values and resolve them in bounded chunks so
      // a huge import doesn't build one giant OR query.
      const distinct = new Set<string>();
      for (const r of rows) for (const v of r.values) distinct.add(v);

      const valueToPk = new Map<string, string | number>();
      const distinctArr = [...distinct];
      for (let i = 0; i < distinctArr.length; i += LINK_RESOLVE_CHUNK) {
        const chunk = distinctArr.slice(i, i + LINK_RESOLVE_CHUNK);
        const resolved = await resolveLtarDisplayValuesToPks(groupCtx, chunk);
        for (const [k, v] of resolved) valueToPk.set(k, v);
      }

      await processConcurrently(
        rows,
        async (r) => {
          const seen = new Set<string>();
          const childIds: (string | number)[] = [];
          for (const v of r.values) {
            const pk = valueToPk.get(v);
            if (pk === undefined || pk === null) {
              valuesUnmatched += 1;
              continue;
            }
            const key = String(pk);
            if (seen.has(key)) continue;
            seen.add(key);
            childIds.push(pk);
          }
          if (!childIds.length) return;

          const finalChildIds = groupCtx.isSingleLink
            ? [childIds[0]]
            : childIds;
          try {
            await baseModel.addLinks({
              cookie: req,
              colId,
              rowId: String(r.pk),
              childIds: finalChildIds,
            });
            linksCreated += finalChildIds.length;
          } catch (e) {
            this.logger.warn(
              `Failed to link row ${r.pk} on "${column.title}": ${e.message}`,
            );
          }
        },
        LINK_CONCURRENCY,
      );

      log(
        `Column "${column.title}": ${linksCreated} links created so far` +
          (valuesUnmatched ? `, ${valuesUnmatched} unmatched.` : '.'),
        true,
      );
    }

    return { linksCreated, valuesUnmatched };
  }
}
