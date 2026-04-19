import { Injectable, Logger } from '@nestjs/common';
import type {
  AttachmentReqType,
  FileImportOptions,
  FileImportParserConfig,
  FileImportSheet,
  FileImportType,
  ImportPreviewResponse,
  NcRequest,
} from 'nocodb-sdk';
import type { DataImportJobData } from '~/interface/Jobs';
import type { NcContext } from '~/interface/config';
import { openImportAttachmentStream } from '~/modules/jobs/jobs/data-import/attachment-stream';
import { getImportHandler } from '~/modules/jobs/jobs/data-import/handlers';
import { JobTypes } from '~/interface/Jobs';
import { NcError } from '~/helpers/catchError';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { Source } from '~/models';

@Injectable()
export class DataImportService {
  private logger = new Logger(DataImportService.name);

  constructor(protected readonly nocoJobsService: NocoJobsService) {}

  /**
   * Parse the uploaded file and return one entry per sheet. CSV/JSON always
   * return a single sheet; Excel returns one per worksheet in the workbook.
   */
  async preview(
    _context: NcContext,
    param: {
      importType?: FileImportType;
      attachment: Pick<AttachmentReqType, 'path' | 'url'>;
      parserConfig: FileImportParserConfig;
    },
  ): Promise<ImportPreviewResponse> {
    const { attachment, parserConfig } = param;
    const importType = param.importType || 'csv';

    const readStream = await openImportAttachmentStream(
      importType,
      attachment,
      parserConfig?.encoding,
    );

    const handler = getImportHandler(importType);
    const sheets = await handler.preview(readStream, parserConfig);
    return { sheets };
  }

  /** Queue one import job per uploaded file. */
  async importFile(
    context: NcContext,
    param: {
      baseId: string;
      body: {
        baseId?: string;
        sourceId: string;
        importType?: FileImportType;
        attachment: AttachmentReqType;
        sheets: FileImportSheet[];
        parserConfig: FileImportParserConfig;
        options: FileImportOptions;
      };
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

    if (!body.attachment?.path && !body.attachment?.url) {
      NcError.badRequest('Attachment path or url is required');
    }

    if (!body.sheets?.length) {
      NcError.badRequest('At least one sheet is required');
    }
    for (const sheet of body.sheets) {
      const label = sheet.sheetName ? ` for sheet "${sheet.sheetName}"` : '';
      if (!sheet.columns?.length) {
        NcError.badRequest(`Column definitions are required${label}`);
      }
      if (!body.options.importDataOnly && !sheet.tableName) {
        NcError.badRequest(
          `Table name is required${label} when creating a new table`,
        );
      }
      if (body.options.importDataOnly && !sheet.tableId) {
        NcError.badRequest(
          `Table ID is required${label} when importing into an existing table`,
        );
      }
    }

    const job = await this.nocoJobsService.add(JobTypes.DataImport, {
      context,
      importType: body.importType || 'csv',
      baseId: baseId || body.baseId,
      sourceId: body.sourceId,
      attachment: body.attachment,
      sheets: body.sheets,
      parserConfig: body.parserConfig,
      options: body.options,
      user: req.user,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        ncBaseId: req.ncBaseId,
        ncSourceId: req.ncSourceId,
      },
    } as DataImportJobData);

    return { id: job.id };
  }
}
