import type { SelectOptionType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';

export default class SelectOption implements SelectOptionType {
  id: string;
  title: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_column_id: string;
  color: string;
  order: number;

  constructor(data: Partial<SelectOption>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    data: Partial<SelectOption>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'id',
      'title',
      'fk_column_id',
      'color',
      'order',
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

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_SELECT_OPTIONS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (selectOption) => {
      await NocoCache.appendToList(
        CacheScope.COL_SELECT_OPTION,
        [data.fk_column_id],
        `${CacheScope.COL_SELECT_OPTION}:${id}`,
      );
      return selectOption;
    });
  }

  public static async bulkInsert(
    context: NcContext,
    data: Partial<SelectOption>[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = [];

    for (const d of data) {
      const tempObj = extractProps(d, [
        'id',
        'title',
        'fk_column_id',
        'color',
        'order',
      ]);
      insertObj.push(tempObj);
    }

    if (!insertObj.length) {
      return false;
    }

    const bulkData = await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_SELECT_OPTIONS,
      insertObj,
    );

    for (const d of bulkData) {
      await NocoCache.set(`${CacheScope.COL_SELECT_OPTION}:${d.id}`, d);
      await NocoCache.appendToList(
        CacheScope.COL_SELECT_OPTION,
        [d.fk_column_id],
        `${CacheScope.COL_SELECT_OPTION}:${d.id}`,
      );
    }

    return true;
  }

  public static async get(
    context: NcContext,
    selectOptionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SelectOption> {
    let data =
      selectOptionId &&
      (await NocoCache.get(
        `${CacheScope.COL_SELECT_OPTION}:${selectOptionId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_SELECT_OPTIONS,
        selectOptionId,
      );
      await NocoCache.set(
        `${CacheScope.COL_SELECT_OPTION}:${selectOptionId}`,
        data,
      );
    }
    return data && new SelectOption(data);
  }

  public static async read(
    context: NcContext,
    fk_column_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.COL_SELECT_OPTION, [
      fk_column_id,
    ]);
    let { list: options } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !options.length) {
      options = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_SELECT_OPTIONS,
        { condition: { fk_column_id } },
      );
      await NocoCache.setList(
        CacheScope.COL_SELECT_OPTION,
        [fk_column_id],
        options.map(({ created_at, updated_at, ...others }) => others),
      );
    }

    return options?.length
      ? {
          options: options
            .map(({ created_at, updated_at, ...c }) => new SelectOption(c))
            .sort((x, y) => x.order - y.order),
        }
      : null;
  }

  public static async find(
    context: NcContext,
    fk_column_id: string,
    title: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SelectOption> {
    const data = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_SELECT_OPTIONS,
      {
        fk_column_id,
        title,
      },
    );

    return data && new SelectOption(data);
  }
}
