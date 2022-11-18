import { ProjectType } from 'nocodb-sdk';
import {
  // CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import Noco from '../Noco';
import NocoCache from '../cache/NocoCache';
import User from './User';

export default class ProjectUser {
  project_id: string;
  fk_user_id: string;
  roles?: string;

  constructor(data: ProjectUser) {
    Object.assign(this, data);
  }

  public static async insert(
    projectUser: Partial<ProjectUser & { created_at?: any; updated_at?: any }>,
    ncMeta = Noco.ncMeta
  ) {
    const { project_id, fk_user_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.PROJECT_USERS,
      {
        fk_user_id: projectUser.fk_user_id,
        project_id: projectUser.project_id,
        roles: projectUser.roles,
        created_at: projectUser.created_at,
        updated_at: projectUser.updated_at,
      },
      true
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
        CacheGetType.TYPE_OBJECT
      ));
    if (!projectUser) {
      projectUser = await ncMeta.metaGet2(null, null, MetaTable.PROJECT_USERS, {
        fk_user_id: userId,
        project_id: projectId,
      });
      await NocoCache.set(
        `${CacheScope.PROJECT_USER}:${projectId}:${userId}`,
        projectUser
      );
    }
    return projectUser;
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
    ncMeta = Noco.ncMeta
  ) {
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.PROJECT_USERS}.project_id`,
        `${MetaTable.PROJECT_USERS}.roles as roles`
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
        `${MetaTable.USERS}.id`
      ).andOn(
        `${MetaTable.PROJECT_USERS}.project_id`,
        '=',
        ncMeta.knex.raw('?', [project_id])
      );
    });

    return await queryBuilder;
  }

  public static async getUsersCount(
    {
      query,
    }: {
      query?: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<number> {
    const qb = ncMeta.knex(MetaTable.USERS);

    if (query) {
      qb.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    return (await qb.count('id', { as: 'count' }).first()).count;
  }

  static async update(projectId, userId, roles: string, ncMeta = Noco.ncMeta) {
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
      for (const key of [
        `${CacheScope.USER}:${email}`,
        `${CacheScope.USER}:${email}___${projectId}`,
      ]) {
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
      }
    );
  }

  static async delete(projectId: string, userId, ncMeta = Noco.ncMeta) {
    // await NocoCache.deepDel(
    //   CacheScope.PROJECT_USER,
    //   `${CacheScope.PROJECT_USER}:${projectId}:${userId}`,
    //   CacheDelDirection.CHILD_TO_PARENT
    // );
    const { email } = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
      id: userId,
    });
    if (email) {
      await NocoCache.delAll(CacheScope.USER, `${email}*`);
    }
    await NocoCache.del(`${CacheScope.PROJECT_USER}:${projectId}:${userId}`);
    return await ncMeta.metaDelete(null, null, MetaTable.PROJECT_USERS, {
      fk_user_id: userId,
      project_id: projectId,
    });
  }

  static async getProjectsIdList(
    userId: string,
    ncMeta = Noco.ncMeta
  ): Promise<ProjectUser[]> {
    return await ncMeta.metaList2(null, null, MetaTable.PROJECT_USERS, {
      condition: { fk_user_id: userId },
    });
  }

  static async getProjectsList(
    userId: string,
    isSuperAdmin: boolean,
    ncMeta = Noco.ncMeta
  ): Promise<ProjectType[]> {
    // todo: pagination
    // todo: caching
    // let projectList = await NocoCache.getList(CacheScope.PROJECT, []);

    const qb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      [isSuperAdmin ? 'leftJoin' : 'innerJoin'](
        MetaTable.PROJECT_USERS,
        function () {
          this.on(
            `${MetaTable.PROJECT_USERS}.project_id`,
            `${MetaTable.PROJECT}.id`
          );

          if (!isSuperAdmin) {
            this.andOn(
              `${MetaTable.PROJECT_USERS}.fk_user_id`,
              ncMeta.knex.raw('?', [userId])
            );
          }
        }
      )
      // .innerJoin(MetaTable.USERS, function () {
      //   this.on(
      //     `${MetaTable.PROJECT_USERS}.fk_user_id`,
      //     `${MetaTable.USERS}.id`
      //   );
      // })
      // .where(function () {
      //   this.where(`${MetaTable.PROJECT_USERS}.fk_user_id`, userId)
      //     .orWhere(
      //     `${MetaTable.USERS}.roles`,
      //     'like',
      //     `%${OrgUserRoles.SUPER_ADMIN}%`
      //   );
      // })
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`
        );
      });
    //   if (!projectList.length) {
    //     projectList = await ncMeta.metaList2(null, null, MetaTable.PROJECT, {
    //       xcCondition: {
    //         _or: [
    //           {
    //             deleted: {
    //               eq: false,
    //             },
    //           },
    //           {
    //             deleted: {
    //               eq: null,
    //             },
    //           },
    //         ],
    //       },
    //     })
    //     await NocoCache.setList(CacheScope.PROJECT, [], projectList)
    //   }
    //   projectList = projectList.filter(
    //     (p) => p.deleted === 0 || p.deleted === false || p.deleted === null,
    //   )
    //   return projectList.map((m) => new Project(m))
    //
    //
    //   return await ncMeta.metaList2(null, null, MetaTable.PROJECT_USERS, {
    //     condition: { fk_user_id: userId },
    //   })
    // }

    console.log(qb.toQuery());

    return qb;
  }
}
