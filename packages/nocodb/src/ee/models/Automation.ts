import { PlanLimitTypes } from 'nocodb-sdk';
import type { AutomationType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

export default class Automation implements AutomationType {
  id?: string;
  title?: string;
  fk_workspace_id?: string;
  base_id?: string;

  enabled?: boolean;

  trigger_count?: number;

  created_at?: string;
  updated_at?: string;

  constructor(automation: Automation) {
    Object.assign(this, automation);
  }

  public static async get(
    context: NcContext,
    automationId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let automation = await NocoCache.get(
      context,
      `${CacheScope.AUTOMATION}:${automationId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!automation) {
      automation = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATIONS,
        automationId,
      );

      if (automation) {
        automation = prepareForResponse(automation, ['nodes', 'edges', 'meta']);

        await NocoCache.set(
          context,
          `${CacheScope.AUTOMATION}:${automationId}`,
          automation,
        );
      }
    }

    return automation && new Automation(automation);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.AUTOMATION, [
      baseId,
    ]);

    let { list: automationList } = cachedList;

    if (!cachedList.isNoneList && !automationList.length) {
      automationList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATIONS,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );

      automationList = automationList.map((automation) =>
        prepareForResponse(automation, ['nodes', 'edges', 'meta']),
      );

      await NocoCache.setList(
        context,
        CacheScope.AUTOMATION,
        [baseId],
        automationList,
      );
    }

    return automationList.map((automation) => new Automation(automation));
  }

  public static async insert(
    context: NcContext,
    automation: Partial<Automation>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(automation, [
      'title',
      'base_id',
      'fk_workspace_id',
      'enabled',
      'nodes',
      'edges',
      'meta',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      prepareForDb(insertObj, ['nodes', 'edges', 'meta']),
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_AUTOMATION_PER_WORKSPACE,
      1,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.AUTOMATION,
        [automation.base_id],
        `${CacheScope.AUTOMATION}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    automationId: string,
    automation: Partial<Automation>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(automation, [
      'title',
      'enabled',
      'nodes',
      'edges',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      prepareForDb(updateObj, ['nodes', 'edges', 'meta']),
      automationId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.AUTOMATION}:${automationId}`,
      updateObj,
    );

    return this.get(context, automationId, ncMeta);
  }

  static async delete(
    context: NcContext,
    automationId: any,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      automationId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.AUTOMATION}:${automationId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_AUTOMATION_PER_WORKSPACE,
      -1,
    );

    return res;
  }
}
