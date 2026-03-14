import path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'papaparse';
import * as xlsx from 'xlsx';
import { AuditV1OperationTypes, UITypes } from 'nocodb-sdk';
import { JobsLogService } from '../jobs-log.service';
import { getCheckboxValue, parseJsonRows } from './csv-type-detector';
import type { Job } from 'bull';
import type { NcRequest } from 'nocodb-sdk';
import type { CsvImportJobData } from '~/interface/Jobs';
import type { Readable } from 'stream';
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
export class CsvImportProcessor {
  private logger = new Logger(CsvImportProcessor.name);

  constructor(
    private readonly tablesService: TablesService,
    private readonly bulkDataService: BulkDataAliasService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  async job(job: Job<CsvImportJobData>) {
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
      importType = 'csv',
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
            file_name: attachment.title || `${importType}-import`,
            import_type: importType,
            import_data_only: options.importDataOnly,
            table_name: tableName,
            columns_count: columns.length,
          },
          req,
          id: parentAuditId,
        }),
      );

      logBasic(`Starting ${importType.toUpperCase()} import...`);

      // Step 1: Create table if needed
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
            user: user as any,
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

      let result: {
        insertedCount: number;
        failedCount: number;
        errors: Array<{ row: number; error: string }>;
      };

      if (importType === 'excel') {
        result = await this.importExcelData(
          context,
          baseId,
          tableId,
          attachment,
          parserConfig,
          colMap,
          columns,
          req,
          logDetailed,
        );
      } else if (importType === 'json') {
        result = await this.importJsonData(
          context,
          baseId,
          tableId,
          attachment,
          parserConfig,
          colMap,
          columns,
          req,
          logDetailed,
        );
      } else {
        result = await this.importCsvData(
          context,
          baseId,
          tableId,
          attachment,
          parserConfig,
          colMap,
          req,
          logDetailed,
        );
      }

      const { insertedCount, failedCount, errors } = result;

      elapsedTime(
        hrTime,
        `${importType} import completed for table ${tableId}`,
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
        if (attachment.path) {
          const storageAdapter = await NcPluginMgrv2.storageAdapter();
          const filePath = path.join(
            'nc',
            'uploads',
            attachment.path.replace(/^download[/\\]/i, ''),
          );
          await (storageAdapter as any).fileDelete(filePath);
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
      logBasic(`Import failed: ${e.message}`);

      throw {
        data: {
          tableId,
          tableName: finalTableName,
        },
        message: e.message,
      };
    }
  }

  private async flushBatch(
    context: any,
    baseId: string,
    tableId: string,
    batch: Record<string, any>[],
    req: NcRequest,
    rowCount: number,
    counters: { insertedCount: number; failedCount: number },
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
      });
      counters.insertedCount += batch.length;
    } catch (e) {
      this.logger.error(`Bulk insert failed: ${e.message}`, e.stack);
      this.logger.error(`Sample row: ${JSON.stringify(batch[0])}`);
      // Fallback: row-by-row insertion
      for (let i = 0; i < batch.length; i++) {
        try {
          await this.bulkDataService.bulkDataInsert(context, {
            baseName: baseId,
            tableName: tableId,
            body: [batch[i]],
            cookie: req,
            skip_hooks: true,
            raw: true,
          });
          counters.insertedCount += 1;
        } catch (rowErr) {
          counters.failedCount += 1;
          if (errors.length < maxErrors) {
            errors.push({
              row: rowCount - batch.length + i + 1,
              error: rowErr.message || 'Unknown error',
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
    context: any,
    baseId: string,
    tableId: string,
    attachment: CsvImportJobData['attachment'],
    parserConfig: CsvImportJobData['parserConfig'],
    colMap: Record<number, { destCn: string; uidt: string }>,
    req: NcRequest,
    logDetailed: (msg: string) => void,
  ) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    let readStream: Readable;
    if (attachment.path) {
      const filePath = path.join(
        'nc',
        'uploads',
        attachment.path.replace(/^download[/\\]/i, ''),
      );
      readStream = await (storageAdapter as any).fileReadByStream(filePath, {
        encoding: parserConfig.encoding || 'utf-8',
      });
    } else if (attachment.url) {
      const axios = require('axios');
      const response = await axios.get(attachment.url, {
        responseType: 'stream',
      });
      readStream = response.data;
    } else {
      NcError.badRequest('No file path or URL provided');
    }

    let rowCount = 0;
    const counters = { insertedCount: 0, failedCount: 0 };
    const errors: Array<{ row: number; error: string }> = [];
    const maxErrors = 1000;
    let batch: Record<string, any>[] = [];
    let headerSkipped = false;

    await new Promise<void>((resolve, reject) => {
      parse(readStream, {
        delimiter: parserConfig.delimiter || undefined,
        skipEmptyLines: 'greedy',
        step: async (row, parser) => {
          if (!headerSkipped && parserConfig.firstRowAsHeaders) {
            headerSkipped = true;
            return;
          }
          if (!headerSkipped) {
            headerSkipped = true;
          }

          rowCount++;
          const data = row.data as string[];
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
              this.logger.error('Batch flush error:', e);
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

  private async importExcelData(
    context: any,
    baseId: string,
    tableId: string,
    attachment: CsvImportJobData['attachment'],
    parserConfig: CsvImportJobData['parserConfig'],
    colMap: Record<number, { destCn: string; uidt: string }>,
    columns: CsvImportJobData['columns'],
    req: NcRequest,
    logDetailed: (msg: string) => void,
  ) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    let buffer: Buffer;

    if (attachment.path) {
      const filePath = path.join(
        'nc',
        'uploads',
        attachment.path.replace(/^download[/\\]/i, ''),
      );
      buffer = await (storageAdapter as any).fileRead(filePath);
    } else if (attachment.url) {
      const axios = require('axios');
      const response = await axios.get(attachment.url, {
        responseType: 'arraybuffer',
      });
      buffer = Buffer.from(response.data);
    } else {
      NcError.badRequest('No file path or URL provided');
    }

    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    // Use first sheet by default
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    const rows: any[][] = xlsx.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: null,
    });

    let rowCount = 0;
    const counters = { insertedCount: 0, failedCount: 0 };
    const errors: Array<{ row: number; error: string }> = [];
    const maxErrors = 1000;
    let batch: Record<string, any>[] = [];

    const dataStartIdx = parserConfig.firstRowAsHeaders ? 1 : 0;

    for (let i = dataStartIdx; i < rows.length; i++) {
      rowCount++;
      batch.push(this.transformRow(rows[i], colMap));

      if (batch.length >= BATCH_SIZE) {
        await this.flushBatch(
          context,
          baseId,
          tableId,
          batch,
          req,
          rowCount,
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
      }
    }

    // Flush remaining
    await this.flushBatch(
      context,
      baseId,
      tableId,
      batch,
      req,
      rowCount,
      counters,
      errors,
      maxErrors,
    );

    return {
      insertedCount: counters.insertedCount,
      failedCount: counters.failedCount,
      errors,
    };
  }

  private async importJsonData(
    context: any,
    baseId: string,
    tableId: string,
    attachment: CsvImportJobData['attachment'],
    parserConfig: CsvImportJobData['parserConfig'],
    colMap: Record<number, { destCn: string; uidt: string }>,
    columns: CsvImportJobData['columns'],
    req: NcRequest,
    logDetailed: (msg: string) => void,
  ) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    let content: string;

    if (attachment.path) {
      const filePath = path.join(
        'nc',
        'uploads',
        attachment.path.replace(/^download[/\\]/i, ''),
      );
      const buffer = await (storageAdapter as any).fileRead(filePath);
      content = buffer.toString('utf-8');
    } else if (attachment.url) {
      const axios = require('axios');
      const response = await axios.get(attachment.url, {
        responseType: 'text',
      });
      content = response.data;
    } else {
      NcError.badRequest('No file path or URL provided');
    }

    let jsonData: Record<string, any>[];
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      jsonData = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const arrayKey = Object.keys(parsed).find((k) =>
        Array.isArray(parsed[k]),
      );
      if (arrayKey) {
        jsonData = parsed[arrayKey];
      } else {
        jsonData = [parsed];
      }
    } else {
      NcError.badRequest('Invalid JSON: expected an array or object');
    }

    // Use parseJsonRows for nested path extraction, then map through colMap for DB column names
    const parsedRows = parseJsonRows(jsonData, columns as any);

    let rowCount = 0;
    const counters = { insertedCount: 0, failedCount: 0 };
    const errors: Array<{ row: number; error: string }> = [];
    const maxErrors = 1000;
    let batch: Record<string, any>[] = [];

    for (const parsedRow of parsedRows) {
      rowCount++;

      // Map from column_name → DB column title using colMap
      const rowData: Record<string, any> = {};
      for (const col of columns) {
        const mapping = colMap[col.key];
        if (!mapping) continue;
        const value = parsedRow[col.column_name];
        rowData[mapping.destCn] = value;
      }

      batch.push(rowData);

      if (batch.length >= BATCH_SIZE) {
        await this.flushBatch(
          context,
          baseId,
          tableId,
          batch,
          req,
          rowCount,
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
      }
    }

    // Flush remaining
    await this.flushBatch(
      context,
      baseId,
      tableId,
      batch,
      req,
      rowCount,
      counters,
      errors,
      maxErrors,
    );

    return {
      insertedCount: counters.insertedCount,
      failedCount: counters.failedCount,
      errors,
    };
  }
}
