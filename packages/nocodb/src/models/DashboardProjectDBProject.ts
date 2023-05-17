import { ProjectTypes } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import Noco from '../Noco';
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

    return this.get(dashboard_project_id, db_project_id, ncMeta);
  }

  static async get(
    dashboardProjectId: string,
    dbProjectId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // TODO: add cache logic
    const dashboardProjectDbProject = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
      {
        dashboard_project_id: dashboardProjectId,
        db_project_id: dbProjectId,
      },
    );
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
    // TODO: consider to also do checks here that the projects are actually of type Dashboard and DB
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
    // TODO: cache cleanup
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

    return dashboardProjectList;
  }
}
