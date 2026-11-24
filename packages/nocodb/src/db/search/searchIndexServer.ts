import type { NcContext } from '~/interface/config';

/** The database server a table's index lives on: one here. */
export async function searchIndexServerKey(_context: NcContext) {
  return 'nc_data';
}
