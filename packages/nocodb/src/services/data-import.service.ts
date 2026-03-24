import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'papaparse';
import type { Readable } from 'stream';
import type {
  AttachmentReqType,
  FileImportParserConfig,
  NcRequest,
} from 'nocodb-sdk';
import type { DataImportJobData } from '~/interface/Jobs';
import type { NcContext } from '~/interface/config';
import type IStorageAdapterV2 from '~/types/nc-plugin/lib/IStorageAdapterV2';
import { resolveAttachmentFilePath } from '~/helpers/attachmentHelpers';
import { detectColumnTypes } from '~/modules/jobs/jobs/data-import/csv-type-detector';
import { JobTypes } from '~/interface/Jobs';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { Source } from '~/models';

@Injectable()
export class DataImportService {
  private logger = new Logger(DataImportService.name);

  constructor(protected readonly nocoJobsService: NocoJobsService) {}

  async csvPreview(
    _context: NcContext,
    param: {
      attachment: Pick<AttachmentReqType, 'path' | 'url'>;
      parserConfig: Pick<
        FileImportParserConfig,
        | 'firstRowAsHeaders'
        | 'delimiter'
        | 'encoding'
        | 'maxRowsToParse'
        | 'autoSelectFieldTypes'
      >;
    },
  ) {
    const { attachment, parserConfig } = param;

    if (!attachment?.path && !attachment?.url) {
      NcError.badRequest('Attachment path or url is required');
    }

    const {
      firstRowAsHeaders = true,
      delimiter,
      maxRowsToParse = 500,
      encoding,
      autoSelectFieldTypes = true,
    } = parserConfig || {};

    const storageAdapter =
      (await NcPluginMgrv2.storageAdapter()) as IStorageAdapterV2;
    const filePath = resolveAttachmentFilePath(attachment);
    const readStream: Readable = await storageAdapter.fileReadByStream(
      filePath,
      { encoding: encoding || 'utf-8' },
    );

    const headers: string[] = [];
    const sampleRows: string[][] = [];
    let rowCount = 0;
    let detectedDelimiter: string | undefined;

    await new Promise<void>((resolve, reject) => {
      parse(readStream, {
        delimiter: delimiter || undefined,
        skipEmptyLines: 'greedy',
        step(row: { data: string[]; meta?: { delimiter?: string } }, parser) {
          rowCount++;

          if (!detectedDelimiter && row.meta?.delimiter) {
            detectedDelimiter = row.meta.delimiter;
          }

          if (rowCount === 1 && firstRowAsHeaders) {
            headers.push(...row.data);
          } else {
            if (rowCount === 1) {
              for (let i = 0; i < row.data.length; i++) {
                headers.push(`Field ${i + 1}`);
              }
            }
            sampleRows.push(row.data);
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

    if (!headers.length) {
      return {
        columns: [],
        previewData: [],
        totalSampleRows: 0,
        detectedDelimiter: delimiter || ',',
      };
    }

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

  async csvImportFile(
    context: NcContext,
    param: {
      baseId: string;
      body: Omit<DataImportJobData, 'jobName' | 'context' | 'user' | 'req'>;
      req: NcRequest;
    },
  ) {
    const { baseId, body, req } = param;

    const source = await Source.get(context, body.sourceId);
    if (!source) NcError.sourceNotFound(body.sourceId);

    if (source.is_schema_readonly && !body.options?.importDataOnly) {
      NcError.sourceMetaReadOnly(source.alias);
    }

    if (source.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    if (!body.attachment?.path) {
      NcError.badRequest('Attachment path or url is required');
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

    const job = await this.nocoJobsService.add(JobTypes.DataImport, {
      context,
      importType: 'csv',
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
    } as DataImportJobData);

    return {
      id: job.id,
    };
  }
}
