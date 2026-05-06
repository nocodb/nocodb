import { Script as ScriptCE } from 'src/models';
import { Logger } from '@nestjs/common';
import { AutomationTypes, PlanLimitTypes } from 'nocodb-sdk';
import type { ScriptType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { defaultScript } from '~/utils/scriptDefault';
import { isReplay } from '~/helpers/replayScope';
const logger = new Logger('Script');

export default class Script extends ScriptCE implements ScriptType {
  id?: string;
  title?: string;
  description?: string;
  meta?: any;
  order?: number;

  script?: string;

  config: Record<string, any>;
  base_id?: string;
  fk_workspace_id?: string;
  type?: AutomationTypes;

  created_by?: string;
  created_at?: string;
  updated_at?: string;

  constructor(script: Script | ScriptType) {
    super(script);
    Object.assign(this, script);
  }

  public static async get(
    context: NcContext,
    scriptId: string,
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    if (!scriptId) return null;

    let script = await NocoCache.get(
      context,
      `${CacheScope.SCRIPTS}:${scriptId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!script) {
      script = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATIONS,
        {
          id: scriptId,
          type: AutomationTypes.SCRIPT,
        },
      );

      if (script) {
        script = prepareForResponse(script, ['meta', 'config']);
        await NocoCache.set(
          context,
          `${CacheScope.SCRIPTS}:${scriptId}`,
          script,
        );
      }
    }

    if (script?.deleted && !includeDeleted) return null;

    return script && new Script(script);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.SCRIPTS, [
      baseId,
    ]);

    const { isNoneList } = cachedList;
    let scriptsList = cachedList.list;

    if (!isNoneList && !scriptsList.length) {
      scriptsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATIONS,
        {
          condition: {
            base_id: baseId,
            type: AutomationTypes.SCRIPT,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      scriptsList = scriptsList.map((script) =>
        prepareForResponse(script, ['meta', 'config']),
      );

      await NocoCache.setList(
        context,
        CacheScope.SCRIPTS,
        [baseId],
        scriptsList,
      );
    }

    if (!includeDeleted) {
      scriptsList = scriptsList.filter((s) => !s.deleted);
    }

    scriptsList.sort((a, b) => a.order - b.order);

    return scriptsList?.map((script) => new Script(script));
  }

  static async softDelete(
    context: NcContext,
    scriptId: string,
    deleted: boolean,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      { deleted },
      scriptId,
    );
    await NocoCache.update(context, `${CacheScope.SCRIPTS}:${scriptId}`, {
      deleted,
    });

    // Adjust workspace resource stats cache: -1 on trash, +1 on restore
    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      deleted ? -1 : 1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });
  }

  static async delete(context: NcContext, scriptId: any, ncMeta = Noco.ncMeta) {
    if (!scriptId) return false;

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      {
        id: scriptId,
        type: AutomationTypes.SCRIPT,
      },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.SCRIPTS}:${scriptId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      -1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return true;
  }

  public static async update(
    context: NcContext,
    scriptId: string,
    script: Partial<Script>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(script, [
      'title',
      'description',
      'meta',
      'order',
      'script',
      'config',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      prepareForDb(updateObj, ['meta', 'config']),
      {
        id: scriptId,
        type: AutomationTypes.SCRIPT,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.SCRIPTS}:${scriptId}`,
      prepareForResponse(updateObj, ['meta', 'config']),
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, scriptId, false, ncMeta);
  }

  public static async insert(
    context: NcContext,
    baseId: string,
    script: Partial<Script>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(script, [
      'title',
      'description',
      'meta',
      'order',
      'script',
      'config',
      'base_id',
      'fk_workspace_id',
      'created_by',
    ]);

    // Replay-only: preserve sandbox entity ID for idempotent merge
    if (isReplay() && script.id) {
      insertObj.id = script.id;
    }

    if (!insertObj.script) {
      insertObj.script = defaultScript;
    }

    insertObj.type = AutomationTypes.SCRIPT;

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.AUTOMATIONS, {
      base_id: context.base_id,
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      insertObj,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, id, false, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.SCRIPTS,
        [context.base_id],
        `${CacheScope.SCRIPTS}:${id}`,
      );
      return res;
    });
  }

  public static async deleteByBaseId(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const scripts = await this.list(context, baseId, true, ncMeta);

    for (const script of scripts) {
      await this.delete(context, script.id, ncMeta);
    }

    return true;
  }
}
