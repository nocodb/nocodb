import type { NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';

export async function getBaseSchema(
  _context: NcContext,
  _ncMeta = Noco.ncMeta,
) {
  // Not Implemented
}

export async function cleanBaseSchemaCacheForBase(_baseId: string) {
  // Not Implemented
}

export async function cleanBaseSchemaCacheForWorkspace(_workspaceId: string) {
  // Not Implemented
}
