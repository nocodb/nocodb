import { type NcContext, parseProp } from 'nocodb-sdk';
import type { LinksColumn } from '~/models';
import { type Column } from '~/models';
import Noco from '~/Noco';

export const getCustomLinkParam = async (
  _context: NcContext,
  {
    col,
  }: { col: Column; colOptions: LinksColumn; mapId?: (id: string) => string },
  _ncMeta = Noco.ncMeta,
) => {
  if (!parseProp(col.meta).custom) {
    return;
  }
};
