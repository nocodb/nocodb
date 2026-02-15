import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';

export default class RecordTemplate {
  id?: string;
  base_id: string;
  source_id: string;
  title: string;
  description?: string;
  template_data: string | Record<string, any>;
  usage_count?: number;
  enabled?: boolean;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;

  constructor(data: Partial<RecordTemplate>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    template: Partial<RecordTemplate>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(template, [
      'id',
      'base_id',
      'source_id',
      'title',
      'description',
      'template_data',
      'enabled',
      'created_by',
    ]);

    if (!insertObj.id) {
      insertObj.id = await ncMeta.genNanoid(MetaTable.RECORD_TEMPLATES);
    }

    // Ensure template_data is stored as string
    if (
      insertObj.template_data &&
      typeof insertObj.template_data !== 'string'
    ) {
      insertObj.template_data = JSON.stringify(insertObj.template_data);
    }

    const result = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.RECORD_TEMPLATES,
      insertObj,
      true,
    );

    // get() sets the individual item in cache, then append to list caches
    return this.get(context, result.id, ncMeta).then(async (record) => {
      const key = `${CacheScope.RECORD_TEMPLATE}:${result.id}`;
      await NocoCache.appendToList(
        context,
        CacheScope.RECORD_TEMPLATE,
        [template.base_id, template.source_id],
        key,
      );
      // Also update the base-level 'all' list cache so listAll returns fresh data
      await NocoCache.appendToList(
        context,
        CacheScope.RECORD_TEMPLATE,
        [template.base_id, 'all'],
        key,
      );
      return record;
    });
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    let template =
      id &&
      (await NocoCache.get(
        context,
        `${CacheScope.RECORD_TEMPLATE}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!template) {
      template = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.RECORD_TEMPLATES,
        {
          id,
        },
      );

      if (template) {
        await NocoCache.set(
          context,
          `${CacheScope.RECORD_TEMPLATE}:${id}`,
          template,
        );
      }
    }

    return template && this.castType(template);
  }

  /**
   * List templates for a base, optionally filtered by table (source_id).
   * When source_id is omitted, returns ALL templates across all tables in the base.
   * Cache key uses 'all' as the source_id placeholder for base-level queries.
   */
  public static async list(
    context: NcContext,
    param: { base_id: string; source_id?: string },
    ncMeta = Noco.ncMeta,
  ) {
    const condition: any = { base_id: param.base_id };
    if (param.source_id) {
      condition.source_id = param.source_id;
    }

    const cachedList = await NocoCache.getList(
      context,
      CacheScope.RECORD_TEMPLATE,
      [param.base_id, param.source_id || 'all'],
    );

    let { list: templateList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !templateList.length) {
      templateList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.RECORD_TEMPLATES,
        {
          condition,
          orderBy: {
            created_at: 'desc',
          },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.RECORD_TEMPLATE,
        [param.base_id, param.source_id || 'all'],
        templateList,
      );
    }

    return templateList?.map((t) => this.castType(t));
  }

  public static async update(
    context: NcContext,
    id: string,
    template: Partial<RecordTemplate>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(template, [
      'title',
      'description',
      'template_data',
      'enabled',
    ]);

    // Ensure template_data is stored as string
    if (
      updateObj.template_data &&
      typeof updateObj.template_data !== 'string'
    ) {
      updateObj.template_data = JSON.stringify(updateObj.template_data);
    }

    const existingTemplate = await this.get(context, id, ncMeta);
    if (!existingTemplate) {
      NcError.notFound('Record template not found');
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.RECORD_TEMPLATES,
      updateObj,
      id,
    );

    // Clear item cache and remove from parent list caches so they're refreshed
    await NocoCache.deepDel(
      context,
      `${CacheScope.RECORD_TEMPLATE}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return this.get(context, id, ncMeta);
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const template = await this.get(context, id, ncMeta);
    if (!template) {
      NcError.notFound('Record template not found');
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.RECORD_TEMPLATES,
      id,
    );

    // deepDel with CHILD_TO_PARENT removes item from parent list caches
    await NocoCache.deepDel(
      context,
      `${CacheScope.RECORD_TEMPLATE}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return true;
  }

  public static async incrementUsageCount(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const template = await this.get(context, id, ncMeta);
    if (!template) {
      NcError.notFound('Record template not found');
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.RECORD_TEMPLATES,
      {
        usage_count: (template.usage_count || 0) + 1,
      },
      id,
    );

    // Clear item + parent list caches so they're refreshed with new count
    await NocoCache.deepDel(
      context,
      `${CacheScope.RECORD_TEMPLATE}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return this.get(context, id, ncMeta);
  }

  public static castType(template: any): RecordTemplate {
    if (!template) return null;

    // Parse template_data if it's a string
    if (template.template_data && typeof template.template_data === 'string') {
      try {
        template.template_data = JSON.parse(template.template_data);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return new RecordTemplate(template);
  }
}
