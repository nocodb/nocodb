import { MetaTable } from 'src/cli';
import Noco from 'src/Noco';
import type { NcContext } from 'nocodb-sdk';

export interface IRowColorCondition {
  id: string;
  fk_view_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  color: string;
  is_set_as_background: boolean;
}
export default class RowColorCondition implements IRowColorCondition {
  id: string;
  fk_view_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  color: string;
  is_set_as_background: boolean;

  constructor(data: RowColorCondition) {
    Object.assign(this, data);
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
