import { Readable, Transform } from 'stream';
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

const UTF8_BOM = Buffer.from('﻿', 'utf8');

// Max UTF-8 bytes to hold while deciding whether the requested legacy charset
// can represent the data. Large enough to observe the non-ASCII content of the
// first rows (so scripts no legacy codepage can represent — e.g. Tibetan, many
// CJK-in-wrong-codepage cases — are detected up front), small enough to keep
// memory bounded for arbitrarily large exports.
const CHARSET_DECISION_BUFFER_BYTES = 64 * 1024;

/**
 * Encode a UTF-8 text stream to `charset`, but transparently fall back to UTF-8
 * (with a BOM) for the whole file if any character cannot be represented in
 * `charset`. Without this, a legacy single-byte/CJK codepage (windows-125x,
 * ISO-8859-*, GBK, Big5, Shift-JIS, …) silently turns every non-representable
 * character into "?" — e.g. ASCII survives but Tibetan is destroyed.
 *
 * The decision is made from at most `CHARSET_DECISION_BUFFER_BYTES` of buffered
 * output, so the UTF-8 BOM can be placed at byte 0 (required for Excel to detect
 * UTF-8) without buffering the entire export. Because ASCII encodes identically
 * across all these codepages and UTF-8, and non-representable characters in a
 * given column surface in its first rows, the common cases (all-ASCII, or a
 * non-representable script) are always decided correctly within the buffer.
 */
function createCharsetEncodeStream(
  charset: string,
  onFallback?: () => void,
): Transform {
  let mode: 'deciding' | 'legacy' | 'utf8' = 'deciding';
  const buffered: string[] = [];
  let bufferedBytes = 0;

  // A charset is lossy for `text` if encoding then decoding doesn't round-trip.
  const isLossy = (text: string) =>
    iconv.decode(iconv.encode(text, charset), charset) !== text;

  return new Transform({
    transform(chunk, _enc, cb) {
      const text = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : String(chunk);

      if (mode === 'utf8') return cb(null, Buffer.from(text, 'utf8'));
      if (mode === 'legacy') return cb(null, iconv.encode(text, charset));

      // deciding: nothing has been emitted yet, so we can still choose the
      // file's encoding (and prepend a BOM) based on what we've seen.
      if (isLossy(text)) {
        mode = 'utf8';
        onFallback?.();
        const pending = buffered.join('') + text;
        buffered.length = 0;
        return cb(
          null,
          Buffer.concat([UTF8_BOM, Buffer.from(pending, 'utf8')]),
        );
      }

      buffered.push(text);
      bufferedBytes += Buffer.byteLength(text, 'utf8');

      if (bufferedBytes >= CHARSET_DECISION_BUFFER_BYTES) {
        // Seen enough representable data — commit to the requested charset.
        mode = 'legacy';
        const pending = buffered.join('');
        buffered.length = 0;
        return cb(null, iconv.encode(pending, charset));
      }

      return cb();
    },
    flush(cb) {
      if (mode !== 'deciding') return cb();

      const pending = buffered.join('');
      buffered.length = 0;

      if (isLossy(pending)) {
        onFallback?.();
        return cb(
          null,
          Buffer.concat([UTF8_BOM, Buffer.from(pending, 'utf8')]),
        );
      }

      return cb(null, iconv.encode(pending, charset));
    },
  });
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
      locale,
    } = job.data;

    if (
      exportAs !== 'csv' &&
      exportAs !== 'json' &&
      exportAs !== 'excel' &&
      exportAs !== 'ics'
    )
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
      exportAs === 'json'
        ? 'json'
        : exportAs === 'excel'
        ? 'xlsx'
        : exportAs === 'ics'
        ? 'ics'
        : 'csv';
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

      const legacyCharset =
        exportAs !== 'excel' &&
        options?.encoding &&
        options.encoding !== 'utf-8' &&
        iconv.encodingExists(options.encoding)
          ? options.encoding
          : null;

      const encodedStream = legacyCharset
        ? dataStream.pipe(
            createCharsetEncodeStream(legacyCharset, () =>
              this.logger.warn(
                `Data export ${modelId}: requested charset "${legacyCharset}" cannot represent all characters; falling back to UTF-8 to avoid data loss.`,
              ),
            ),
          )
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
            locale,
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
            locale,
          })
          .catch((e) => {
            this.logger.debug(e);
            dataStream.push(null);
            error = e;
          });
      } else if (exportAs === 'ics') {
        this.exportService
          .streamModelDataAsIcs(context, {
            dataStream,
            baseId: model.base_id,
            modelId: model.id,
            viewId: view.id,
            ncSiteUrl: ncSiteUrl,
            filterArrJson: options.filterArrJson,
            sortArrJson: options.sortArrJson,
            locale,
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
            locale,
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
          : exportAs === 'ics'
          ? 'text/calendar'
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
