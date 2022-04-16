import Noco from '../../lib/noco/Noco';
import NocoCache from '../noco-cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';

export default class SingleSelectColumn {
  title: string;
  fk_column_id: string;

  constructor(data: Partial<SingleSelectColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<SingleSelectColumn>,
    ncMeta = Noco.ncMeta
  ) {
    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.COL_SELECT_OPTIONS,
      {
        fk_column_id: data.fk_column_id,
        title: data.title
      }
    );

    await NocoCache.appendToList(
      CacheScope.COL_SELECT_OPTION,
      [data.fk_column_id],
      `${CacheScope.COL_SELECT_OPTION}:${id}`
    );

    return this.get(id, ncMeta);
  }

  public static async get(
    selectOptionId: string,
    ncMeta = Noco.ncMeta
  ): Promise<SingleSelectColumn> {
    let data =
      selectOptionId &&
      (await NocoCache.get(
        `${CacheScope.COL_SELECT_OPTION}:${selectOptionId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.COL_SELECT_OPTIONS,
        selectOptionId
      );
      await NocoCache.set(
        `${CacheScope.COL_SELECT_OPTION}:${selectOptionId}`,
        data
      );
    }
    return data && new SingleSelectColumn(data);
  }

  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let options = await NocoCache.getList(CacheScope.COL_SELECT_OPTION, [
      columnId
    ]);
    if (!options.length) {
      options = await ncMeta.metaList2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_SELECT_OPTIONS,
        { condition: { fk_column_id: columnId } }
      );
      await NocoCache.setList(
        CacheScope.COL_SELECT_OPTION,
        [columnId],
        options
      );
    }

    return options?.length
      ? {
          options: options.map(c => new SingleSelectColumn(c))
        }
      : null;
  }

  id: string;
}
