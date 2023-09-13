import { ProjectRoles } from 'nocodb-sdk';
import type { ProjectType } from 'nocodb-sdk';
import User from '~/models/User';
import Project from '~/models/Project';
import {
  // CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp } from '~/utils/modelUtils';

export default class ProjectUser {
  project_id: string;
  fk_user_id: string;
  roles?: string;

  constructor(data: ProjectUser) {
    Object.assign(this, data);
  }

  protected static castType(projectUser: ProjectUser): ProjectUser {
    return projectUser && new ProjectUser(projectUser);
  }

  public static async insert(
    projectUser: Partial<ProjectUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(projectUser, [
      'fk_user_id',
      'project_id',
      'roles',
    ]);

    const { project_id, fk_user_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    // reset all user projects cache
    await NocoCache.delAll(
      CacheScope.USER_PROJECT,
      `${projectUser.fk_user_id}:*`,
    );

    return this.get(project_id, fk_user_id, ncMeta);
  }

  // public static async update(id, user: Partial<ProjectUser>, ncMeta = Noco.ncMeta) {
  //   // return await ncMeta.metaUpdate(null, null, MetaTable.USERS, id, insertObj);
  // }
  static async get(projectId: string, userId: string, ncMeta = Noco.ncMeta) {
    let projectUser =
      projectId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_USER}:${projectId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!projectUser) {
      projectUser = await ncMeta.metaGet2(null, null, MetaTable.PROJECT_USERS, {
        fk_user_id: userId,
        project_id: projectId,
      });
      await NocoCache.set(
        `${CacheScope.PROJECT_USER}:${projectId}:${userId}`,
        projectUser,
      );
    }
    return this.castType(projectUser);
  }

  public static async getUsersList(
    {
      project_id,
      limit = 25,
      offset = 0,
      query,
    }: {
      project_id: string;
      limit: number;
      offset: number;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<(Partial<User> & ProjectUser)[]> {
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.PROJECT_USERS}.project_id`,
        `${MetaTable.PROJECT_USERS}.roles as roles`,
        `${MetaTable.PROJECT_USERS}.created_at as created_at`,
      )
      .offset(offset)
      .limit(limit);

    if (query) {
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    queryBuilder.leftJoin(MetaTable.PROJECT_USERS, function () {
      this.on(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        '=',
        `${MetaTable.USERS}.id`,
      ).andOn(
        `${MetaTable.PROJECT_USERS}.project_id`,
        '=',
        ncMeta.knex.raw('?', [project_id]),
      );
    });

    const projectUsers = await queryBuilder;

    return projectUsers;
  }

  public static async getUsersCount(
    {
      project_id,
      query,
    }: {
      project_id: string;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const queryBuilder = ncMeta.knex(MetaTable.USERS);

    if (query) {
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    queryBuilder.leftJoin(MetaTable.PROJECT_USERS, function () {
      this.on(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        '=',
        `${MetaTable.USERS}.id`,
      ).andOn(
        `${MetaTable.PROJECT_USERS}.project_id`,
        '=',
        ncMeta.knex.raw('?', [project_id]),
      );
    });

    return (await queryBuilder.count('id', { as: 'count' }).first()).count;
  }

  static async updateRoles(
    projectId,
    userId,
    roles: string,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.PROJECT_USER}:${projectId}:${userId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.roles = roles;
      // set cache
      await NocoCache.set(key, o);
    }
    // update user cache
    const user = await User.get(userId);
    if (user) {
      const email = user.email;
      for (const key of [`${CacheScope.USER}:${email}___${projectId}`]) {
        const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
        if (o) {
          o.roles = roles;
          // set cache
          await NocoCache.set(key, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT_USERS,
      {
        roles,
      },
      {
        fk_user_id: userId,
        project_id: projectId,
      },
    );
  }

  static async update(
    projectId,
    userId,
    projectUser: Partial<ProjectUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(projectUser, ['starred', 'hidden', 'order']);

    // get existing cache
    const key = `${CacheScope.PROJECT_USER}:${projectId}:${userId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      Object.assign(o, updateObj);
      // set cache
      await NocoCache.set(key, o);
    }
    // update user cache
    const user = await User.get(userId);
    if (user) {
      const email = user.email;
      for (const key of [
        `${CacheScope.USER}:${email}`,
        `${CacheScope.USER}:${email}___${projectId}`,
      ]) {
        const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
        if (o) {
          Object.assign(o, updateObj);
          // set cache
          await NocoCache.set(key, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT_USERS,
      updateObj,
      {
        fk_user_id: userId,
        project_id: projectId,
      },
    );
  }

  static async delete(projectId: string, userId: string, ncMeta = Noco.ncMeta) {
    const { email } = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
      id: userId,
    });
    if (email) {
      await NocoCache.delAll(CacheScope.USER, `${email}*`);
    }

    // remove project from user project list cache
    const cachedList = await NocoCache.getList(CacheScope.USER_PROJECT, [
      userId,
    ]);
    let { list: cachedProjectList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && cachedProjectList?.length) {
      cachedProjectList = cachedProjectList.filter((p) => p.id !== projectId);
      // delete the whole list first so that the old one won't be included
      await NocoCache.del(`${CacheScope.USER_PROJECT}:${userId}:list`);
      if (cachedProjectList.length > 0) {
        // set the updated list (i.e. excluding the to-be-deleted project id)
        await NocoCache.setList(
          CacheScope.USER_PROJECT,
          [userId],
          cachedProjectList,
        );
      }
    }

    await NocoCache.del(`${CacheScope.PROJECT_USER}:${projectId}:${userId}`);
    return await ncMeta.metaDelete(null, null, MetaTable.PROJECT_USERS, {
      fk_user_id: userId,
      project_id: projectId,
    });
  }

  static async getProjectsIdList(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectUser[]> {
    return await ncMeta.metaList2(null, null, MetaTable.PROJECT_USERS, {
      condition: { fk_user_id: userId },
    });
  }

  static async getProjectsList(
    userId: string,
    params: any,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectType[]> {
    // let projectList: ProjectType[];

    // todo: pagination
    // todo: caching based on filter type
    //   = await NocoCache.getList(CacheScope.USER_PROJECT, [
    //   userId,
    // ]);

    // if (projectList.length) {
    //   return projectList;
    // }

    const qb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.id`)
      .select(`${MetaTable.PROJECT}.title`)
      .select(`${MetaTable.PROJECT}.prefix`)
      .select(`${MetaTable.PROJECT}.status`)
      .select(`${MetaTable.PROJECT}.description`)
      .select(`${MetaTable.PROJECT}.meta`)
      .select(`${MetaTable.PROJECT}.color`)
      .select(`${MetaTable.PROJECT}.is_meta`)
      .select(`${MetaTable.PROJECT}.created_at`)
      .select(`${MetaTable.PROJECT}.updated_at`)
      .select(`${MetaTable.PROJECT_USERS}.starred`)
      .select(`${MetaTable.PROJECT_USERS}.roles as project_role`)
      .select(`${MetaTable.PROJECT_USERS}.updated_at as last_accessed`)
      .leftJoin(MetaTable.PROJECT_USERS, function () {
        this.on(
          `${MetaTable.PROJECT_USERS}.project_id`,
          `${MetaTable.PROJECT}.id`,
        );
        this.andOn(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          ncMeta.knex.raw('?', [userId]),
        );
      })
      .where(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        ncMeta.knex.raw('?', [userId]),
      )
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      })
      .where(function () {
        this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhereNot(
          `${MetaTable.PROJECT_USERS}.roles`,
          ProjectRoles.NO_ACCESS,
        );
      });

    // filter starred projects
    if (params.starred) {
      qb.where(`${MetaTable.PROJECT_USERS}.starred`, true);
    }

    // filter shared with me projects
    if (params.shared) {
      qb.where(function () {
        // include projects belongs project_user in which user is not owner
        this.where(function () {
          this.where(`${MetaTable.PROJECT_USERS}.fk_user_id`, userId)
            .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.OWNER)
            .whereNotNull(`${MetaTable.PROJECT_USERS}.roles`);
        });
      });
    }

    // order based on recently accessed
    if (params.recent) {
      qb.orderBy(`${MetaTable.PROJECT_USERS}.updated_at`, 'desc');
    }

    qb.whereNot(`${MetaTable.PROJECT}.deleted`, true);

    const projectList = await qb;
    if (projectList?.length) {
      // parse meta
      for (const project of projectList) {
        project.meta = parseMetaProp(project);
      }

      await NocoCache.setList(CacheScope.USER_PROJECT, [userId], projectList);
    }

    const castedProjectList = projectList
      .filter((p) => !params?.type || p.type === params.type)
      .map((m) => Project.castType(m));

    await Promise.all(
      castedProjectList.map((project) => project.getBases(ncMeta)),
    );

    return castedProjectList;
  }

  static async updateOrInsert(
    projectId,
    userId,
    projectUser: Partial<ProjectUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const existingProjectUser = await this.get(projectId, userId, ncMeta);

    if (existingProjectUser) {
      return await this.update(projectId, userId, projectUser, ncMeta);
    } else {
      return await this.insert({ project_id: projectId, fk_user_id: userId });
    }
  }
}
