import { enumColors } from 'nocodb-sdk';
import type { SelectOptionType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { Column, View } from '~/models';
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
        context,
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
      await NocoCache.set(
        context,
        `${CacheScope.COL_SELECT_OPTION}:${d.id}`,
        d,
      );
      await NocoCache.appendToList(
        context,
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
        context,
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
        context,
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
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.COL_SELECT_OPTION,
      [fk_column_id],
    );
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
        context,
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
      : {
          options: [],
        };
  }

  /**
   * Append-only option creation for typecast writes. Reads the current option
   * list from the meta DB (never the cache) and inserts only missing titles, so
   * a stale cached list can't drop options another process added.
   */
  public static async appendMissing(
    context: NcContext,
    column: Pick<Column, 'id' | 'dt' | 'dtxp' | 'fk_model_id'>,
    titles: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<SelectOption[]> {
    const existing: SelectOption[] = (
      await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_SELECT_OPTIONS,
        { condition: { fk_column_id: column.id } },
      )
    )
      .map(({ created_at: _c, updated_at: _u, ...o }) => new SelectOption(o))
      .sort((x, y) => (x.order ?? 0) - (y.order ?? 0));

    const known = new Set(existing.map((o) => o.title));
    const missing = [...new Set(titles)].filter(
      (t) => t != null && t !== '' && !known.has(t),
    );

    // Drop the cached list so the next read reloads it — also heals a stale
    // cache when the "missing" titles already exist in the DB.
    const invalidateList = () =>
      NocoCache.deepDel(
        context,
        `${CacheScope.COL_SELECT_OPTION}:${column.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );

    if (!missing.length) {
      await invalidateList();
      return existing;
    }

    let maxOrder = existing.reduce((m, o) => Math.max(m, o.order ?? 0), 0);
    await this.bulkInsert(
      context,
      missing.map((title, i) => ({
        fk_column_id: column.id,
        title,
        order: ++maxOrder,
        color: enumColors.get('light', existing.length + i),
      })),
      ncMeta,
    );
    await invalidateList();

    const { options } = await this.read(context, column.id, ncMeta);
    // Cached single-query SQL can embed option order (select sorts).
    await View.clearSingleQueryCache(context, column.fk_model_id, null, ncMeta);

    // dtxp mirrors the option list for text-backed selects; enum/set/native-enum
    // dtxp describes the physical DB type and must not change here.
    if (!['enum', 'set', 'USER-DEFINED'].includes(column.dt)) {
      const dtxp = options
        .map((o) => `'${o.title.replace(/'/g, "''")}'`)
        .join(',');
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        { dtxp },
        column.id,
      );
      await NocoCache.update(context, `${CacheScope.COLUMN}:${column.id}`, {
        dtxp,
      });
    }

    return options;
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
