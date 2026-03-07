import DateDependencyCE from 'src/models/DateDependency';
import type { DateDependencyType } from 'nocodb-sdk';
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

export default class DateDependency
  extends DateDependencyCE
  implements DateDependencyType
{
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_model_id?: string;

  fk_start_date_field_id?: string | null;
  fk_end_date_field_id?: string | null;
  fk_duration_field_id?: string | null;

  fk_dependency_linkrow_field_id?: string | null;
  dependency_linkrow_role?: 'predecessors' | 'successors';
  dependency_connection_type?:
    | 'end-to-start'
    | 'end-to-end'
    | 'start-to-end'
    | 'start-to-start';
  dependency_buffer_type?: 'flexible' | 'fixed' | 'none';
  dependency_buffer_days?: number;

  include_weekends?: boolean;
  is_active?: boolean;

  constructor(data: Partial<DateDependency>) {
    super(data)
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<DateDependency | null> {
    let rule =
      id &&
      (await NocoCache.get(
        context,
        `${CacheScope.DATE_DEPENDENCY}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!rule) {
      rule = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DATE_DEPENDENCY,
        { id },
      );
      if (rule) {
        await NocoCache.set(
          context,
          `${CacheScope.DATE_DEPENDENCY}:${rule.id}`,
          rule,
        );
      }
    }

    return rule && new DateDependency(rule);
  }

  public static async getByModelId(
    context: NcContext,
    fk_model_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<DateDependency | null> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.DATE_DEPENDENCY,
      [fk_model_id],
    );
    let { list } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !list.length) {
      list = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DATE_DEPENDENCY,
        { condition: { fk_model_id } },
      );
      await NocoCache.setList(
        context,
        CacheScope.DATE_DEPENDENCY,
        [fk_model_id],
        list,
      );
    }

    if (!list?.length) return null;
    return new DateDependency(list[0]);
  }

  public static async insert(
    context: NcContext,
    data: Partial<DateDependency>,
    ncMeta = Noco.ncMeta,
  ): Promise<DateDependency> {
    const insertObj = extractProps(data, [
      'fk_model_id',
      'fk_start_date_field_id',
      'fk_end_date_field_id',
      'fk_duration_field_id',
      'fk_dependency_linkrow_field_id',
      'dependency_linkrow_role',
      'dependency_connection_type',
      'dependency_buffer_type',
      'dependency_buffer_days',
      'include_weekends',
      'is_active',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DATE_DEPENDENCY,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (rule) => {
      await NocoCache.appendToList(
        context,
        CacheScope.DATE_DEPENDENCY,
        [insertObj.fk_model_id],
        `${CacheScope.DATE_DEPENDENCY}:${id}`,
      );
      return rule;
    });
  }

  public static async update(
    context: NcContext,
    id: string,
    data: Partial<DateDependency>,
    ncMeta = Noco.ncMeta,
  ): Promise<DateDependency> {
    const updateObj = extractProps(data, [
      'fk_start_date_field_id',
      'fk_end_date_field_id',
      'fk_duration_field_id',
      'fk_dependency_linkrow_field_id',
      'dependency_linkrow_role',
      'dependency_connection_type',
      'dependency_buffer_type',
      'dependency_buffer_days',
      'include_weekends',
      'is_active',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DATE_DEPENDENCY,
      updateObj,
      { id },
    );

    await NocoCache.update(
      context,
      `${CacheScope.DATE_DEPENDENCY}:${id}`,
      updateObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DATE_DEPENDENCY,
      { id },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.DATE_DEPENDENCY}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  public static async deleteByModelId(
    context: NcContext,
    fk_model_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const existing = await DateDependency.getByModelId(
      context,
      fk_model_id,
      ncMeta,
    );
    if (!existing?.id) return;
    await DateDependency.delete(context, existing.id, ncMeta);
  }

  public static async isColumnUsed(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DATE_DEPENDENCY,
      {
        xcCondition: {
          _or: [
            { fk_start_date_field_id: { eq: columnId } },
            { fk_end_date_field_id: { eq: columnId } },
            { fk_duration_field_id: { eq: columnId } },
            { fk_dependency_linkrow_field_id: { eq: columnId } },
          ],
        },
      },
    );
    return rows.length > 0;
  }
}
