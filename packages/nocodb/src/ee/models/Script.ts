import { Script as ScriptCE } from 'src/models';
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
import { prepareForDb } from '~/utils/modelUtils';
import { deserializeJSON } from '~/utils/serialize';

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
        NocoCache.set(`${CacheScope.SCRIPTS}:${scriptId}`, script);
      }
    }

    const deserializeProps = ['meta', 'config'];

    for (const prop of deserializeProps) {
      if (script[prop]) {
        script[prop] = deserializeJSON(script[prop]);
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
      await NocoCache.setList(CacheScope.SCRIPTS, [baseId], scriptsList);
    }

    return scriptsList
      .map((script) => {
        const deserializeProps = ['meta', 'config'];

        for (const prop of deserializeProps) {
          if (script[prop]) {
            script[prop] = deserializeJSON(script[prop]);
          }
        }

        return new Script(script);
      })
      .sort((a, b) => a.order - b.order);
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

    await NocoCache.update(`${CacheScope.SCRIPTS}:${scriptId}`, updateObj);

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

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.SCRIPTS, {
      base_id: context.base_id,
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SCRIPTS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        CacheScope.SCRIPTS,
        [context.base_id],
        `${CacheScope.SCRIPTS}:${id}`,
      );
      return res;
    });
  }
}
