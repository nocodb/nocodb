import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models/index';
import { NcError } from '~/helpers/catchError';

export default class AIColumn {
  id: string;

  fk_integration_id?: string;
  model?: string;

  fk_workspace_id?: string;
  base_id: string;
  fk_column_id: string;
  prompt: string;
  prompt_raw: string;
  error?: string;

  rich_text?: boolean;
  auto_generate?: boolean;

  constructor(data: Partial<AIColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    AIColumn: Partial<AIColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(AIColumn, [
      'fk_integration_id',
      'model',
      'fk_workspace_id',
      'base_id',
      'fk_column_id',
      'prompt',
      'prompt_raw',
      'error',
      'rich_text',
      'auto_generate',
    ]);

    const column = await Column.get(
      context,
      {
        colId: insertObj.fk_column_id,
      },
      ncMeta,
    );

    if (!column) {
      NcError.fieldNotFound(insertObj.fk_column_id);
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_AI,
      insertObj,
    );

    return this.read(context, AIColumn.fk_column_id, ncMeta);
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_AI}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_AI,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_AI}:${columnId}`, column);
    }

    return column ? new AIColumn(column) : null;
  }

  static async update(
    context: NcContext,
    columnId: string,
    AIColumn: Partial<AIColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(AIColumn, [
      'prompt',
      'prompt_raw',
      'error',
      'rich_text',
      'auto_generate',
    ]);

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_AI,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(`${CacheScope.COL_AI}:${columnId}`, updateObj);
  }
}
