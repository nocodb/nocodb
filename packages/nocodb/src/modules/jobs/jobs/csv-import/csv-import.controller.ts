import path from 'path';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { parse } from 'papaparse';
import * as xlsx from 'xlsx';
import {
  detectColumnTypes,
  detectExcelColumnTypes,
  detectJsonColumns,
} from './csv-type-detector';
import type { Readable } from 'stream';
import type { CsvImportJobData } from '~/interface/Jobs';
import { NcContext, NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CsvImportController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {}

  // Preview endpoint: reads first N rows, detects types, returns columns + preview data
  @Post(['/api/v1/db/file-import/:baseId/preview'])
  @HttpCode(200)
  @Acl('tableCreate')
  async preview(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') _baseId: string,
    @Body()
    body: {
      importType: 'csv' | 'excel' | 'json';
      attachment: { path?: string; url?: string };
      parserConfig: {
        firstRowAsHeaders?: boolean;
        delimiter?: string;
        encoding?: string;
        maxRowsToParse?: number;
        autoSelectFieldTypes?: boolean;
        normalizeNested?: boolean;
      };
    },
  ) {
    const { importType = 'csv', attachment, parserConfig } = body;

    if (!attachment?.path && !attachment?.url) {
      NcError.badRequest('Attachment path or URL is required');
    }

    const {
      firstRowAsHeaders = true,
      delimiter,
      maxRowsToParse = 500,
      encoding,
      autoSelectFieldTypes = true,
      normalizeNested = true,
    } = parserConfig || {};

    if (importType === 'excel') {
      return this.previewExcel(attachment, {
        firstRowAsHeaders,
        maxRowsToParse,
        autoSelectFieldTypes,
      });
    } else if (importType === 'json') {
      return this.previewJson(attachment, {
        maxRowsToParse,
        autoSelectFieldTypes,
        normalizeNested,
      });
    }

    // Default: CSV preview
    return this.previewCsv(attachment, {
      firstRowAsHeaders,
      delimiter,
      maxRowsToParse,
      encoding,
      autoSelectFieldTypes,
    });
  }

  // Also keep legacy CSV-only preview endpoint for backward compatibility
  @Post(['/api/v1/db/csv-import/:baseId/preview'])
  @HttpCode(200)
  @Acl('tableCreate')
  async csvPreview(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') _baseId: string,
    @Body()
    body: {
      attachment: { path?: string; url?: string };
      parserConfig: {
        firstRowAsHeaders?: boolean;
        delimiter?: string;
        encoding?: string;
        maxRowsToParse?: number;
        autoSelectFieldTypes?: boolean;
      };
    },
  ) {
    const { attachment, parserConfig } = body;

    if (!attachment?.path && !attachment?.url) {
      NcError.badRequest('Attachment path or URL is required');
    }

    const {
      firstRowAsHeaders = true,
      delimiter,
      maxRowsToParse = 500,
      encoding,
      autoSelectFieldTypes = true,
    } = parserConfig || {};

    return this.previewCsv(attachment, {
      firstRowAsHeaders,
      delimiter,
      maxRowsToParse,
      encoding,
      autoSelectFieldTypes,
    });
  }

  private async previewCsv(
    attachment: { path?: string; url?: string },
    options: {
      firstRowAsHeaders: boolean;
      delimiter?: string;
      maxRowsToParse: number;
      encoding?: string;
      autoSelectFieldTypes: boolean;
    },
  ) {
    const {
      firstRowAsHeaders,
      delimiter,
      maxRowsToParse,
      encoding,
      autoSelectFieldTypes,
    } = options;

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    let readStream: Readable;
    if (attachment.path) {
      const filePath = path.join(
        'nc',
        'uploads',
        attachment.path.replace(/^download[/\\]/i, ''),
      );
      readStream = await (storageAdapter as any).fileReadByStream(filePath, {
        encoding: encoding || 'utf-8',
      });
    } else {
      const axios = require('axios');
      const response = await axios.get(attachment.url, {
        responseType: 'stream',
      });
      readStream = response.data;
    }

    const headers: string[] = [];
    const sampleRows: string[][] = [];
    let rowCount = 0;
    let detectedDelimiter: string | undefined;

    await new Promise<void>((resolve, reject) => {
      parse(readStream, {
        delimiter: delimiter || undefined,
        skipEmptyLines: 'greedy',
        step(row, parser) {
          rowCount++;

          if (!detectedDelimiter && (row as any).meta?.delimiter) {
            detectedDelimiter = (row as any).meta.delimiter;
          }

          if (rowCount === 1 && firstRowAsHeaders) {
            headers.push(...(row.data as string[]));
          } else {
            if (rowCount === 1) {
              for (let i = 0; i < (row.data as string[]).length; i++) {
                headers.push(`Field ${i + 1}`);
              }
            }
            sampleRows.push(row.data as string[]);
          }

          if (sampleRows.length >= maxRowsToParse) {
            parser.abort();
          }
        },
        complete() {
          resolve();
        },
        error(err) {
          reject(err);
        },
      });
    });

    const columns = detectColumnTypes(headers, sampleRows, {
      maxRowsToParse,
      autoSelectFieldTypes,
    });

    const previewRows = sampleRows.slice(0, 20).map((row) => {
      const rowObj: Record<string, any> = {};
      for (let i = 0; i < columns.length; i++) {
        rowObj[columns[i].column_name] = row[i] ?? null;
      }
      return rowObj;
    });

    return {
      columns,
      previewData: previewRows,
      totalSampleRows: sampleRows.length,
      detectedDelimiter: detectedDelimiter || delimiter || ',',
    };
  }

  private async previewExcel(
    attachment: { path?: string; url?: string },
    options: {
      firstRowAsHeaders: boolean;
      maxRowsToParse: number;
      autoSelectFieldTypes: boolean;
    },
  ) {
    const { firstRowAsHeaders, maxRowsToParse, autoSelectFieldTypes } = options;

    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    let buffer: Buffer;

    if (attachment.path) {
      const filePath = path.join(
        'nc',
        'uploads',
        attachment.path.replace(/^download[/\\]/i, ''),
      );
      buffer = await (storageAdapter as any).fileRead(filePath);
    } else {
      const axios = require('axios');
      const response = await axios.get(attachment.url, {
        responseType: 'arraybuffer',
      });
      buffer = Buffer.from(response.data);
    }

    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheets: Array<{
      sheetName: string;
      columns: any[];
      previewData: any[];
      totalSampleRows: number;
    }> = [];

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const range = xlsx.utils.decode_range(ws['!ref'] || 'A1');
      const rows: any[][] = xlsx.utils.sheet_to_json(ws, {
        header: 1,
        blankrows: false,
        defval: null,
      });

      if (!rows.length) continue;

      const sampleRows = rows.slice(
        0,
        maxRowsToParse + (firstRowAsHeaders ? 1 : 0),
      );

      const columns = detectExcelColumnTypes(sampleRows, ws, range, xlsx, {
        firstRowAsHeaders,
        maxRowsToParse,
        autoSelectFieldTypes,
      });

      const dataStartIdx = firstRowAsHeaders ? 1 : 0;
      const previewRows = sampleRows
        .slice(dataStartIdx, dataStartIdx + 20)
        .map((row) => {
          const rowObj: Record<string, any> = {};
          for (let i = 0; i < columns.length; i++) {
            rowObj[columns[i].column_name] = row[i] ?? null;
          }
          return rowObj;
        });

      sheets.push({
        sheetName,
        columns,
        previewData: previewRows,
        totalSampleRows: rows.length - (firstRowAsHeaders ? 1 : 0),
      });
    }

    return { sheets };
  }

  private async previewJson(
    attachment: { path?: string; url?: string },
    options: {
      maxRowsToParse: number;
      autoSelectFieldTypes: boolean;
      normalizeNested: boolean;
    },
  ) {
    const { maxRowsToParse, autoSelectFieldTypes, normalizeNested } = options;

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
    } else {
      const axios = require('axios');
      const response = await axios.get(attachment.url, {
        responseType: 'text',
      });
      content = response.data;
    }

    let jsonData: Record<string, any>[];
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      jsonData = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Try to find the first array property
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

    const sampleData = jsonData.slice(0, maxRowsToParse);

    const columns = detectJsonColumns(sampleData, {
      normalizeNested,
      autoSelectFieldTypes,
    });

    // Build preview rows
    const previewRows = sampleData.slice(0, 20).map((row) => {
      const rowObj: Record<string, any> = {};
      for (const col of columns) {
        const path = col.path || [col.column_name];
        let value = row;
        for (const key of path) {
          value = value?.[key];
        }
        rowObj[col.column_name] = value ?? null;
      }
      return rowObj;
    });

    return {
      columns,
      previewData: previewRows,
      totalSampleRows: jsonData.length,
    };
  }

  // Import endpoint: creates a job to parse and insert all data
  @Post(['/api/v1/db/file-import/:baseId', '/api/v1/db/csv-import/:baseId'])
  @HttpCode(200)
  @Acl('tableCreate')
  async importFile(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Body()
    body: Omit<CsvImportJobData, 'jobName' | 'context' | 'user' | 'req'>,
  ) {
    if (!body.attachment?.path && !body.attachment?.url) {
      NcError.badRequest('Attachment path or URL is required');
    }

    if (!body.columns?.length) {
      NcError.badRequest('Column definitions are required');
    }

    if (!body.options?.importDataOnly && !body.tableName) {
      NcError.badRequest('Table name is required when creating a new table');
    }

    if (body.options?.importDataOnly && !body.tableId) {
      NcError.badRequest(
        'Table ID is required when importing into existing table',
      );
    }

    const job = await this.jobsService.add(JobTypes.CsvImport, {
      context,
      importType: body.importType || 'csv',
      baseId: baseId || body.baseId,
      sourceId: body.sourceId,
      tableId: body.tableId,
      tableName: body.tableName,
      attachment: body.attachment,
      columns: body.columns,
      parserConfig: body.parserConfig,
      options: body.options,
      columnMapping: body.columnMapping,
      user: req.user,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        ncBaseId: req.ncBaseId,
        ncSourceId: req.ncSourceId,
      },
    } as CsvImportJobData);

    return {
      id: job.id,
      name: job.name,
    };
  }
}
