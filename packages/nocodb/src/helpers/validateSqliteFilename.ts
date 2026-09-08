import fs from 'fs';
import path from 'path';
import { NcError } from '~/helpers/catchError';
import { getToolDir } from '~/utils/nc-config';

/**
 * Resolve a path to its real filesystem target.
 *
 * `path.resolve` only normalises the string, so aliases that the kernel
 * resolves elsewhere — `/proc/self/cwd/noco.db`, `/proc/self/root/<abs>`, any
 * symlink — compare unequal to the protected path while opening the very same
 * file. Canonicalise the deepest existing ancestor (the target itself need not
 * exist: creating a new SQLite file is legitimate) and re-append the rest.
 */
function canonicalize(rawPath: string): string {
  let current = path.resolve(rawPath);
  const tail: string[] = [];

  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...tail);
    } catch {
      const parent = path.dirname(current);
      // reached the root without finding anything that exists
      if (parent === current) return path.resolve(rawPath);
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Reject SQLite filenames that point at NocoDB's own state (`noco.db`,
 * `nc_data.db`, `nc_minimal_dbs/`). SQLite is not a supported production
 * database on cloud; self-host operators are trusted for everything else.
 *
 * Returns the canonical path so what gets persisted is the file that will
 * actually be opened — a later re-validation of the stored config then reaches
 * the same verdict as this one.
 */
export function validateSqliteFilename(rawFilename: unknown): string {
  if (typeof rawFilename !== 'string' || rawFilename.length === 0) {
    NcError.badRequest('SQLite filename is required');
  }
  if ((rawFilename as string).includes('\0')) {
    NcError.badRequest('Invalid SQLite filename');
  }
  const resolved = canonicalize(rawFilename as string);
  const toolDir = canonicalize(getToolDir());

  if (
    resolved === path.join(toolDir, 'noco.db') ||
    resolved === path.join(toolDir, 'nc_data.db')
  ) {
    NcError.badRequest('Access to NocoDB internal database is not allowed');
  }
  const minimalDbs = path.join(toolDir, 'nc_minimal_dbs');
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
