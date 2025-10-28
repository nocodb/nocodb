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
    if (e.response?.data?.error) {
      const { _errorType } = e.response.data.error;
      if (_errorType !== 'DatabaseError') {
        NcError._.externalError(e.response.data.error);
      } else {
        NcError._.externalError(
          DBErrorExtractor.get().extractDbError(e.response.data.error, {
            clientType: config.client,
            ignoreDefault: false,
          }) as any as Error,
        );
      }
    }

    if (e?.message.includes('timeout')) {
      NcError._.externalTimeOut(
        'External source taking long to respond. Reconsider sorts/filters for this view and confirm if source is accessible.',
      );
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
