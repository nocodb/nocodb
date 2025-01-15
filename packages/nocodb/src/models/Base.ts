import { Logger } from '@nestjs/common';
import type { BaseType, BoolType, MetaType } from 'nocodb-sdk';
import type { DB_TYPES } from '~/utils/globals';
import type { NcContext } from '~/interface/config';
import { BaseUser, CustomUrl, DataReflection, Source } from '~/models';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('Base');

export default class Base implements BaseType {
  public id: string;
  public fk_workspace_id?: string;
  public title: string;
  public prefix: string;
  public status: string;
  public description: string;
  public meta: MetaType;
  public color: string;
  public deleted: BoolType | number;
  public order: number;
  public is_meta: boolean | number = false;
  public sources?: Source[];
  public linked_db_projects?: Base[];

  // shared base props
  uuid?: string;
  password?: string;
  roles?: string;
  fk_custom_url_id?: string;

  constructor(base: Partial<Base>) {
    Object.assign(this, base);
  }

  public static castType(base: Base): Base {
    return base && new Base(base);
  }

  public static async createProject(
    base: Partial<BaseType>,
    ncMeta = Noco.ncMeta,
  ): Promise<Base> {
    const insertObj = extractProps(base, [
      'id',
      'title',
      'prefix',
      'description',
      'is_meta',
      'status',
      'meta',
      'color',
      'order',
    ]);

    if (!insertObj.order) {
      // get order value
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.PROJECT, {});
    }

