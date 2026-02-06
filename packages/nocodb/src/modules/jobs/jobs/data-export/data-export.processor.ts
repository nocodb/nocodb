import { Readable } from 'stream';
import path from 'path';
import iconv from 'iconv-lite';
import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as XLSX from 'xlsx';
import type { Job } from 'bull';

dayjs.extend(utc);
dayjs.extend(timezone);
import { type DataExportJobData } from '~/interface/Jobs';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { Base, Model, PresignedUrl, View, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

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

    if (exportAs !== 'csv' && exportAs !== 'json' && exportAs !== 'xlsx')
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
      exportAs === 'json' ? 'json' : exportAs === 'xlsx' ? 'xlsx' : 'csv';
    const destPath = `nc/uploads/data-export/${dateFolder}/${modelId}/${filename}.${fileExtension}`;

    let url = null;

    try {
      if (exportAs === 'xlsx') {
        url = await this.exportAsExcel(context, {
          model,
          view,
          options,
          storageAdapter,
          destPath,
        });
      } else {
        const dataStream = new Readable({
          read() {},
        });

        dataStream.setEncoding('utf8');

        const encodedStream =
          options?.encoding &&
          options.encoding !== 'utf-8' &&
          iconv.encodingExists(options.encoding)
            ? dataStream
                .pipe(iconv.decodeStream('utf-8'))
                .pipe(iconv.encodeStream(options?.encoding || 'utf-8'))
            : dataStream;

        if (
          ['csv', 'xlsx'].includes(exportAs) &&
          (!options?.encoding || options.encoding === 'utf-8') &&
          options.includeByteOrderMark
        ) {
          // Push UTF-8 BOM at the start
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
      }

      // if url is not defined, it is local attachment
      const mimetype = exportAs === 'json' ? 'application/json' : 'text/csv';
      const filenameWithExt = `${filename}.${fileExtension}`;

      if (!url) {
        const mimeType =
          exportAs === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv';
        url = await PresignedUrl.getSignedUrl({
          pathOrUrl: path.join(destPath.replace('nc/uploads/', '')),
          filename: filenameWithExt,
          expireSeconds: 3 * 60 * 60, // 3 hours
          preview: false,
          mimetype,
          encoding: options?.encoding || 'utf-8',
        });
      } else {
        const mimeType =
          exportAs === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv';
        url = await PresignedUrl.getSignedUrl({
          pathOrUrl: url,
          filename: filenameWithExt,
          expireSeconds: 3 * 60 * 60, // 3 hours
          preview: false,
          mimetype,
          encoding: options?.encoding || 'utf-8',
        });
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

  private async exportAsExcel(
    context,
    param: {
      model: any;
      view: any;
      options: any;
      storageAdapter: any;
      destPath: string;
    },
  ): Promise<string> {
    const { model, view, options, storageAdapter, destPath } = param;

    const allData = await this.getAllDataForExcel(context, {
      model,
      view,
      options,
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(allData.rows, {
      header: allData.headers,
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const dataStream = new Readable({
      read() {},
    });
    dataStream.push(excelBuffer);
    dataStream.push(null);

    return await (storageAdapter as any).fileCreateByStream(
      destPath,
      dataStream,
    );
  }

  private async getAllDataForExcel(
    context,
    param: {
      model: any;
      view: any;
      options: any;
    },
  ) {
    const { model, view, options } = param;

    const allRows = [];
    let headers = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    while (hasMore) {
      const result = await this.exportService.datasService.dataList(context, {
        model,
        view,
        query: {
          limit,
          offset,
          filterArrJson: options.filterArrJson,
          sortArrJson: options.sortArrJson,
        },
        baseModel,
        ignoreViewFilterAndSort: false,
        limitOverride: limit,
        skipSortBasedOnOrderCol: true,
      });

      if (result.list.length === 0) {
        hasMore = false;
        break;
      }

      if (offset === 0 && result.list.length > 0) {
        headers = Object.keys(result.list[0]);
      }

      allRows.push(...result.list);

      if (result.pageInfo.isLastPage) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return {
      headers,
      rows: allRows,
    };
  }
}
