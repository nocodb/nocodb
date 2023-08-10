import type { SelectOptionType } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class SelectOption implements SelectOptionType {
  id: string;
  title: string;
  fk_column_id: string;
  color: string;
  order: number;

  constructor(data: Partial<SelectOption>) {
    Object.assign(this, data);
  }

  public static async insert(
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

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.COL_SELECT_OPTIONS,
      insertObj,
    );

    await NocoCache.appendToList(
      CacheScope.COL_SELECT_OPTION,
      [data.fk_column_id],
      `${CacheScope.COL_SELECT_OPTION}:${id}`,
    );

    return this.get(id, ncMeta);
  }

  public static async bulkInsert(
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

    const bulkData = await ncMeta.bulkMetaInsert(
      null,
      null,
      MetaTable.COL_SELECT_OPTIONS,
      insertObj,
    );

    for (const d of bulkData) {
      await NocoCache.appendToList(
        CacheScope.COL_SELECT_OPTION,
        [d.fk_column_id],
        `${CacheScope.COL_SELECT_OPTION}:${d.id}`,
      );
      await NocoCache.set(`${CacheScope.COL_SELECT_OPTION}:${d.id}`, d);
    }

    return true;
  }

  public static async get(
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
        null,
        null,
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

  public static async read(fk_column_id: string, ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList(CacheScope.COL_SELECT_OPTION, [
      fk_column_id,
    ]);
    let { list: options } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !options.length) {
      options = await ncMeta.metaList2(
        null, //,
        null, //model.db_alias,
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
    fk_column_id: string,
    title: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SelectOption> {
    const data = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.COL_SELECT_OPTIONS,
      {
        fk_column_id,
        title,
      },
    );

    return data && new SelectOption(data);
  }
}
