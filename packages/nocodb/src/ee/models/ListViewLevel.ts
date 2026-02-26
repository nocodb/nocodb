import ListViewLevelCE from 'src/models/ListViewLevel';
import type { BoolType, ListViewLevelType, MetaType } from 'nocodb-sdk';
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
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import Column from '~/models/Column';
import ListViewColumn from '~/models/ListViewColumn';

export default class ListViewLevel extends ListViewLevelCE implements ListViewLevelType {
  id: string;
  fk_view_id: string;
  level?: number;
  fk_model_id?: string;
  fk_link_column_id?: string;
  enable_nested_records?: BoolType | boolean;
  fk_self_link_column_id?: string;
  wrap_headers?: BoolType | boolean;
  meta?: MetaType;

  constructor(data: ListViewLevel) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    levelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let level =
      levelId &&
      (await NocoCache.get(
        context,
        `${CacheScope.LIST_VIEW_LEVEL}:${levelId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!level) {
      level = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.LIST_VIEW_LEVELS,
        levelId,
      );

      level = prepareForResponse(level);

      await NocoCache.set(
        context,
        `${CacheScope.LIST_VIEW_LEVEL}:${levelId}`,
        level,
      );
    }

    return level && new ListViewLevel(level);
  }

  static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ListViewLevel[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.LIST_VIEW_LEVEL,
      [viewId],
    );
    let { list: levels } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !levels.length) {
      levels = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.LIST_VIEW_LEVELS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            level: 'asc',
          },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.LIST_VIEW_LEVEL,
        [viewId],
        levels,
      );
    }
    levels.sort(
      (a, b) =>
        (a.level != null ? a.level : Infinity) -
        (b.level != null ? b.level : Infinity),
    );
    return levels?.map((l) => new ListViewLevel(l));
  }

  /**
   * Find all levels across all list views in the base that reference a given table.
   */
  static async listByModelId(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ListViewLevel[]> {
    const levels = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_LEVELS,
      {
        condition: {
          fk_model_id: modelId,
        },
      },
    );
    return levels?.map((l) => new ListViewLevel(prepareForResponse(l)));
  }

  static async insert(
    context: NcContext,
    level: Partial<ListViewLevel>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(level, [
      'fk_view_id',
      'level',
      'fk_model_id',
      'fk_link_column_id',
      'enable_nested_records',
      'fk_self_link_column_id',
      'wrap_headers',
      'meta',
    ]);

    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_LEVELS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (insertedLevel) => {
      await NocoCache.appendToList(
        context,
        CacheScope.LIST_VIEW_LEVEL,
        [level.fk_view_id],
        `${CacheScope.LIST_VIEW_LEVEL}:${id}`,
      );
      return insertedLevel;
    });
  }

  static async update(
    context: NcContext,
    levelId: string,
    body: Partial<ListViewLevel>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'level',
      'fk_model_id',
      'fk_link_column_id',
      'enable_nested_records',
      'fk_self_link_column_id',
      'wrap_headers',
      'meta',
    ]);

    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_LEVELS,
      prepareForDb(updateObj),
      levelId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.LIST_VIEW_LEVEL}:${levelId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }

  static async delete(
    context: NcContext,
    levelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_LEVELS,
      levelId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.LIST_VIEW_LEVEL}:${levelId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  /**
   * Smart diff-based level configuration.
   *
   * - Levels matched by fk_model_id are kept (sorts/filters/columns preserved).
   * - Removed levels have their sorts/filters/columns cleaned up.
   * - New levels get fresh view columns created.
   * - Transitioning from no-levels to levels migrates root sorts/filters/columns
   *   to the level whose fk_model_id matches the view's root table.
   */
  static async bulkInsertOrUpdate(
    context: NcContext,
    viewId: string,
    levels: Partial<ListViewLevel>[],
    ncMeta = Noco.ncMeta,
  ): Promise<ListViewLevel[]> {
    const existingLevels = await this.list(context, viewId, ncMeta);

    // Build lookup: fk_model_id → existing level
    const oldByModelId = new Map<string, ListViewLevel>();
    for (const l of existingLevels) {
      if (l.fk_model_id) oldByModelId.set(l.fk_model_id, l);
    }

    const newModelIds = new Set(
      levels.map((l) => l.fk_model_id).filter(Boolean),
    );

    // Identify removed levels (old model not in new set)
    const removedLevels = existingLevels.filter(
      (l) => !l.fk_model_id || !newModelIds.has(l.fk_model_id),
    );

    // Clean up removed levels' associated data
    for (const level of removedLevels) {
      await this.cleanupLevelData(context, level.id, ncMeta);
      await this.delete(context, level.id, ncMeta);
    }

    // Process new levels: keep existing or insert new
    const result: ListViewLevel[] = [];
    for (const level of levels) {
      const existing = level.fk_model_id
        ? oldByModelId.get(level.fk_model_id)
        : undefined;

      if (existing) {
        // Level with same table exists — update properties, preserve data
        await this.update(
          context,
          existing.id,
          extractProps(level, [
            'level',
            'fk_link_column_id',
            'enable_nested_records',
            'fk_self_link_column_id',
            'wrap_headers',
            'meta',
          ]),
          ncMeta,
        );
        result.push(await this.get(context, existing.id, ncMeta));
      } else {
        // New level — insert and create view columns
        const inserted = await this.insert(
          context,
          { ...level, fk_view_id: viewId },
          ncMeta,
        );
        result.push(inserted);

        if (inserted?.id && level.fk_model_id) {
          await this.createColumnsForLevel(
            context,
            viewId,
            inserted.id,
            level.fk_model_id,
            ncMeta,
          );
        }
      }
    }

    return result;
  }

  /**
   * Delete all sorts, filters, and view columns associated with a level.
   */
  private static async cleanupLevelData(
    context: NcContext,
    levelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Clean up view columns
    const levelColumns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_COLUMNS,
      { condition: { fk_level_id: levelId } },
    );
    for (const col of levelColumns) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.LIST_VIEW_COLUMN}:${col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_COLUMNS,
      { fk_level_id: levelId },
    );

    // Clean up sorts
    const levelSorts = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      { condition: { fk_level_id: levelId } },
    );
    for (const sort of levelSorts) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.SORT}:${sort.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      { fk_level_id: levelId },
    );

    // Clean up filters
    const levelFilters = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      { condition: { fk_level_id: levelId } },
    );
    for (const filter of levelFilters) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.FILTER_EXP}:${filter.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      { fk_level_id: levelId },
    );
  }

  /**
   * Create ListViewColumn entries for a level's table columns.
   */
  private static async createColumnsForLevel(
    context: NcContext,
    viewId: string,
    levelId: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const columns = await Column.list(
      context,
      { fk_model_id: modelId },
      ncMeta,
    );

    let order = 1;
    for (const col of columns) {
      await ListViewColumn.insert(
        context,
        {
          fk_view_id: viewId,
          fk_column_id: col.id,
          fk_level_id: levelId,
          show: col.pv || order <= 3,
          order: order++,
        },
        ncMeta,
      );
    }
  }
}
