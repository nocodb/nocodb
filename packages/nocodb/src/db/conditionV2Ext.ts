import type { NcContext } from 'nocodb-sdk';
import type Column from '~/models/Column';
import type Filter from '~/models/Filter';

export const handleCurrentUserFilter = (
  _context: NcContext,
  _param: {
    column: Column;
    filter: Filter;
    setVal: (val: string) => void;
  },
) => {};
