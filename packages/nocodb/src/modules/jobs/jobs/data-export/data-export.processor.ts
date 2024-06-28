import { Readable } from 'stream';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import moment from 'moment';
import { type DataExportJobData, JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { Model, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

@Processor(JOBS_QUEUE)
export class DataExportProcessor {
  private logger = new Logger(DataExportProcessor.name);

  constructor(private readonly exportService: ExportService) {}

  @Process(JobTypes.DataExport)
  async job(job: Job<DataExportJobData>) {
    const {
      context,
      modelId,
      viewId,
      user: _user,
      exportAs,
      ncSiteUrl,
    } = job.data;

    if (exportAs !== 'csv') NcError.notImplemented(`Export as ${exportAs}`);

    const hrTime = initTime();

    const model = await Model.get(context, modelId);

    if (!model) NcError.tableNotFound(modelId);

    const view = await View.get(context, viewId);

    if (!view) NcError.viewNotFound(viewId);

    // date time as containing folder YYYY-MM-DD/HH
    const dateFolder = moment().format('YYYY-MM-DD/HH');

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const destPath = `nc/data-export/${dateFolder}/${modelId}/${model.title} (${view.title}).csv`;

    try {
      const dataStream = new Readable({
        read() {},
      });

      dataStream.setEncoding('utf8');

      let error = null;

      const uploadFilePromise = (storageAdapter as any)
        .fileCreateByStream(destPath, dataStream)
        .catch((e) => {
          this.logger.error(e);
          error = e;
        });

      this.exportService
        .streamModelDataAsCsv(context, {
          dataStream,
          linkStream: null,
          baseId: model.base_id,
          modelId: model.id,
          viewId: view.id,
          ncSiteUrl: ncSiteUrl,
        })
        .catch((e) => {
          this.logger.debug(e);
          dataStream.push(null);
          error = e;
        });

      await uploadFilePromise;

      if (error) {
        throw error;
      }

      elapsedTime(
        hrTime,
        `exported data for model ${modelId} view ${viewId} as ${exportAs}`,
        'exportData',
      );
    } catch (e) {
      throw NcError.badRequest(e);
    }

    return {
      path: destPath,
    };
  }
}
