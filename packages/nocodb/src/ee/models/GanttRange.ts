import GanttRangeCE from 'src/models/GanttRange';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';

export default class GanttRange extends GanttRangeCE {
  constructor(data: Partial<GanttRange>) {
    super(data);
    Object.assign(this, data);
  }

  public static async bulkInsert(
    context: NcContext,
    data: Partial<GanttRange>[],
    ncMeta = Noco.ncMeta,
  ) {
    const ranges: {
      fk_start_col_id?: string;
      fk_end_col_id?: string;
      fk_dependency_col_id?: string;
      dependency_direction?: string;
      fk_view_id?: string;
    }[] = [];

    for (const d of data) {
      const tempObj = extractProps(d, [
        'fk_start_col_id',
        'fk_end_col_id',
        'fk_dependency_col_id',
        'dependency_direction',
        'fk_view_id',
      ]);
      ranges.push(tempObj);
    }

    if (!ranges.length) return false;

    const fkViewId = ranges[0].fk_view_id;
    if (fkViewId) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.GANTT_VIEW_RANGE}:${fkViewId}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const insertObj of ranges) {
      const insertData = await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.GANTT_VIEW_RANGE,
        insertObj,
      );

      await NocoCache.set(
        context,
        `${CacheScope.GANTT_VIEW_RANGE}:${insertData.id}`,
        insertData,
      );

      await NocoCache.appendToList(
        context,
        CacheScope.GANTT_VIEW_RANGE,
        [insertData.fk_view_id],
        `${CacheScope.GANTT_VIEW_RANGE}:${insertData.id}`,
      );
    }

    return true;
  }

  public static async read(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.GANTT_VIEW_RANGE,
      [fk_view_id],
    );
    let { list: ranges } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !ranges.length) {
      ranges = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.GANTT_VIEW_RANGE,
        { condition: { fk_view_id } },
      );
      await NocoCache.setList(
        context,
        CacheScope.GANTT_VIEW_RANGE,
        [fk_view_id],
        ranges.map(({ created_at, updated_at, ...others }) => others),
      );
    }

    return ranges?.length
      ? {
          ranges: ranges.map(
            ({ created_at, updated_at, ...c }) => new GanttRange(c),
          ),
        }
      : null;
  }

  public static async delete(
    rangeId: string,
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ) {
    const range = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.GANTT_VIEW_RANGE,
      {
        id: rangeId,
      },
    );

    if (!range) return false;

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.GANTT_VIEW_RANGE,
      rangeId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.GANTT_VIEW_RANGE}:${range.fk_view_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    await NocoCache.del(
      context,
      `${CacheScope.GANTT_VIEW_RANGE}:${rangeId}`,
    );

    return true;
  }

  public static async find(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GanttRange> {
    const data = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.GANTT_VIEW_RANGE,
      {
        fk_view_id,
      },
    );

    return data && new GanttRange(data);
  }

  public static async IsColumnBeingUsedAsRange(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GANTT_VIEW_RANGE,
      {
        xcCondition: {
          _or: [
            {
              fk_start_col_id: {
                eq: columnId,
              },
            },
            {
              fk_end_col_id: {
                eq: columnId,
              },
            },
            {
              fk_dependency_col_id: {
                eq: columnId,
              },
            },
          ],
        },
      },
    );
  }
}