    // stringify meta
    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }
    // set default meta if not present
    else if (!('meta' in insertObj)) {
      insertObj.meta = '{"iconColor":"#36BFFF"}';
    }

    const { id: baseId } = await ncMeta.metaInsert2(
      RootScopes.BASE,
      RootScopes.BASE,
      MetaTable.PROJECT,
      insertObj,
    );

    const context = {
      workspace_id: (base as any).fk_workspace_id,
      base_id: baseId,
    };

    for (const source of base.sources) {
      await Source.createBase(
        context,
        {
          type: source.config?.client as (typeof DB_TYPES)[number],
          ...source,
          baseId,
        },
        ncMeta,
      );
    }

    await NocoCache.del(CacheScope.INSTANCE_META);

    await DataReflection.grantBase(base.fk_workspace_id, base.id, ncMeta);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.getWithInfo(context, baseId, true, ncMeta).then(
      async (base) => {
        await NocoCache.appendToList(
          CacheScope.PROJECT,
          [],
          `${CacheScope.PROJECT}:${baseId}`,
        );
        return base;
      },
    );
  }

  static async list(
    workspaceId?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Base[]> {
    // todo: pagination
    const cachedList = await NocoCache.getList(CacheScope.PROJECT, []);
    let { list: baseList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseList.length) {
      baseList = await ncMeta.metaList2(
        RootScopes.BASE,
        RootScopes.BASE,
        MetaTable.PROJECT,
        {
          xcCondition: {
            _or: [
              {
                deleted: {
                  eq: false,
                },
              },
              {
                deleted: {
                  eq: null,
                },
              },
            ],
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.PROJECT, [], baseList);
    }

    const promises = [];

    const castedProjectList = baseList
      .filter(
        (p) => p.deleted === 0 || p.deleted === false || p.deleted === null,
      )
      .sort(
        (a, b) =>
          (a.order != null ? a.order : Infinity) -
          (b.order != null ? b.order : Infinity),
      )
      .map((p) => {
        const base = this.castType(p);
        promises.push(base.getSources(false, ncMeta));
        return base;
      });

    await Promise.all(promises);

    return castedProjectList;
  }

  // @ts-ignore
  static async get(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Base> {
    let baseData =
      baseId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${baseId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseData) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          id: baseId,
          deleted: false,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(`${CacheScope.PROJECT}:${baseId}`, baseData);
      }
    } else {
      if (baseData.deleted) {
        baseData = null;
      }
    }
    return this.castType(baseData);
  }

  async getSources(
    includeConfig = true,
    ncMeta = Noco.ncMeta,
  ): Promise<Source[]> {
    const sources = await Source.list(
      { workspace_id: this.fk_workspace_id, base_id: this.id },
      { baseId: this.id },
      ncMeta,
    );
    this.sources = sources;
    if (!includeConfig) {
      sources.forEach((s) => {
        s.config = undefined;
        s.integration_config = undefined;
      });
    }
    return sources;
  }

  // @ts-ignore
  static async getWithInfo(
    context: NcContext,
    baseId: string,
    includeConfig = true,
    ncMeta = Noco.ncMeta,
  ): Promise<Base> {
    let baseData =
      baseId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${baseId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!baseData) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          id: baseId,
          deleted: false,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(`${CacheScope.PROJECT}:${baseId}`, baseData);
      }
      if (baseData?.uuid) {
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${baseData.uuid}`,
          baseId,
        );
      }
    } else {
      if (baseData?.deleted) {
        baseData = null;
      }
    }
    if (baseData) {
      const base = this.castType(baseData);

      await base.getSources(includeConfig, ncMeta);

      return base;
    }
    return null;
  }

  // @ts-ignore
  static async softDelete(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base = (await this.get(context, baseId, ncMeta)) as Base;

    await this.clearConnectionPool(context, baseId, ncMeta);

    if (base) {
      // delete <scope>:<title>
      // delete <scope>:<uuid>
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del([
        `${CacheScope.PROJECT_ALIAS}:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
      ]);
    }

    await NocoCache.del(CacheScope.INSTANCE_META);

    // remove item in cache list
    await NocoCache.deepDel(
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    await DataReflection.revokeBase(base.fk_workspace_id, base.id, ncMeta);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // set meta
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      { deleted: true },
      baseId,
    );
  }

  // @ts-ignore
  static async update(
    context: NcContext,
    baseId: string,
    base: Partial<Base>,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const updateObj = extractProps(base, [
      'title',
      'prefix',
      'status',
      'description',
      'meta',
      'color',
      'deleted',
      'order',
      'sources',
      'uuid',
      'password',
      'roles',
    ]);

    // stringify meta
    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // get existing cache
    const key = `${CacheScope.PROJECT}:${baseId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      // new uuid is generated
      if (o.uuid && updateObj.uuid && o.uuid !== updateObj.uuid) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.uuid}`);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${updateObj.uuid}`,
          baseId,
        );
      }
      // disable shared base
      if (o.uuid && updateObj.uuid === null) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.uuid}`);
      }
      if (o.title && updateObj.title && o.title !== updateObj.title) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.title}`);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${updateObj.title}`,
          baseId,
        );
      }
      o = { ...o, ...updateObj };

      await NocoCache.del(CacheScope.INSTANCE_META);

      // set cache
      await NocoCache.set(key, o);
    }
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // set meta
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      updateObj,
      baseId,
    );
  }

  // Todo: Remove the base entry from the connection pool in NcConnectionMgrv2
  static async delete(
    context: NcContext,
    baseId,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      baseId,
    );

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    const users = await BaseUser.getUsersList(
      context,
      {
        base_id: baseId,
        include_ws_deleted: true,
      },
      ncMeta,
    );

    for (const user of users) {
      await BaseUser.delete(context, baseId, user.id, ncMeta);
    }

    const sources = await Source.list(
      context,
      { baseId, includeDeleted: true },
      ncMeta,
    );
    for (const source of sources) {
      await source.delete(context, ncMeta);
    }

    await DataReflection.revokeBase(base.fk_workspace_id, base.id, ncMeta);

    if (base) {
      // delete <scope>:<uuid>
      // delete <scope>:<title>
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del([
        `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
        `${CacheScope.PROJECT_ALIAS}:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
      ]);
    }

    await NocoCache.deepDel(
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUDIT,
      {
        base_id: baseId,
      },
    );

    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      baseId,
    );
  }

  static async getByUuid(context: NcContext, uuid, ncMeta = Noco.ncMeta) {
    const baseId =
      uuid &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_ALIAS}:${uuid}`,
        CacheGetType.TYPE_STRING,
      ));
    let baseData = null;
    if (!baseId) {
      baseData = await Noco.ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          uuid,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${uuid}`,
          baseData?.id,
        );
      }
    } else {
      return this.get(context, baseId, ncMeta);
    }
    return baseData?.id && this.get(context, baseData?.id, ncMeta);
  }

  static async getWithInfoByTitle(
    context: NcContext,
    title: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.getByTitle(context, title, ncMeta);
    if (base) {
      await base.getSources(false, ncMeta);
    }

    return base;
  }

  static async getByTitle(
    context: NcContext,
    title: string,
    ncMeta = Noco.ncMeta,
  ) {
    const baseId =
      title &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_ALIAS}:${title}`,
        CacheGetType.TYPE_STRING,
      ));
    let baseData = null;
    if (!baseId) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          title,
          deleted: false,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${title}`,
          baseData?.id,
        );
      }
    } else {
      return this.get(context, baseId, ncMeta);
    }
    return baseData?.id && this.get(context, baseData?.id, ncMeta);
  }

  static async getByTitleOrId(
    context: NcContext,
    titleOrId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const baseId =
      titleOrId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_ALIAS}:ref:${titleOrId}`,
        CacheGetType.TYPE_STRING,
      ));
    let baseData = null;
    if (!baseId) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          deleted: false,
        },
        null,
        {
          _or: [
            {
              id: {
                eq: titleOrId,
              },
            },
            {
              title: {
                eq: titleOrId,
              },
            },
          ],
        },
      );

      if (baseData) {
        // parse meta
        baseData.meta = parseMetaProp(baseData);

        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:ref:${titleOrId}`,
          baseData?.id,
        );
      }
    } else {
      return this.get(context, baseId, ncMeta);
    }
    return baseData?.id && this.get(context, baseData?.id, ncMeta);
  }

  static async getWithInfoByTitleOrId(
    context: NcContext,
    titleOrId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.getByTitleOrId(context, titleOrId, ncMeta);

    if (base) {
      // parse meta
      base.meta = parseMetaProp(base);
      await base.getSources(false, ncMeta);
    }

    return base;
  }

  static async clearConnectionPool(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.get(context, baseId, ncMeta);
    if (base) {
      const sources = await base.getSources(false, ncMeta);
      for (const source of sources) {
        await NcConnectionMgrv2.deleteAwait(source);
      }
    }
  }
}
