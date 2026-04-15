import { Injectable, Logger } from '@nestjs/common';
import type {
  AttachmentReqType,
  FileImportParserConfig,
  FileImportType,
  NcRequest,
} from 'nocodb-sdk';
import type { DataImportJobData } from '~/interface/Jobs';
import type { NcContext } from '~/interface/config';
import type IStorageAdapterV2 from '~/types/nc-plugin/lib/IStorageAdapterV2';
import { resolveAttachmentFilePath } from '~/helpers/attachmentHelpers';
import { getImportHandler } from '~/modules/jobs/jobs/data-import/handlers';
import { JobTypes } from '~/interface/Jobs';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { Source } from '~/models';

@Injectable()
export class DataImportService {
  private logger = new Logger(DataImportService.name);

  constructor(protected readonly nocoJobsService: NocoJobsService) {}

  async preview(
    _context: NcContext,
    param: {
      importType?: FileImportType;
      attachment: Pick<AttachmentReqType, 'path' | 'url'>;
      parserConfig: Pick<
        FileImportParserConfig,
        | 'firstRowAsHeaders'
        | 'delimiter'
        | 'encoding'
        | 'maxRowsToParse'
        | 'autoSelectFieldTypes'
        | 'normalizeNested'
      >;
    },
  ) {
    const { attachment, parserConfig, importType = 'csv' } = param;

    if (!attachment?.path && !attachment?.url) {
      NcError.badRequest('Attachment path or url is required');
    }

    const { encoding } = parserConfig || {};

    const storageAdapter =
      (await NcPluginMgrv2.storageAdapter()) as IStorageAdapterV2;
    const filePath = resolveAttachmentFilePath(attachment);
    const readStream = await storageAdapter.fileReadByStream(filePath, {
      encoding: encoding || 'utf-8',
    });

    const handler = getImportHandler(importType);
    return handler.preview(readStream, parserConfig);
  }

  async importFile(
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
    } as DataImportJobData);

    return {
      id: job.id,
    };
  }
}
