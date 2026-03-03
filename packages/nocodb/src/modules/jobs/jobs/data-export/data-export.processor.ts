import { Readable } from 'stream';
import path from 'path';
import iconv from 'iconv-lite';
import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { Job } from 'bull';

dayjs.extend(utc);
dayjs.extend(timezone);
import { type DataExportJobData } from '~/interface/Jobs';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { Base, Model, PresignedUrl, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

function getViewTitle(view: View) {
  return view?.title;
}

@Injectable()
export class DataExportProcessor {
  private logger = new Logger(DataExportProcessor.name);

  constructor(private readonly exportService: ExportService) {}

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

    if (exportAs !== 'csv' && exportAs !== 'json' && exportAs !== 'excel')
      NcError.notImplemented(`Export as ${exportAs}`);

    const hrTime = initTime();

    const model = await Model.get(context, modelId);

    if (!model) NcError.tableNotFound(modelId);

    const view = await View.get(context, viewId);

    if (!view) NcError.viewNotFound(viewId);

    // date time as containing folder YYYY-MM-DD/HH
    const dateFolder = dayjs().format('YYYY-MM-DD/HH');

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const base = await Base.get(context, model.base_id);
    const date = dayjs()
      .tz(options?.filenameTimeZone || 'Etc/UTC')
      .format('YYYY-MM-DD_HH-mm');
    const filename = `${base.title} - ${model.title} (${getViewTitle(
      view,
    )}) ${date}`;

    const fileExtension =
      exportAs === 'json' ? 'json' : exportAs === 'excel' ? 'xlsx' : 'csv';
    const destPath = `nc/uploads/data-export/${dateFolder}/${modelId}/${filename}.${fileExtension}`;

    let url = null;

    try {
      const dataStream = new Readable({
        read() {},
      });

      // Excel outputs binary data, so only set encoding for text-based formats
      if (exportAs !== 'excel') {
        dataStream.setEncoding('utf8');
      }

      const encodedStream =
        exportAs !== 'excel' &&
        options?.encoding &&
        options.encoding !== 'utf-8' &&
        iconv.encodingExists(options.encoding)
          ? dataStream
              .pipe(iconv.decodeStream('utf-8'))
              .pipe(iconv.encodeStream(options?.encoding || 'utf-8'))
          : dataStream;

      if (
        exportAs === 'csv' &&
        (!options?.encoding || options.encoding === 'utf-8') &&
        options.includeByteOrderMark
      ) {
        // Push UTF-8 BOM at the start (only for CSV text format)
        dataStream.push('\uFEFF');
      }

      let error = null;

      const uploadFilePromise = (storageAdapter as any)
        .fileCreateByStream(destPath, encodedStream)
        .catch((e) => {
          this.logger.error(e);
          error = e;
        });

      if (exportAs === 'json') {
        this.exportService
          .streamModelDataAsJson(context, {
            dataStream,
            baseId: model.base_id,
            modelId: model.id,
            viewId: view.id,
            ncSiteUrl: ncSiteUrl,
            includeCrossBaseColumns: true,
            filterArrJson: options.filterArrJson,
            sortArrJson: options.sortArrJson,
          })
          .catch((e) => {
            this.logger.debug(e);
            dataStream.push(null);
            error = e;
          });
      } else if (exportAs === 'excel') {
        this.exportService
          .streamModelDataAsExcel(context, {
            dataStream,
            baseId: model.base_id,
            modelId: model.id,
            viewId: view.id,
            ncSiteUrl: ncSiteUrl,
            includeCrossBaseColumns: true,
            filterArrJson: options.filterArrJson,
            sortArrJson: options.sortArrJson,
          })
          .catch((e) => {
            this.logger.debug(e);
            dataStream.push(null);
            error = e;
          });
      } else {
        this.exportService
          .streamModelDataAsCsv(context, {
            dataStream,
            linkStream: null,
            baseId: model.base_id,
            modelId: model.id,
            viewId: view.id,
            ncSiteUrl: ncSiteUrl,
            delimiter: options?.delimiter,
            includeCrossBaseColumns: true,
            filterArrJson: options.filterArrJson,
            sortArrJson: options.sortArrJson,
          })
          .catch((e) => {
            this.logger.debug(e);
            dataStream.push(null);
            error = e;
          });
      }

      url = await uploadFilePromise;

      if (error) {
        throw error;
      }

      // if url is not defined, it is local attachment
      const mimetype =
        exportAs === 'json'
          ? 'application/json'
          : exportAs === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const filenameWithExt = `${filename}.${fileExtension}`;

      if (!url) {
        url = await PresignedUrl.getSignedUrl({
          pathOrUrl: path.join(destPath.replace('nc/uploads/', '')),
          filename: filenameWithExt,
          expireSeconds: 3 * 60 * 60, // 3 hours
          preview: false,
          mimetype,
          encoding:
            exportAs === 'excel' ? undefined : options?.encoding || 'utf-8',
        });
      } else {
        url = await PresignedUrl.getSignedUrl({
          pathOrUrl: url,
          filename: filenameWithExt,
          expireSeconds: 3 * 60 * 60, // 3 hours
          preview: false,
          mimetype,
          encoding:
            exportAs === 'excel' ? undefined : options?.encoding || 'utf-8',
        });
      }

      elapsedTime(
        hrTime,
        `exported data for model ${modelId} view ${viewId} as ${exportAs}`,
        'exportData',
      );
    } catch (e) {
      throw {
        data: {
          extension_id: options?.extension_id,
          title: filename,
        },
        message: e.message,
      };
    }

    return {
      timestamp: new Date(),
      extension_id: options?.extension_id,
      type: exportAs,
      title: filename,
      url,
    };
  }
}
