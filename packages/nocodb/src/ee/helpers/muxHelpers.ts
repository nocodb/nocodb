import { Logger } from '@nestjs/common';
import axios from 'axios';
import { ExternalError } from '~/helpers/catchError';

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
    const { data } = await axios.post(`${dbMux}/query/${sourceId}`, {
      query,
      config: rest,
      ...extraOptions,
    });
    return data;
  } catch (e) {
    if (e.response?.data?.error) {
      throw new ExternalError(e.response.data.error);
    }

    logger.error({
      query,
      sourceId,
      msg: e.message,
    });

    throw new ExternalError(
      new Error(
        'Error running external query, please confirm the source is working correctly.',
      ),
    );
  }
}
