import { Transform } from 'stream';
import { Logger } from '@nestjs/common';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import type { Readable } from 'stream';
import type {
  FileImportColumn,
  FileImportParserConfig,
  ImportPreviewSheet,
} from 'nocodb-sdk';
import type {
  DataImportHandler,
  ImportRow,
} from '~/modules/jobs/jobs/data-import/handlers/data-import-handler.interface';
import { detectColumnTypesFromObjects } from '~/modules/jobs/jobs/data-import/csv-type-detector';

const logger = new Logger('JsonImportHandler');

const MAX_FLATTEN_DEPTH = 3;

/**
 * Flattens a nested object: { a: { b: 1 } } → { "a_b": 1 }
 * Objects deeper than maxDepth are JSON-stringified.
 */
function flattenObject(
  obj: Record<string, any>,
  prefix: string[] = [],
  result: Record<string, any> = {},
  depth = 0,
): Record<string, any> {
  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      depth < MAX_FLATTEN_DEPTH
    ) {
      flattenObject(value, path, result, depth + 1);
    } else if (value && typeof value === 'object') {
      result[path.join('_')] = JSON.stringify(value);
    } else {
      result[path.join('_')] = value;
    }
  }
  return result;
}

/**
 * Peeks at the first non-whitespace byte of a stream to detect JSON structure.
 * Returns { isArray, stream } where stream is the original data (unshift'd back).
 */
async function peekJsonType(
  readStream: Readable,
): Promise<{ isArray: boolean; stream: Readable }> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      readStream.removeListener('readable', onReadable);
      readStream.removeListener('error', onError);
      readStream.removeListener('end', onEnd);
    };

    const onReadable = () => {
      let chunk = readStream.read();
      if (chunk === null) return;

      if (typeof chunk === 'string') {
        chunk = Buffer.from(chunk, 'utf-8');
      }

      // Find first non-whitespace byte
      let isArray = false;
      for (let i = 0; i < chunk.length; i++) {
        const byte = chunk[i];
        // Skip whitespace: space, tab, newline, carriage return, BOM
        if (
          byte === 0x20 ||
          byte === 0x09 ||
          byte === 0x0a ||
          byte === 0x0d ||
          byte === 0xef
        ) {
          continue;
        }
        isArray = byte === 0x5b; // '['
        break;
      }

      // Push the chunk back so the stream is unconsumed
      readStream.unshift(chunk);
      cleanup();
      resolve({ isArray, stream: readStream });
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    // Empty stream — no bytes to peek. Resolve with isArray=false so the
    // caller wraps it; downstream parser will surface a clean "empty" result.
    const onEnd = () => {
      cleanup();
      resolve({ isArray: false, stream: readStream });
    };

    readStream.on('readable', onReadable);
    readStream.on('error', onError);
    readStream.on('end', onEnd);
  });
}

/**
 * Wraps a non-array JSON stream into an array stream.
 * Prepends '[' and appends ']' around the original content so streamArray works.
 */
function wrapAsArray(readStream: Readable): Readable {
  let sentPrefix = false;

  const wrapper = new Transform({
    transform(chunk, _encoding, callback) {
      if (!sentPrefix) {
        sentPrefix = true;
        this.push(Buffer.from('['));
      }
      callback(null, chunk);
    },
    flush(callback) {
      // Handle empty source: emit a valid empty array instead of just ']'
      if (!sentPrefix) {
        sentPrefix = true;
        this.push(Buffer.from('['));
      }
      this.push(Buffer.from(']'));
      callback();
    },
  });

  readStream.pipe(wrapper);
  return wrapper;
}

