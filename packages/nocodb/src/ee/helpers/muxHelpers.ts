import { createInterface } from 'readline';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import type { ClientType } from 'nocodb-sdk';
import type { ExtDbConfig } from '~/db/CustomKnex';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('MuxHelpers');

export async function runExternal(
  query: string | string[],
  config: ExtDbConfig,
  extraOptions: {
    raw?: boolean;
  } = {},
): Promise<Record<string, any>[] | undefined> {
  const { dbMux, sourceId, ...rest } = config;

  if (config.upgrader === true) {
    config.source!.upgraderQueries!.push(
      ...(Array.isArray(query) ? query : [query]),
    );
    return;
  }

  try {
    const { data } = await axios.post(
      `${dbMux}/query/${sourceId}`,
      {
        query,
        config: rest,
        ...extraOptions,
      },
      {
        timeout: 45 * 1000,
      },
    );
    return data;
  } catch (e) {
    // Unwrap the real error from sql-executor response.
    // Axios wraps it: e.message = 'Request failed with status code 500',
    // e.code = 'ERR_BAD_RESPONSE'. The actual error is in e.response.data.error.
    const rawError = e.response?.data?.error;
    const errorMessage = rawError?.message || e?.message || '';
    const errorMessageLowerCase = `${errorMessage}`.toLowerCase();
    const errorType = rawError?._errorType;

    // Timeout check first — KnexTimeoutError from sql-executor or specific
    // timeout patterns. Avoid broad 'timeout' match to prevent false positives
    // (e.g. column named 'session_timeout' in a missing column error).
    if (
      errorType === 'KnexTimeoutError' ||
      errorMessageLowerCase.includes('timeout acquiring a connection') ||
      errorMessageLowerCase.includes('the pool is probably full')
    ) {
      NcError._.externalTimeOut(
        'External source taking long to respond. Reconsider sorts/filters for this view and confirm if source is accessible.',
      );
    }

    // Network-level connection errors — check both:
    // - e.code: when NocoDB instance can't reach sql-executor (no response)
    // - rawError.code: when sql-executor can't reach the external DB
    const networkErrorCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'ECONNABORTED',
      'EHOSTDOWN',
      'EPIPE',
      'EAI_AGAIN',
    ];
    const errorCode = rawError?.code || e?.code;
    if (errorCode && networkErrorCodes.includes(errorCode)) {
      NcError._.externalTimeOut(
        'External source is not reachable. Confirm if source is accessible.',
      );
    }

    // Extract DB-specific errors for actual DatabaseError types
    // (e.g. PG/MySQL errors with proper error codes like 42703)
    if (rawError && errorType === 'DatabaseError') {
      NcError._.externalError(
        DBErrorExtractor.get().extractDbError(rawError, {
          clientType: config.client as ClientType,
          ignoreDefault: false,
        }) as any as Error,
      );
    }

    logger.error({
      query,
      sourceId,
      msg: errorMessage,
    });

    NcError._.externalError(
      'Error running query on external source. Confirm if source is accessible.',
    );
  }
}

/**
 * Streams rows from an external source via the sql-executor NDJSON endpoint.
 * Yields one row at a time so the caller can batch as needed without loading
 * the full result set into memory.
 */
export async function* runExternalStream(
  query: string,
  config: ExtDbConfig,
): AsyncGenerator<Record<string, any>> {
  const { dbMux, sourceId, ...rest } = config;

  let response;
  try {
    response = await axios.post(
      `${dbMux}/stream/${sourceId}`,
      {
        query,
        config: rest,
      },
      {
        responseType: 'stream',
        timeout: 0, // no timeout — streaming can take a while for large datasets
      },
    );
  } catch (e) {
    const rawError = e.response?.data?.error;
    const errorMessage = rawError?.message || e?.message || '';

    logger.error({
      query,
      sourceId,
      msg: errorMessage,
    });

    NcError._.externalError(
      'Error streaming query on external source. Confirm if source is accessible.',
    );
  }

  const rl = createInterface({
    input: response.data,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const parsed = JSON.parse(line);

    // The stream endpoint sends errors as { __error: ... } NDJSON lines
    if (parsed.__error) {
      const errorMessage = parsed.__error?.message || 'Stream query failed';
      logger.error({ query, sourceId, msg: errorMessage });
      NcError._.externalError(
        'Error running query on external source. Confirm if source is accessible.',
      );
    }

    yield parsed;
  }
}
