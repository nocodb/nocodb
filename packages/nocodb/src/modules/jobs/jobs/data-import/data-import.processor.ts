import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'papaparse';
import {
  AuditV1OperationTypes,
  NcBaseErrorv2,
  NcErrorType,
  UITypes,
} from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcRequest, UserType } from 'nocodb-sdk';
import type { DataImportJobData } from '~/interface/Jobs';
import type { NcContext } from '~/interface/config';
import type IStorageAdapterV2 from '~/types/nc-plugin/lib/IStorageAdapterV2';
import { getCheckboxValue } from '~/modules/jobs/jobs/data-import/csv-type-detector';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { resolveAttachmentFilePath } from '~/helpers/attachmentHelpers';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { Audit, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { generateAuditV1Payload } from '~/utils/audit';

const BATCH_SIZE = 1000;

@Injectable()
export class DataImportProcessor {
  private logger = new Logger(DataImportProcessor.name);

  constructor(
    private readonly tablesService: TablesService,
    private readonly bulkDataService: BulkDataAliasService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  async job(job: Job<DataImportJobData>) {
    const hrTime = initTime();
    const {
      context,
      baseId,
      sourceId,
      tableId: existingTableId,
      tableName,
      attachment,
      columns,
      parserConfig,
      options,
      columnMapping,
      user,
      req: reqData,
    } = job.data;

    const logBasic = (msg: string) => {
      this.jobsLogService.sendLog(job, { message: msg });
      this.logger.log(msg);
    };

    const logDetailed = (msg: string) => {
      this.jobsLogService.sendLog(job, { message: msg });
      this.logger.debug(msg);
    };

    // Create parent audit entry for this import
    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

    const req = {
      user: { id: user?.id, email: user?.email },
      clientIp: reqData?.clientIp,
      ncBaseId: baseId,
      ncSourceId: sourceId,
      ncParentAuditId: parentAuditId,
    } as NcRequest;

    let tableId = existingTableId;
    let finalTableName = tableName;

    try {
      // Insert parent audit log
      await Audit.insert(
        await generateAuditV1Payload(AuditV1OperationTypes.DATA_IMPORT, {
          context,
          details: {
            file_name: attachment.title || 'csv-import',
            import_type: 'csv',
            import_data_only: options.importDataOnly,
            table_name: tableName,
            columns_count: columns.length,
          },
          req,
          id: parentAuditId,
        }),
      );

      logBasic('Starting CSV import...');

      if (!options.importDataOnly) {
        logBasic(`Creating table "${tableName}"...`);

        const source = await Source.get(context, sourceId);
        if (!source) NcError.sourceNotFound(sourceId);

        const tableCreateResult = await this.tablesService.tableCreate(
          context,
          {
            baseId,
            sourceId,
            table: {
              table_name: tableName,
              title: tableName,
              columns: columns.map((col) => ({
                title: col.title,
                column_name: col.column_name,
                uidt: col.uidt as UITypes,
                dtxp: col.dtxp,
                meta: col.meta,
              })),
            },
            user: user as UserType,
            req,
          },
        );

        tableId = tableCreateResult.id;
        finalTableName = tableCreateResult.title;
        logBasic(`Table "${finalTableName}" created successfully.`);
      }

      if (!tableId) {
        NcError.badRequest('Table ID could not be determined');
      }

      // Get table model for column mapping
      const model = await Model.get(context, tableId);
      if (!model) NcError.tableNotFound(tableId);

      await model.getColumns(context);

      // Build column map: source column key -> target DB column name
      const colMap: Record<number, { destCn: string; uidt: string }> = {};

      if (options.importDataOnly && columnMapping) {
        for (const mapping of columnMapping) {
          if (!mapping.enabled) continue;
          const srcCol = columns.find(
            (c) =>
              c.column_name === mapping.sourceCn ||
              c.title === mapping.sourceCn,
          );
          if (srcCol) {
            const destCol = model.columns.find(
              (c) =>
                c.column_name === mapping.destCn || c.title === mapping.destCn,
            );
            if (destCol) {
              colMap[srcCol.key] = {
                destCn: destCol.column_name,
                uidt: destCol.uidt as string,
              };
            }
          }
        }
      } else {
        for (const col of columns) {
          const dbCol = model.columns.find(
            (c) => c.column_name === col.column_name || c.title === col.title,
          );
          if (dbCol) {
            colMap[col.key] = {
              destCn: dbCol.column_name,
              uidt: dbCol.uidt as string,
            };
          }
        }
      }

      if (Object.keys(colMap).length === 0) {
        NcError.badRequest(
          'No valid column mappings found. Please check your column configuration.',
        );
      }

      // Step 2: Parse and bulk insert data
      if (!options.shouldImportData) {
        logBasic('Import completed (schema only, no data).');
        return {
          tableId,
          tableName: finalTableName,
          rowsInserted: 0,
          rowsFailed: 0,
          errors: [],
        };
      }

      logBasic('Importing data...');

      const result = await this.importCsvData(
        context,
        baseId,
        tableId,
        attachment,
        parserConfig,
        colMap,
        !!options.typecast,
        req,
        logDetailed,
      );

      const { insertedCount, failedCount, errors } = result;

      elapsedTime(
        hrTime,
        `CSV import completed for table ${tableId}`,
        'fileImport',
      );

      logBasic(
        JSON.stringify({
          status: 'completed',
          rowsInserted: insertedCount,
          rowsFailed: failedCount,
          errorsCount: errors.length,
        }),
      );

      logBasic(
        `Import completed: ${insertedCount} rows inserted, ${failedCount} failed.`,
      );

      // Cleanup temp file from storage
      try {
        if (attachment.path || attachment.url) {
          const storageAdapter = await NcPluginMgrv2.storageAdapter();
          const filePath = resolveAttachmentFilePath(attachment);
          await storageAdapter.fileDelete(filePath);
        }
      } catch (e) {
        this.logger.warn(`Failed to cleanup temp file: ${e.message}`);
      }

      return {
        tableId,
        tableName: finalTableName,
        rowsInserted: insertedCount,
        rowsFailed: failedCount,
        errors: errors.slice(0, 100),
      };
    } catch (e) {
      this.logger.error(`CSV import failed: ${e.message}`, e.stack);
      logBasic('Import failed due to an internal error.');

      throw {
        data: {
          tableId,
          tableName: finalTableName,
        },
        message: e.message || 'Import failed. Please check the file format and try again.',
      };
    }
  }

  private async flushBatch(
    context: NcContext,
    baseId: string,
    tableId: string,
    batch: Record<string, any>[],
    req: NcRequest,
    rowCount: number,
    typecast: boolean,
    counters: {
      insertedCount: number;
      failedCount: number;
      systemErrorCount: number;
    },
    errors: Array<{ row: number; error: string }>,
    maxErrors: number,
  ) {
    if (batch.length === 0) return;

    try {
      await this.bulkDataService.bulkDataInsert(context, {
        baseName: baseId,
        tableName: tableId,
        body: batch,
        cookie: req,
        skip_hooks: true,
        raw: true,
        ...(typecast ? { typecast: 'true' } : {}),
      });
      counters.insertedCount += batch.length;
    } catch (e) {
      this.logger.error(
        `Bulk insert failed for batch of ${batch.length} rows at row ~${rowCount}: ${e.message}`,
        e.stack,
      );

      // Only retry row-by-row for known row-level errors (duplicates, validation, etc.)
      // Everything else (DB down, table gone, permissions, unknown errors) — fail fast
      const isRowLevel =
        e instanceof NcBaseErrorv2 &&
        [
          NcErrorType.ERR_DUPLICATE_RECORD,
          NcErrorType.FIELD_UNIQUE_CONSTRAINT_VIOLATION,
          NcErrorType.ERR_INVALID_VALUE_FOR_FIELD,
          NcErrorType.ERR_INVALID_JSON,
          NcErrorType.ERR_INVALID_ATTACHMENT_JSON,
        ].includes(e.error);

      if (!isRowLevel) {
        counters.failedCount += batch.length;
        counters.systemErrorCount++;
        if (counters.systemErrorCount >= 20) {
          throw e;
        }
        return;
      }

      for (let i = 0; i < batch.length; i++) {
        try {
          await this.bulkDataService.bulkDataInsert(context, {
            baseName: baseId,
            tableName: tableId,
            body: [batch[i]],
            cookie: req,
            skip_hooks: true,
            raw: true,
            ...(typecast ? { typecast: 'true' } : {}),
          });
          counters.insertedCount += 1;
        } catch (rowErr) {
          counters.failedCount += 1;
          if (errors.length < maxErrors) {
            errors.push({
              row: rowCount - batch.length + i + 1,
              error: 'Failed to insert row',
            });
          }
        }
      }
    }
  }

  private transformRow(
    data: any[],
    colMap: Record<number, { destCn: string; uidt: string }>,
  ): Record<string, any> {
    const rowData: Record<string, any> = {};
    for (const [keyStr, mapping] of Object.entries(colMap)) {
      const colIdx = parseInt(keyStr, 10);
      const cellValue = data[colIdx];
      const value =
        cellValue === '' || cellValue === undefined || cellValue === null
          ? null
          : cellValue;

      if (mapping.uidt === UITypes.Checkbox) {
        rowData[mapping.destCn] = getCheckboxValue(value);
      } else if (
        mapping.uidt === UITypes.SingleSelect ||
        mapping.uidt === UITypes.MultiSelect
      ) {
        rowData[mapping.destCn] = (value || '').toString().trim() || null;
      } else {
        rowData[mapping.destCn] = value;
      }
    }
    return rowData;
  }

  private async importCsvData(
    context: NcContext,
    baseId: string,
    tableId: string,
    attachment: DataImportJobData['attachment'],
    parserConfig: DataImportJobData['parserConfig'],
    colMap: Record<number, { destCn: string; uidt: string }>,
    typecast: boolean,
    req: NcRequest,
    logDetailed: (msg: string) => void,
  ) {
    if (!attachment.path && !attachment.url) {
      NcError.badRequest('Attachment path or url is required');
    }

    const storageAdapter =
      (await NcPluginMgrv2.storageAdapter()) as IStorageAdapterV2;
    const filePath = resolveAttachmentFilePath(attachment);
    const readStream = await storageAdapter.fileReadByStream(filePath, {
      encoding: parserConfig.encoding || 'utf-8',
    });

    let rowCount = 0;
    const counters = { insertedCount: 0, failedCount: 0, systemErrorCount: 0 };
    const errors: Array<{ row: number; error: string }> = [];
    const maxErrors = 1000;
    let batch: Record<string, any>[] = [];
    let headerSkipped = false;

    await new Promise<void>((resolve, reject) => {
      parse(readStream, {
        delimiter: parserConfig.delimiter || undefined,
        skipEmptyLines: 'greedy',
        step: async (row: { data: string[] }, parser) => {
          if (!headerSkipped && parserConfig.firstRowAsHeaders) {
            headerSkipped = true;
            return;
          }
          if (!headerSkipped) {
            headerSkipped = true;
          }

          rowCount++;
          const data = row.data;
          batch.push(this.transformRow(data, colMap));

          if (batch.length >= BATCH_SIZE) {
            parser.pause();
            try {
              await this.flushBatch(
                context,
                baseId,
                tableId,
                batch,
                req,
                rowCount,
                typecast,
                counters,
                errors,
                maxErrors,
              );
              batch = [];
              logDetailed(
                JSON.stringify({
                  status: 'progress',
                  rowsInserted: counters.insertedCount,
                  rowsFailed: counters.failedCount,
                  totalProcessed: rowCount,
                }),
              );
            } catch (e) {
              this.logger.error(`Batch flush error: ${e.message}`, e.stack);
              parser.abort();
              reject(e);
              return;
            }
            parser.resume();
          }
        },
        complete: async () => {
          try {
            await this.flushBatch(
              context,
              baseId,
              tableId,
              batch,
              req,
              rowCount,
              typecast,
              counters,
              errors,
              maxErrors,
            );
            batch = [];
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error(err) {
          reject(err);
        },
      });
    });

    return {
      insertedCount: counters.insertedCount,
      failedCount: counters.failedCount,
      errors,
    };
  }
}