export class JsonImportHandler implements DataImportHandler {
  async preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewSheet[]> {
    const {
      maxRowsToParse = 500,
      autoSelectFieldTypes = true,
      normalizeNested = true,
    } = parserConfig || {};

    // Peek to determine if array or single object
    const { isArray, stream } = await peekJsonType(readStream);

    // If not an array, wrap it: { ... } → [{ ... }]
    const jsonStream = isArray ? stream : wrapAsArray(stream);
    const pipeline = jsonStream.pipe(parser()).pipe(streamArray()) as Transform;

    const sampleRows: Record<string, any>[] = [];
    let totalRows = 0;

    try {
      for await (const { value } of pipeline as AsyncIterable<{
        key: number;
        value: any;
      }>) {
        totalRows++;
        if (sampleRows.length < maxRowsToParse) {
          const row = normalizeNested ? flattenObject(value) : value;
          sampleRows.push(row);
        }
      }
    } catch (e: any) {
      // `ERR_STREAM_PREMATURE_CLOSE` can fire on legitimate teardown after we
      // already sampled enough rows — accept what we have. But if we parsed
      // nothing before it fired, the stream is truncated/malformed; surface it.
      if (e.code === 'ERR_STREAM_PREMATURE_CLOSE' && sampleRows.length > 0) {
        logger.debug(
          `JSON preview stream closed early after ${totalRows} rows`,
        );
      } else {
        throw new Error('Invalid JSON file. Please check the file format.');
      }
    }

    if (!sampleRows.length) {
      return [
        {
          columns: [],
          previewData: [],
          totalSampleRows: 0,
          totalRows: 0,
        },
      ];
    }

    const headerSet = new Set<string>();
    for (const row of sampleRows) {
      for (const key of Object.keys(row)) {
        headerSet.add(key);
      }
    }
    const headers = Array.from(headerSet);

    const columns = detectColumnTypesFromObjects(headers, sampleRows, {
      maxRowsToParse,
      autoSelectFieldTypes,
    });

    if (normalizeNested) {
      for (const col of columns) {
        const parts = col.column_name.split('_');
        if (parts.length > 1) {
          col.meta.path = parts;
        }
      }
    }

    return [
      {
        columns,
        previewData: sampleRows.slice(0, 20),
        totalSampleRows: sampleRows.length,
        totalRows,
      },
    ];
  }

  async *streamRows(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
    columns: FileImportColumn[],
  ): AsyncGenerator<ImportRow, void, undefined> {
    const normalizeNested = parserConfig.normalizeNested ?? true;

    const colPaths: Record<string, string[]> = {};
    for (const col of columns) {
      colPaths[col.column_name] = col.path ||
        col.meta?.path || [col.column_name];
    }

    // Peek to determine if array or single object
    const { isArray, stream } = await peekJsonType(readStream);

    // If not an array, wrap it: { ... } → [{ ... }]
    const jsonStream = isArray ? stream : wrapAsArray(stream);
    const pipeline = jsonStream.pipe(parser()).pipe(streamArray()) as Transform;

    // Don't swallow ERR_STREAM_PREMATURE_CLOSE here — a mid-stream abort
    // during import must surface so partial-success stats are reported
    // instead of a silent "completed" with truncated data.
    for await (const { value } of pipeline as AsyncIterable<{
      key: number;
      value: any;
    }>) {
      yield this.transformJsonValue(value, normalizeNested, colPaths);
    }
  }

  private transformJsonValue(
    value: any,
    normalizeNested: boolean,
    colPaths: Record<string, string[]>,
  ): ImportRow {
    if (normalizeNested) {
      const flat = flattenObject(value);
      const record: ImportRow = {};
      for (const colName of Object.keys(colPaths)) {
        record[colName] = flat[colName] ?? null;
      }
      return record;
    }

    const record: ImportRow = {};
    for (const [colName, path] of Object.entries(colPaths)) {
      let val: any = value;
      for (const segment of path) {
        val = val?.[segment];
      }
      if (val !== null && val !== undefined && typeof val === 'object') {
        record[colName] = JSON.stringify(val);
      } else {
        record[colName] = val ?? null;
      }
    }
    return record;
  }
}
