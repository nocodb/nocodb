import path from 'path';
import { NcError } from '~/helpers/catchError';
import { getToolDir } from '~/utils/nc-config';

/**
 * Reject SQLite filenames that point at NocoDB's own state (`noco.db`,
 * `nc_data.db`, `nc_minimal_dbs/`). SQLite is not a supported production
 * database on cloud; self-host operators are trusted for everything else.
 */
export function validateSqliteFilename(rawFilename: unknown): string {
  if (typeof rawFilename !== 'string' || rawFilename.length === 0) {
    NcError.badRequest('SQLite filename is required');
  }
  if ((rawFilename as string).includes('\0')) {
    NcError.badRequest('Invalid SQLite filename');
  }
  const resolved = path.resolve(rawFilename as string);
  const toolDir = path.resolve(getToolDir());

  if (
    resolved === path.resolve(toolDir, 'noco.db') ||
    resolved === path.resolve(toolDir, 'nc_data.db')
  ) {
    NcError.badRequest('Access to NocoDB internal database is not allowed');
  }
  const minimalDbs = path.resolve(toolDir, 'nc_minimal_dbs');
  if (resolved === minimalDbs || resolved.startsWith(minimalDbs + path.sep)) {
    NcError.badRequest('Access to NocoDB tenant databases is not allowed');
  }
  return resolved;
}

export function extractSqliteFilename(config: unknown): string | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const c: any = config;
  return (
    c?.connection?.filename ?? c?.connection?.connection?.filename ?? undefined
  );
}

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
