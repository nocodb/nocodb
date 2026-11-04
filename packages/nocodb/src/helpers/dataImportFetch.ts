import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { NC_DATA_IMPORT_FILE_SIZE } from '~/constants';
import { NcError } from '~/helpers/catchError';

const DEFAULT_DATA_IMPORT_URL_TIMEOUT = 2 * 60 * 1000;

export const getDataImportUrlTimeout = () => {
  const parsed = parseInt(process.env.NC_DATA_IMPORT_URL_TIMEOUT, 10);
  return parsed > 0 ? parsed : DEFAULT_DATA_IMPORT_URL_TIMEOUT;
};

/**
 * Fetch a remote file for import, capped at the import file size limit and a
 * total deadline. axios `timeout` alone only fires on an idle socket, so a
 * slow but never-ending response needs the abort signal.
 */
export async function fetchForDataImport(
  config: AxiosRequestConfig,
): Promise<AxiosResponse> {
  const timeout = getDataImportUrlTimeout();
  const signal = AbortSignal.timeout(timeout);
  try {
    return await axios({
      ...config,
      timeout,
      signal,
      maxContentLength: NC_DATA_IMPORT_FILE_SIZE,
      maxBodyLength: NC_DATA_IMPORT_FILE_SIZE,
    });
  } catch (e) {
    if (axios.isAxiosError(e) && e.message?.includes('maxContentLength')) {
      NcError.badRequest(
        `File exceeds the import size limit of ${Math.round(
          NC_DATA_IMPORT_FILE_SIZE / (1024 * 1024),
        )} MB`,
      );
    }
    if (
      signal.aborted ||
      (axios.isAxiosError(e) &&
        (e.code === 'ETIMEDOUT' ||
          (e.code === 'ECONNABORTED' && e.message?.startsWith('timeout'))))
    ) {
      NcError.badRequest(
        `Timed out fetching the file after ${Math.round(timeout / 1000)}s`,
      );
    }
    throw e;
  }
}
