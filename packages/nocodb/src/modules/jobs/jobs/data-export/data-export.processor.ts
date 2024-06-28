import { Readable } from 'stream';
import path from 'path';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import moment from 'moment';
import { type DataExportJobData, JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { Model, PresignedUrl, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

function getViewTitle(view: View) {
  return view.is_default ? 'Default View' : view.title;
}

@Processor(JOBS_QUEUE)
export class DataExportProcessor {
  private logger = new Logger(DataExportProcessor.name);

  constructor(private readonly exportService: ExportService) {}

  @Process(JobTypes.DataExport)
  async job(job: Job<DataExportJobData>) {
    const {
      context,
      options,
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

    const destPath = `nc/uploads/data-export/${dateFolder}/${modelId}/${
      model.title
    } (${getViewTitle(view)}) - ${Date.now()}.csv`;

    let url = null;

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
          delimiter: options?.delimiter,
        })
        .catch((e) => {
          this.logger.debug(e);
          dataStream.push(null);
          error = e;
        });

      url = await uploadFilePromise;

      // if url is not defined, it is local attachment
      if (!url) {
        url = await PresignedUrl.getSignedUrl({
          path: path.join(destPath.replace('nc/uploads/', '')),
          filename: `${model.title} (${getViewTitle(view)}).csv`,
          expireSeconds: 3 * 60 * 60, // 3 hours
        });
      } else {
        if (url.includes('.amazonaws.com/')) {
          const relativePath = decodeURI(url.split('.amazonaws.com/')[1]);
          url = await PresignedUrl.getSignedUrl({
            path: relativePath,
            filename: `${model.title} (${getViewTitle(view)}).csv`,
            s3: true,
            expireSeconds: 3 * 60 * 60, // 3 hours
          });
        }
      }

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
      timestamp: new Date(),
      type: exportAs,
      title: `${model.title} (${getViewTitle(view)})`,
      url,
    };
  }
}
