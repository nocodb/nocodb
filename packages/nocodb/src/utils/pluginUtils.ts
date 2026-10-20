import path from 'path';
import os from 'os';
import axios from 'axios';
import { OperationSource } from 'nocodb-sdk';
import type fs from 'fs';
import type { AxiosResponse, RawAxiosRequestHeaders } from 'axios';
import { getFilteredAgents } from '~/utils/ssrf';
import { NcError } from '~/helpers/ncError';
import { NC_ATTACHMENT_FIELD_SIZE } from '~/constants';

export function generateTempFilePath() {
  return path.join(os.tmpdir(), 'temp.txt');
}

export async function waitForStreamClose(
  stream: fs.WriteStream,
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream
      .once('finish', () => {
        resolve();
      })
      .once('error', (err) => {
        reject(err);
      });
    stream.end();
  });
}

const isSizeCapError = (e) => /maxContentLength/.test(e?.message);

const fileTooLarge = (): never =>
  NcError.get().invalidRequestBody(
    `File is too large. Maximum allowed size is ${(
      NC_ATTACHMENT_FIELD_SIZE /
      (1024 * 1024)
    ).toFixed(2)} MB`,
  );

// Downloads `url` for `fileCreateByUrl` and hands it to `write`. Source
// failures come back as 400s, so a storage failure is never blamed on the URL.
export async function fetchSourceFile<T>(
  url: string,
  { buffer, headers }: { buffer?: boolean; headers?: RawAxiosRequestHeaders },
  write: (response: AxiosResponse) => Promise<T>,
): Promise<T> {
  let response: AxiosResponse;
  try {
    response = await axios.get(url, {
      ...getFilteredAgents({ url, source: OperationSource.PLUGINS }),
      responseType: buffer ? 'arraybuffer' : 'stream',
      maxContentLength: NC_ATTACHMENT_FIELD_SIZE,
      headers,
    });
  } catch (e) {
    if (e?.response?.status) {
      NcError.badRequest(
        `Could not fetch the file: the source responded with HTTP ${e.response.status}`,
      );
    }
    if (isSizeCapError(e)) fileTooLarge();
    NcError._.storageFileCreateError(
      `Failed to create file from URL: ${e?.message}`,
    );
  }

  // A streamed body hits the size cap mid-write, inside the storage upload.
  let streamError;
  if (!buffer) response.data.once('error', (e) => (streamError = e));

  try {
    return await write(response);
  } catch (e) {
    if (isSizeCapError(streamError)) fileTooLarge();
    throw e;
  }
}
