import ProjectCE from 'src/models/Project';
import { ProjectRoles, ProjectTypes } from 'nocodb-sdk';
import type { ProjectType } from 'nocodb-sdk';
import DashboardProjectDBProject from '~/models/DashboardProjectDBProject';
import Noco from '~/Noco';

import Base from '~/models/Base';
import { ProjectUser } from '~/models';
import NocoCache from '~/cache/NocoCache';

import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  type DB_TYPES,
  MetaTable,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';

export default class Project extends ProjectCE {
  public type?: 'database' | 'documentation' | 'dashboard';
  public fk_workspace_id?: string;

  public static castType(project: Project): Project {
    return project && new Project(project);
  }

  static async list(
    // @ts-ignore
    param,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectCE[]> {
    // todo: pagination
    const cachedList = await NocoCache.getList(CacheScope.PROJECT, []);
    let { list: projectList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !projectList.length) {
      projectList = await ncMeta.metaList2(null, null, MetaTable.PROJECT, {
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
      await NocoCache.setList(CacheScope.PROJECT, [], projectList);
    }
    projectList = projectList.filter(
      (p) => p.deleted === 0 || p.deleted === false || p.deleted === null,
    );
    return projectList
      .map((m) => new Project(m))
      .filter((p) => !param?.type || p.type === param.type);
  }

  public static async createProject(
    project: Partial<ProjectType>,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectCE> {
    const insertObj = extractProps(project, [
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

    const { id: projectId } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.PROJECT,
      insertObj,
    );

    await NocoCache.appendToList(
      CacheScope.PROJECT,
      [],
      `${CacheScope.PROJECT}:${projectId}`,
    );

    for (const base of project.bases) {
      await Base.createBase(
        {
          type: base.config?.client as (typeof DB_TYPES)[number],
          ...base,
          projectId,
        },
        ncMeta,
      );
    }

    await NocoCache.del(CacheScope.INSTANCE_META);
    return this.getWithInfo(projectId, ncMeta);
  }

  // @ts-ignore
  static async update(
    projectId: string,
    project: Partial<Project> & { fk_workspace_id?: string },
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const updateObj = extractProps(project, [
      'title',
      'prefix',
      'status',
      'description',
      'meta',
      'color',
      'deleted',
      'order',
      'bases',
      'uuid',
      'password',
      'roles',
      'fk_workspace_id',
    ]);
    // get existing cache
    const key = `${CacheScope.PROJECT}:${projectId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      // new uuid is generated
      if (o.uuid && updateObj.uuid && o.uuid !== updateObj.uuid) {
        await NocoCache.del(`${CacheScope.PROJECT}:${o.uuid}`);
        await NocoCache.set(
          `${CacheScope.PROJECT}:${updateObj.uuid}`,
          projectId,
        );
      }
      // disable shared base
      if (o.uuid && updateObj.uuid === null) {
        await NocoCache.del(`${CacheScope.PROJECT}:${o.uuid}`);
      }
      if (o.title && updateObj.title && o.title !== updateObj.title) {
        await NocoCache.del(`${CacheScope.PROJECT}:${o.title}`);
        await NocoCache.set(
          `${CacheScope.PROJECT}:${updateObj.title}`,
          projectId,
        );
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
      projectId,
    );
  }

  static async getWithInfo(
    projectId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectCE> {
    let project: Project = await super.getWithInfo(projectId, ncMeta);

    if (project && project.type === ProjectTypes.DASHBOARD) {
      project = new Project(project);
      await project.getLinkedDbProjects(ncMeta);
    }

    return project as ProjectCE;
  }

  // Todo: Remove the project entry from the connection pool in NcConnectionMgrv2
  static async delete(projectId, ncMeta = Noco.ncMeta): Promise<any> {
    let project = await this.get(projectId);
    const users = await ProjectUser.getUsersList({
      project_id: projectId,
      workspace_id: (project as Project).fk_workspace_id,
      offset: 0,
      limit: 1000,
    });

    for (const user of users) {
      await ProjectUser.delete(projectId, user.id);
    }

    const bases = await Base.list({ projectId });
    for (const base of bases) {
      await base.delete(ncMeta);
    }
    project = await this.get(projectId);

    if (project) {
      // delete <scope>:<uuid>
      await NocoCache.del(`${CacheScope.PROJECT}:${project.uuid}`);
      // delete <scope>:<title>
      await NocoCache.del(`${CacheScope.PROJECT}:${project.title}`);
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${project.title}`);
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${project.id}`);
    }

    await NocoCache.delAll(CacheScope.USER_PROJECT, '*');

    await NocoCache.deepDel(
      CacheScope.PROJECT,
      `${CacheScope.PROJECT}:${projectId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await ncMeta.metaDelete(null, null, MetaTable.AUDIT, {
      project_id: projectId,
    });

    return await ncMeta.metaDelete(null, null, MetaTable.PROJECT, projectId);
  }

  // EXTRA METHODS

  static listByWorkspaceAndUser? = async (
    fk_workspace_id: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) => {
    // Todo: caching , pagination, query optimisation

    const projectListQb = ncMeta
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
          `${MetaTable.PROJECT_USERS}.project_id`,
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
      .whereNot(`project_role`, ProjectRoles.NO_ACCESS);

    const projects = await projectListQb;

    // parse meta
    for (const project of projects) {
      project.meta = parseMetaProp(project);
    }

    const castedProjectList = projects.map((m) => this.castType(m));

    await Promise.all(
      castedProjectList.map((project) => project.getBases(ncMeta)),
    );

    return castedProjectList;
  };

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
