import { Logger } from '@nestjs/common';
import { NcBaseError } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';
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
const logger = new Logger('RowColorCondition');
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

  static async getById(context: NcContext, id: string, ncMeta = Noco.ncMeta) {
    const condition = await ncMeta.metaGet(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      id,
    );
    if (condition) {
      return new RowColorCondition(condition);
    } else {
      return undefined;
    }
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

  static async delete(context: NcContext, id: string, ncMeta = Noco.ncMeta) {
    const ncMetaTrans = await ncMeta.startTransaction();

    try {
      await ncMetaTrans.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.ROW_COLOR_CONDITIONS,
        {
          id: id,
        },
      );

      await ncMetaTrans.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          fk_row_color_condition_id: id,
        },
      );
      await ncMetaTrans.commit();
    } catch (ex) {
      await ncMetaTrans.rollback();
      if (ex instanceof NcError || ex instanceof NcBaseError) throw ex;
      logger.error('Failed to remove Row Colouring', ex);
      NcError.get(context).internalServerError(
        'Failed to remove Row Colouring',
      );
    }
  }
}
