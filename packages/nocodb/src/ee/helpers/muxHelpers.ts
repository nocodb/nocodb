import { Logger } from '@nestjs/common';
import axios from 'axios';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('MuxHelpers');

export async function runExternal(
  query: string | string[],
  config: { dbMux: string; sourceId: string; [key: string]: any },
  extraOptions: {
    raw?: boolean;
  } = {},
) {
  const { dbMux, sourceId, ...rest } = config;

  if (config.upgrader === true) {
    config.source.upgraderQueries.push(
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
    // Timeout check first — covers both axios timeout (no response) and
    // sql-executor timeout errors (KnexTimeoutError with message containing "timeout")
    if (e?.message?.includes('timeout')) {
      NcError._.externalTimeOut(
        'External source taking long to respond. Reconsider sorts/filters for this view and confirm if source is accessible.',
      );
    }

    // Network-level errors reaching the sql-executor (connection refused,
    // reset, DNS failure, etc.) are transient infrastructure issues
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
    if (e?.code && networkErrorCodes.includes(e.code)) {
      NcError._.externalTimeOut(
        'External source is not reachable. Confirm if source is accessible.',
      );
    }

    // Only extract DB-specific errors for actual DatabaseError types
    // (e.g. PG/MySQL errors with proper error codes)
    if (e.response?.data?.error) {
      const { _errorType } = e.response.data.error;
      if (_errorType === 'DatabaseError') {
        NcError._.externalError(
          DBErrorExtractor.get().extractDbError(e.response.data.error, {
            clientType: config.client,
            ignoreDefault: false,
          }) as any as Error,
        );
      }
    }

    logger.error({
      query,
      sourceId,
      msg: e.message,
    });

    NcError._.externalError(
      'Error running query on external source. Confirm if source is accessible.',
    );
  }
}
