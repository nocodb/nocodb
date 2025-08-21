import { Script as ScriptCE } from 'src/models';
import { Logger } from '@nestjs/common';
import { PlanLimitTypes } from 'nocodb-sdk';
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
const logger = new Logger('Base');

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
    ncMeta = Noco.ncMeta,
  ) {
    let script = await NocoCache.get(
      `${CacheScope.SCRIPTS}:${scriptId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!script) {
      script = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.SCRIPTS,
        scriptId,
      );

      if (script) {
        script = prepareForResponse(script, ['meta', 'config']);
        await NocoCache.set(`${CacheScope.SCRIPTS}:${scriptId}`, script);
      }
    }

    return script && new Script(script);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.SCRIPTS, [baseId]);

    // eslint-disable-next-line prefer-const
    let { list: scriptsList, isNoneList } = cachedList;

    if (!isNoneList && !scriptsList.length) {
      scriptsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SCRIPTS,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      scriptsList = scriptsList.map((script) =>
        prepareForResponse(script, ['meta', 'config']),
      );

      await NocoCache.setList(CacheScope.SCRIPTS, [baseId], scriptsList);
    }

    scriptsList.sort((a, b) => a.order - b.order);

    return scriptsList?.map((script) => new Script(script));
  }

  static async delete(context: NcContext, scriptId: any, ncMeta = Noco.ncMeta) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SCRIPTS,
      scriptId,
    );

    await NocoCache.deepDel(
      `${CacheScope.SCRIPTS}:${scriptId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.incrHashField(
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
      MetaTable.SCRIPTS,
      prepareForDb(updateObj, ['meta', 'config']),
      scriptId,
    );

    await NocoCache.update(
      `${CacheScope.SCRIPTS}:${scriptId}`,
      prepareForResponse(updateObj, ['meta', 'config']),
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, scriptId, ncMeta);
  }

  public static async insert(
    context: NcContext,
    baseId: string,
    script: Partial<ScriptType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(script, [
      'title',
      'description',
      'meta',
      'order',
      'script',
      'base_id',
      'fk_workspace_id',
      'created_by',
    ]);

    if (!insertObj.script) {
      insertObj.script = defaultScript;
    }

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.SCRIPTS, {
      base_id: context.base_id,
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SCRIPTS,
      insertObj,
    );

    await NocoCache.incrHashField(
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        CacheScope.SCRIPTS,
        [context.base_id],
        `${CacheScope.SCRIPTS}:${id}`,
      );
      return res;
    });
  }

  static async countScriptsInBase(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.SCRIPTS,
      {
        condition: {
          base_id: baseId,
        },
      },
    );
  }

  static async clearFromStats(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const countsInBase = await this.countScriptsInBase(context, baseId, ncMeta);

    await NocoCache.incrHashField(
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      -countsInBase,
    );

    return true;
  }
}
