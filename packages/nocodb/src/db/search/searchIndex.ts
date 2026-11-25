import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { Model } from '~/models';

// Search indexes are EE; EE shadows this file.

export function isSearchIndexTracked(_model: Model) {
  return false;
}

export async function cleanupDeletedSearchIndex(
  _context: NcContext,
  _model: Model,
  _knex: Knex,
) {}
