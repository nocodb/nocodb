import type { NcContext } from 'nocodb-sdk';
import { MetaTable } from '~/cli';
import Noco from '~/Noco';

export interface IRowColorCondition {
  id: string;
  fk_view_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  color: string;
  nc_order: number;
  is_set_as_background: boolean;
}
export default class RowColorCondition implements IRowColorCondition {
  id: string;
  fk_view_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  color: string;
  nc_order: number;
  is_set_as_background: boolean;

  constructor(data: RowColorCondition) {
    Object.assign(this, data);
  }

  static async getById(context: NcContext, id: string) {
    return new RowColorCondition(
      await Noco.ncMeta.metaGet(
        context.workspace_id,
        context.base_id,
        MetaTable.ROW_COLOR_CONDITIONS,
        id,
      ),
    );
  }

  static async getByViewId(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    return (
      await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.ROW_COLOR_CONDITIONS,
        {
          condition: {
            fk_view_id,
          },
        },
      )
    ).map((row) => new RowColorCondition(row));
  }
}
