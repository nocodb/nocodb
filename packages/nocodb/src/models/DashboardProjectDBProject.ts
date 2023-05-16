import { ProjectTypes } from 'nocodb-sdk';
import {
  // CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import Noco from '../Noco';
// import NocoCache from '../cache/NocoCache';
import { extractProps } from '../helpers/extractProps';
import type { ProjectType } from 'nocodb-sdk';

export default class DashboardProjectDBProject {
  dashboard_project_id: string;
  db_project_id: string;

  constructor(data: DashboardProjectDBProject) {
    Object.assign(this, data);
  }

  public static async insert(
    dashboardProjectDBProject: Partial<DashboardProjectDBProject>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(dashboardProjectDBProject, [
      'dashboard_project_id',
      'db_project_id',
    ]);

    const dashboardProject = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.PROJECT,
      {
        id: dashboardProjectDBProject.dashboard_project_id,
      },
    );

    if (dashboardProject?.type !== ProjectTypes.DASHBOARD) {
      throw new Error(
        `Project with id ${dashboardProjectDBProject.dashboard_project_id} is not of type ${ProjectTypes.DASHBOARD}`,
      );
    }

    const dbProject = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
      id: dashboardProjectDBProject.db_project_id,
    });

    if (dbProject?.type !== ProjectTypes.DATABASE) {
      throw new Error(
        `Project with id ${dashboardProjectDBProject.db_project_id} is not of type ${ProjectTypes.DATABASE}`,
      );
    }

    const { dashboard_project_id, db_project_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
      insertObj,
      true,
    );

    // await NocoCache.delAll(
    //   CacheScope.DASHBOARD_PROJECT_DB_PROJECT_LINKING,
    //   `${dashboardProjectDBProject.db_project_id}:*`,
    // );

    return this.get(dashboard_project_id, db_project_id, ncMeta);
  }

  static async get(
    dashboardProjectId: string,
    dbProjectId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let dashboardProjectDbProject;
    // =
    // dashboardProjectId &
    // &
    // dbProjectId &
    // &
    // (await NocoCache.get
    // (
    //   `${CacheScope.DASHBOARD_PROJECT_DB_PROJECT_LINKING}:${dashboardProjectId}:${dbProjectId}`
    // ,
    //   CacheGetType.TYPE_OBJECT
    // ,
    // ))
    // ;
    if (!dashboardProjectDbProject) {
      dashboardProjectDbProject = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
        {
          dashboard_project_id: dashboardProjectId,
          db_project_id: dbProjectId,
        },
      );
      // await NocoCache.set(
      //   `${CacheScope.DASHBOARD_PROJECT_DB_PROJECT_LINKING}:${dashboardProjectId}:${dbProjectId}`,
      //   dashboardProjectDbProject,
      // );
    }
    return dashboardProjectDbProject;
  }

  public static async getDbProjectsList(
    {
      dashboard_project_id,
      limit = 25,
      offset = 0,
    }: {
      dashboard_project_id: string;
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // TODO: consider to also do checks here that the projects are actually of type
    // * Dashboard and
    // * DB
    const queryBuilder = ncMeta
      .knex(MetaTable.PROJECT)
      .select(
        `${MetaTable.PROJECT}.*`,
        // TODO: add here more project fields if needed
        `${MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS}.dashboard_project_id`,
      )
      .offset(offset)
      .limit(limit);

    queryBuilder.join(
      MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
      function () {
        this.on(
          `${MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS}.db_project_id`,
          '=',
          `${MetaTable.PROJECT}.id`,
        ).andOn(
          `${MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS}.dashboard_project_id`,
          '=',
          ncMeta.knex.raw('?', [dashboard_project_id]),
        );
      },
    );

    return await queryBuilder;
  }

  static async delete(
    dashboardProjectId: string,
    dbProjectId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // const { email } = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
    //   id: dbProjectId,
    // });
    // if (email) {
    //   await NocoCache.delAll(CacheScope., `${email}*`);
    // }

    // remove from list cache
    // const cachedList = await NocoCache.getList(CacheScope.USER_PROJECT, [
    //   dbProjectId,
    // ]);
    // let { list: cachedProjectList } = cachedList;
    // const { isNoneList } = cachedList;
    // if (!isNoneList && cachedProjectList?.length) {
    //   cachedProjectList = cachedProjectList.filter(
    //     (p) => p.id !== dashboardProjectId,
    //   );
    //   await NocoCache.setList(
    //     CacheScope.USER_PROJECT,
    //     [dbProjectId],
    //     cachedProjectList,
    //   );
    // }

    // await NocoCache.del(
    //   `${CacheScope.PROJECT_USER}:${dashboardProjectId}:${dbProjectId}`,
    // );
    return await ncMeta.metaDelete(
      null,
      null,
      MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
      {
        dashboard_project_id: dashboardProjectId,
        db_project_id: dbProjectId,
      },
    );
  }

  static async getDashboardProjectsIdList(
    dbProjectId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<DashboardProjectDBProject[]> {
    return await ncMeta.metaList2(
      null,
      null,
      MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
      {
        condition: { db_project_id: dbProjectId },
      },
    );
  }

  static async getDashboardProjectsList(
    dbProjectId: string,
    _params?: any,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectType[]> {
    // todo: pagination
    // const cachedList = await NocoCache.getList(
    //   CacheScope.DASHBOARD_PROJECT_DB_PROJECT_LINKING,
    //   [dbProjectId],
    // );
    // let { list: dashboardProjectList } = cachedList;
    // const { isNoneList } = cachedList;

    // if (!isNoneList && dashboardProjectList.length) {
    //   return dashboardProjectList;
    // }

    const dashboardProjectList = await ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .innerJoin(MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS, function () {
        this.on(
          `${MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS}.dashboard_project_id`,
          `${MetaTable.PROJECT}.id`,
        );
        this.andOn(
          `${MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS}.db_project_id`,
          ncMeta.knex.raw('?', [dbProjectId]),
        );
      })
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      });

    // if (dashboardProjectList?.length) {
    //   await NocoCache.setList(
    //     CacheScope.DASHBOARD_PROJECT_DB_PROJECT_LINKING,
    //     [dbProjectId],
    //     dashboardProjectList,
    //   );
    // }

    return dashboardProjectList;
  }
}
