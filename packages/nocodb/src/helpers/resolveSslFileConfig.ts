import fs from 'fs';
import { promisify } from 'util';
import { NcError } from '~/helpers/ncError';
import { validateDbConnectionSslPaths } from '~/helpers/validateDbConnectionHost';

const readFileAsync = promisify(fs.readFile);

/**
 * Resolve user-supplied SSL `*FilePath` references into inline cert contents on
 * the connection config, mutating it in place. Shared by the CE and EE
 * SqlClientFactory so the read happens in exactly one place.
 *
 * Two protections live here (single chokepoint for every external-DB connect):
 *
 *  1. Policy guard — {@link validateDbConnectionSslPaths} rejects file-path SSL
 *     where it is an untrusted-input risk (always on Cloud; self-host opt-in via
 *     `NC_DISABLE_DB_SSL_FILE_PATHS`). It runs before any `fs` access, so a
 *     blocked request never touches the filesystem.
 *
 *  2. Uniform error — a read failure throws a single, code-less error, so the
 *     response can't distinguish "file missing" (`ENOENT`) from any other read
 *     failure. This closes the error-channel half of the file-existence oracle;
 *     the timing channel is flattened at the controller (withMinResponseTime).
 */
export async function resolveSslFileConfig(
  connectionConfig: any,
): Promise<void> {
  const ssl = connectionConfig?.connection?.ssl;
  if (!ssl || typeof ssl !== 'object') return;

  // (1) policy guard — may throw before any filesystem access
  validateDbConnectionSslPaths(ssl);

  // (2) read with a uniform, code-less failure (never leak ENOENT vs EACCES …)
  const readSslFile = async (filePath: string): Promise<string> => {
    try {
      return (await readFileAsync(filePath)).toString();
    } catch {
      NcError.badRequest('Failed to load SSL certificate configuration');
    }
  };

  if (ssl.caFilePath) {
    ssl.ca = await readSslFile(ssl.caFilePath);
    delete ssl.caFilePath;
  }
  if (ssl.keyFilePath) {
    ssl.key = await readSslFile(ssl.keyFilePath);
    delete ssl.keyFilePath;
  }
  if (ssl.certFilePath) {
    ssl.cert = await readSslFile(ssl.certFilePath);
    delete ssl.certFilePath;
  }
}
