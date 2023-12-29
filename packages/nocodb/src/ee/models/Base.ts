import BaseCE from 'src/models/Base';
import { ProjectRoles, ProjectTypes } from 'nocodb-sdk';
import type { BaseType } from 'nocodb-sdk';
import type { DB_TYPES } from '~/utils/globals';
import DashboardProjectDBProject from '~/models/DashboardProjectDBProject';
import Noco from '~/Noco';

import Source from '~/models/Source';
import { BaseUser, ModelStat } from '~/models';
import NocoCache from '~/cache/NocoCache';

import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';

export default class Base extends BaseCE {
  public type?: 'database' | 'documentation' | 'dashboard';
  public fk_workspace_id?: string;

  public static castType(base: Base): Base {
    return base && new Base(base);
  }

  static async list(
    // @ts-ignore
    param,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseCE[]> {
    // todo: pagination
    const cachedList = await NocoCache.getList(CacheScope.PROJECT, []);
    let { list: baseList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseList.length) {
      baseList = await ncMeta.metaList2(null, null, MetaTable.PROJECT, {
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
      });
      await NocoCache.setList(CacheScope.PROJECT, [], baseList);
    }
    baseList = baseList.filter(
      (p) => p.deleted === 0 || p.deleted === false || p.deleted === null,
    );
    return baseList
      .map((m) => this.castType(m))
      .filter((p) => !param?.type || p.type === param.type);
  }

  public static async createProject(
    base: Partial<BaseType>,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseCE> {
    const insertObj = extractProps(base, [
      'id',
      'title',
      'prefix',
      'description',
      'is_meta',
      'status',
      'type',
      'fk_workspace_id',
      'meta',
      'color',
    ]);

    const { id: baseId } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.PROJECT,
      insertObj,
    );

    await NocoCache.appendToList(
      CacheScope.PROJECT,
      [],
      `${CacheScope.PROJECT}:${baseId}`,
    );

    for (const source of base.sources) {
      await Source.createBase(
        {
          type: source.config?.client as (typeof DB_TYPES)[number],
          ...source,
          baseId,
        },
        ncMeta,
      );
    }

    await NocoCache.del(CacheScope.INSTANCE_META);
    return this.getWithInfo(baseId, ncMeta);
  }

  // @ts-ignore
  static async update(
    baseId: string,
    base: Partial<Base> & { fk_workspace_id?: string },
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
      'fk_workspace_id',
    ]);
    // get existing cache
    const key = `${CacheScope.PROJECT}:${baseId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      // new uuid is generated
      if (o.uuid && updateObj.uuid && o.uuid !== updateObj.uuid) {
        await NocoCache.del(`${CacheScope.PROJECT}:${o.uuid}`);
        await NocoCache.set(`${CacheScope.PROJECT}:${updateObj.uuid}`, baseId);
      }
      // disable shared base
      if (o.uuid && updateObj.uuid === null) {
        await NocoCache.del(`${CacheScope.PROJECT}:${o.uuid}`);
      }
      if (o.title && updateObj.title && o.title !== updateObj.title) {
        await NocoCache.del(`${CacheScope.PROJECT}:${o.title}`);
        await NocoCache.set(`${CacheScope.PROJECT}:${updateObj.title}`, baseId);
      }
      o = { ...o, ...updateObj };

      await NocoCache.del(CacheScope.INSTANCE_META);

      // set cache
      await NocoCache.set(key, o);
    }

    // stringify meta
    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      updateObj,
      baseId,
    );
  }

  static async getWithInfo(
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseCE> {
    let base: Base = await super.getWithInfo(baseId, ncMeta);

    if (base && base.type === ProjectTypes.DASHBOARD) {
      base = this.castType(base);
      await base.getLinkedDbProjects(ncMeta);
    }

    return base as BaseCE;
  }

  static async delete(baseId, ncMeta = Noco.ncMeta): Promise<any> {
    let base = await this.get(baseId, ncMeta);
    const users = await BaseUser.getUsersList(
      {
        base_id: baseId,
      },
      ncMeta,
    );

    for (const user of users) {
      await BaseUser.delete(baseId, user.id, ncMeta);
    }

    // remove left over users (used for workspace template)
    await ncMeta.metaDelete(null, null, MetaTable.PROJECT_USERS, {
      base_id: baseId,
    });

    const sources = await Source.list({ baseId }, ncMeta);
    for (const source of sources) {
      await source.delete(ncMeta, { force: true });
    }
    base = await this.get(baseId, ncMeta);

    if (base) {
      // delete <scope>:<uuid>
      await NocoCache.del(`${CacheScope.PROJECT}:${base.uuid}`);
      // delete <scope>:<title>
      await NocoCache.del(`${CacheScope.PROJECT}:${base.title}`);
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${base.title}`);
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${base.id}`);
    }

    await NocoCache.deepDel(
      CacheScope.PROJECT,
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del(`${CacheScope.BASE_TO_WORKSPACE}:${baseId}`);

    await ncMeta.metaDelete(null, null, MetaTable.AUDIT, {
      base_id: baseId,
    });

    return await ncMeta.metaDelete(null, null, MetaTable.PROJECT, baseId);
  }

  // @ts-ignore
  static async softDelete(baseId: string, ncMeta = Noco.ncMeta): Promise<any> {
    const base = (await this.get(baseId, ncMeta)) as Base;

    await this.clearConnectionPool(baseId, ncMeta);

    const models = await ncMeta.metaList2(null, null, MetaTable.MODELS, {
      condition: {
        base_id: baseId,
      },
    });

    await Promise.all(
      models.map((model) => ModelStat.delete(base.fk_workspace_id, model.id)),
    );

    // get existing cache
    const key = `${CacheScope.PROJECT}:${baseId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // delete <scope>:<id>
      await NocoCache.del(`${CacheScope.PROJECT}:${baseId}`);
      // delete <scope>:<title>
      await NocoCache.del(`${CacheScope.PROJECT}:${o.title}`);
      // delete <scope>:<uuid>
      await NocoCache.del(`${CacheScope.PROJECT}:${o.uuid}`);
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${o.title}`);
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${o.id}`);
    }

    await NocoCache.del(CacheScope.INSTANCE_META);

    // remove item in cache list
    await NocoCache.deepDel(
      CacheScope.PROJECT,
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del(`${CacheScope.BASE_TO_WORKSPACE}:${baseId}`);

    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      { deleted: true },
      baseId,
    );
  }

  // EXTRA METHODS

  static listByWorkspaceAndUser? = async (
    fk_workspace_id: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) => {
    // Todo: caching , pagination, query optimisation

    const baseListQb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .select(`${MetaTable.WORKSPACE_USER}.roles as workspace_role`)
      .select(`${MetaTable.PROJECT_USERS}.starred`)
      .select(`${MetaTable.PROJECT_USERS}.roles as project_role`)
      .select(`${MetaTable.PROJECT_USERS}.updated_at as last_accessed`)
      .leftJoin(MetaTable.WORKSPACE_USER, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          '=',
          `${MetaTable.PROJECT}.fk_workspace_id`,
        ).andOn(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          ncMeta.knex.raw('?', [userId]),
        );
      })
      .leftJoin(MetaTable.PROJECT_USERS, function () {
        this.on(
          `${MetaTable.PROJECT_USERS}.base_id`,
          '=',
          `${MetaTable.PROJECT}.id`,
        ).andOn(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          '=',
          ncMeta.knex.raw('?', [userId]),
        );
      })

      .where(`${MetaTable.PROJECT}.fk_workspace_id`, fk_workspace_id)

      .where(function () {
        this.where(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          '=',
          ncMeta.knex.raw('?', [userId]),
        ).orWhere(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          ncMeta.knex.raw('?', [userId]),
        );
      })
      .where(`${MetaTable.PROJECT}.deleted`, false)
      .where(function () {
        this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhereNot(
          `${MetaTable.PROJECT_USERS}.roles`,
          ProjectRoles.NO_ACCESS,
        );
      });

    const bases = await baseListQb;

    // parse meta
    for (const base of bases) {
      base.meta = parseMetaProp(base);
    }

    const castedProjectList = bases.map((m) => this.castType(m));

    await Promise.all(castedProjectList.map((base) => base.getSources(ncMeta)));

    return castedProjectList;
  };

  static async listByWorkspace(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const baseListQb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .where(`${MetaTable.PROJECT}.fk_workspace_id`, fk_workspace_id)
      .where(`${MetaTable.PROJECT}.deleted`, false);

    const bases = await baseListQb;

    // parse meta
    for (const base of bases) {
      base.meta = parseMetaProp(base);
    }

    const castedProjectList = bases.map((m) => this.castType(m));

    await Promise.all(castedProjectList.map((base) => base.getSources(ncMeta)));

    return castedProjectList;
  }

  static async countByWorkspace(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const count = await ncMeta.metaCount(null, null, MetaTable.PROJECT, {
      condition: {
        fk_workspace_id,
        deleted: false,
      },
    });

    return count;
  }

  getLinkedDbProjects? = async (ncMeta = Noco.ncMeta) => {
    const dbProjects = DashboardProjectDBProject.getDbProjectsList(
      {
        dashboard_project_id: this.id,
      },
      ncMeta,
    );

    return dbProjects;
  };
}
