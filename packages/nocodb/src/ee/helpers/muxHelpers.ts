import { Logger } from '@nestjs/common';
import axios from 'axios';
import { ExternalError, ExternalTimeout } from '~/helpers/catchError';

const logger = new Logger('MuxHelpers');

export async function runExternal(
  query: string | string[],
  config: { dbMux: string; sourceId: string; [key: string]: any },
  extraOptions: {
    raw?: boolean;
  } = {},
) {
  const { dbMux, sourceId, ...rest } = config;

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
      throw new ExternalError(e.response.data.error);
    }

    if (e?.message.includes('timeout')) {
      throw new ExternalTimeout(
        new Error(
          'External source taking long to respond. Reconsider sorts/filters for this view and confirm if source is accessible.',
        ),
      );
    }

    logger.error({
      query,
      sourceId,
      msg: e.message,
    });

    throw new ExternalError(
      new Error(
        'Error running query on external source. Confirm if source is accessible.',
      ),
    );
  }
}
