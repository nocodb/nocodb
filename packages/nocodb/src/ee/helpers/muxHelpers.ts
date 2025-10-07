import { Logger } from '@nestjs/common';
import axios from 'axios';
import { ExternalError, ExternalTimeout, NcError } from '~/helpers/catchError';

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
      NcError.externalError(e.response.data.error);
    }

    if (e?.message.includes('timeout')) {
      NcError.externalTimeOut(
        'External source taking long to respond. Reconsider sorts/filters for this view and confirm if source is accessible.',
      );
    }

    logger.error({
      query,
      sourceId,
      msg: e.message,
    });

    NcError.externalError(
      'Error running query on external source. Confirm if source is accessible.',
    );
  }
}
