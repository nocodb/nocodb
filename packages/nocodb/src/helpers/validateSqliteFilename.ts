import path from 'path';
import { NcError } from '~/helpers/catchError';
import { getToolDir } from '~/utils/nc-config';

/**
 * Validate an externally-supplied SQLite filename.
 *
 * Default: only paths under `${toolDir}/external_sqlite` (or the directory
 * named by `NC_SQLITE_SANDBOX_DIR`) are accepted. The NocoDB metadata DB
 * (noco.db / nc_data.db) and the `nc_minimal_dbs/` tenant store are always
 * rejected. Set `NC_ALLOW_EXTERNAL_SQLITE_PATHS=true` to disable the
 * sandbox requirement.
 */
export function validateSqliteFilename(rawFilename: unknown): string {
  if (typeof rawFilename !== 'string' || rawFilename.length === 0) {
    NcError.badRequest('SQLite filename is required');
  }
  if ((rawFilename as string).includes('\0')) {
    NcError.badRequest('Invalid SQLite filename');
  }
  const filename = rawFilename as string;

  const resolved = path.resolve(filename);
  const toolDir = path.resolve(getToolDir());

  // Always reject NocoDB internal databases regardless of sandbox mode
  const forbidden = [
    path.resolve(toolDir, 'noco.db'),
    path.resolve(toolDir, 'nc_data.db'),
  ];
  if (forbidden.includes(resolved)) {
    NcError.badRequest('Access to NocoDB internal database is not allowed');
  }
  const minimalDbs = path.resolve(toolDir, 'nc_minimal_dbs');
  if (resolved === minimalDbs || resolved.startsWith(minimalDbs + path.sep)) {
    NcError.badRequest('Access to NocoDB tenant databases is not allowed');
  }

  if (process.env.NC_ALLOW_EXTERNAL_SQLITE_PATHS === 'true') {
    return resolved;
  }

  // Sandbox: must be under toolDir/external_sqlite or a configured allow dir
  const allowDir = process.env.NC_SQLITE_SANDBOX_DIR
    ? path.resolve(process.env.NC_SQLITE_SANDBOX_DIR)
    : path.resolve(toolDir, 'external_sqlite');
  if (resolved !== allowDir && !resolved.startsWith(allowDir + path.sep)) {
    NcError.badRequest(
      `SQLite filename must be inside the sandbox directory (${allowDir})`,
    );
  }
  return resolved;
}

/**
 * Extracts a sqlite filename from a config object regardless of nesting
 * (NocoDB accepts both `config.connection.filename` and
 * `config.connection.connection.filename` forms).
 */
export function extractSqliteFilename(config: unknown): string | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const c: any = config;
  return (
    c?.connection?.filename ?? c?.connection?.connection?.filename ?? undefined
  );
}

/**
 * Walks a config object and applies validateSqliteFilename to any
 * sqlite filename it finds. Mutates the resolved path back in place so
 * downstream consumers see the canonical (resolved) filename.
 */
export function validateAndNormalizeSqliteConfig(
  config: unknown,
  subType?: string,
): void {
  if (subType && subType !== 'sqlite3') return;
  if (!config || typeof config !== 'object') return;
  const c: any = config;

  const inner = c?.connection?.connection;
  if (inner && typeof inner === 'object' && inner.filename != null) {
    inner.filename = validateSqliteFilename(inner.filename);
    return;
  }
  const conn = c?.connection;
  if (conn && typeof conn === 'object' && conn.filename != null) {
    conn.filename = validateSqliteFilename(conn.filename);
  }
}
