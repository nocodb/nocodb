import type { BoolType, MetaType, ProjectType } from 'nocodb-sdk';
import Base from '~/models/Base';
import { ProjectUser } from '~/models';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  type DB_TYPES,
  MetaTable,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export default class Project implements ProjectType {
  public id: string;
  public title: string;
  public prefix: string;
  public status: string;
  public description: string;
  public meta: MetaType;
  public color: string;
  public deleted: BoolType;
  public order: number;
  public is_meta = false;
  public bases?: Base[];
  public linked_db_projects?: Project[];

  // shared base props
  uuid?: string;
  password?: string;
  roles?: string;

  constructor(project: Partial<Project>) {
    Object.assign(this, project);
  }

  public static castType(project: Project): Project {
    return project && new Project(project);
  }

  public static async createProject(
    project: Partial<ProjectType>,
    ncMeta = Noco.ncMeta,
  ): Promise<Project> {
    const insertObj = extractProps(project, [
      'id',
      'title',
      'prefix',
      'description',
      'is_meta',
      'status',
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

  static async list(
    // @ts-ignore
    param,
    ncMeta = Noco.ncMeta,
  ): Promise<Project[]> {
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
    const castedProjectList = projectList.map((m) => this.castType(m));

    await Promise.all(
      castedProjectList.map((project) => project.getBases(ncMeta)),
    );

    return castedProjectList;
  }

  // @ts-ignore
  static async get(projectId: string, ncMeta = Noco.ncMeta): Promise<Project> {
    let projectData =
      projectId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${projectId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!projectData) {
      projectData = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        id: projectId,
        deleted: false,
      });
      if (projectData) {
        projectData.meta = parseMetaProp(projectData);
        await NocoCache.set(`${CacheScope.PROJECT}:${projectId}`, projectData);
      }
    } else {
      if (projectData.deleted) {
        projectData = null;
      }
    }
    return this.castType(projectData);
  }

  async getBases(ncMeta = Noco.ncMeta): Promise<Base[]> {
    return (this.bases = await Base.list({ projectId: this.id }, ncMeta));
  }

  // todo: hide credentials
  // @ts-ignore
  static async getWithInfo(
    projectId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Project> {
    let projectData =
      projectId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${projectId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!projectData) {
      projectData = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        id: projectId,
        deleted: false,
      });
      if (projectData) {
        projectData.meta = parseMetaProp(projectData);
        await NocoCache.set(`${CacheScope.PROJECT}:${projectId}`, projectData);
      }
      if (projectData?.uuid) {
        await NocoCache.set(
          `${CacheScope.PROJECT}:${projectData.uuid}`,
          projectId,
        );
      }
    } else {
      if (projectData?.deleted) {
        projectData = null;
      }
    }
    if (projectData) {
      const project = new Project(projectData);
      await project.getBases(ncMeta);

      return this.castType(project);
    }
    return null;
  }

  // @ts-ignore
  static async softDelete(
    projectId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    await this.clearConnectionPool(projectId, ncMeta);

    // get existing cache
    const key = `${CacheScope.PROJECT}:${projectId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // delete <scope>:<id>
      await NocoCache.del(`${CacheScope.PROJECT}:${projectId}`);
      // delete <scope>:<title>
      await NocoCache.del(`${CacheScope.PROJECT}:${o.title}`);
      // delete <scope>:<uuid>
      await NocoCache.del(`${CacheScope.PROJECT}:${o.uuid}`);
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${o.title}`);
      await NocoCache.del(`${CacheScope.PROJECT}:ref:${o.id}`);
    }

    await NocoCache.delAll(CacheScope.USER_PROJECT, '*');

    await NocoCache.del(CacheScope.INSTANCE_META);

    // remove item in cache list
    await NocoCache.deepDel(
      CacheScope.PROJECT,
      `${CacheScope.PROJECT}:${projectId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      { deleted: true },
      projectId,
    );
  }

  // @ts-ignore
  static async update(
    projectId: string,
    project: Partial<Project>,
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

  // Todo: Remove the project entry from the connection pool in NcConnectionMgrv2
  static async delete(projectId, ncMeta = Noco.ncMeta): Promise<any> {
    let project = await this.get(projectId);
    const users = await ProjectUser.getUsersList({
      project_id: projectId,
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

  static async getByUuid(uuid, ncMeta = Noco.ncMeta) {
    const projectId =
      uuid &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${uuid}`,
        CacheGetType.TYPE_OBJECT,
      ));
    let projectData = null;
    if (!projectId) {
      projectData = await Noco.ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        uuid,
      });
      if (projectData) {
        projectData.meta = parseMetaProp(projectData);
        await NocoCache.set(`${CacheScope.PROJECT}:${uuid}`, projectData?.id);
      }
    } else {
      return this.get(projectId);
    }
    return projectData?.id && this.get(projectData?.id, ncMeta);
  }

  static async getWithInfoByTitle(title: string, ncMeta = Noco.ncMeta) {
    const project = await this.getByTitle(title, ncMeta);
    if (project) await project.getBases(ncMeta);

    return project;
  }

  static async getByTitle(title: string, ncMeta = Noco.ncMeta) {
    const projectId =
      title &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${title}`,
        CacheGetType.TYPE_OBJECT,
      ));
    let projectData = null;
    if (!projectId) {
      projectData = await Noco.ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        title,
        deleted: false,
      });
      if (projectData) {
        projectData.meta = parseMetaProp(projectData);
        await NocoCache.set(`${CacheScope.PROJECT}:${title}`, projectData?.id);
      }
    } else {
      return this.get(projectId);
    }
    return projectData?.id && this.get(projectData?.id, ncMeta);
  }

  static async getByTitleOrId(titleOrId: string, ncMeta = Noco.ncMeta) {
    const projectId =
      titleOrId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:ref:${titleOrId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    let projectData = null;
    if (!projectId) {
      projectData = await Noco.ncMeta.metaGet2(
        null,
        null,
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

      if (projectData) {
        // parse meta
        projectData.meta = parseMetaProp(projectData);

        await NocoCache.set(
          `${CacheScope.PROJECT}:ref:${titleOrId}`,
          projectData?.id,
        );
      }
    } else {
      return this.get(projectId);
    }
    return projectData?.id && this.get(projectData?.id, ncMeta);
  }

  static async getWithInfoByTitleOrId(titleOrId: string, ncMeta = Noco.ncMeta) {
    const project = await this.getByTitleOrId(titleOrId, ncMeta);

    // parse meta
    project.meta = parseMetaProp(project);

    if (project) await project.getBases(ncMeta);

    return project;
  }

  static async clearConnectionPool(projectId: string, ncMeta = Noco.ncMeta) {
    const project = await this.get(projectId, ncMeta);
    if (project) {
      const bases = await project.getBases(ncMeta);
      for (const base of bases) {
        await NcConnectionMgrv2.deleteAwait(base);
      }
    }
  }
}
