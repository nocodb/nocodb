import Base from './/Base';
import Noco from '../Noco';
import { ProjectType } from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import { extractProps } from '../meta/helpers/extractProps';
import NocoCache from '../cache/NocoCache';

export default class Project implements ProjectType {
  public id: string;
  public title: string;
  public prefix: string;
  public status: string;
  public description: string;
  public meta: string;
  public color: string;
  public deleted: string;
  public order: number;
  public is_meta = false;
  public bases?: Base[];

  created_at: any;
  updated_at: any;

  // shared base props
  uuid?: string;
  password?: string;
  roles?: string;

  constructor(project: Partial<Project>) {
    Object.assign(this, project);
  }

  public static async createProject(
    projectBody: ProjectType & {
      created_at?;
      updated_at?;
    },
    ncMeta = Noco.ncMeta
  ): Promise<Project> {
    const { id: projectId } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.PROJECT,
      {
        id: projectBody?.id,
        title: projectBody.title,
        prefix: projectBody.prefix,
        description: projectBody.description,
        is_meta: projectBody.is_meta,
        created_at: projectBody.created_at,
        updated_at: projectBody.updated_at,
      }
    );

    await NocoCache.appendToList(
      CacheScope.PROJECT,
      [],
      `${CacheScope.PROJECT}:${projectId}`
    );

    for (const base of projectBody.bases) {
      await Base.createBase(
        {
          type: base.config?.client,
          ...base,
          projectId,
        },
        ncMeta
      );
    }

    await NocoCache.del(CacheScope.INSTANCE_META);
    return this.getWithInfo(projectId, ncMeta);
  }

  static async list(
    // @ts-ignore
    param,
    ncMeta = Noco.ncMeta
  ): Promise<Project[]> {
    // todo: pagination
    let projectList = await NocoCache.getList(CacheScope.PROJECT, []);
    if (!projectList.length) {
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
      (p) => p.deleted === 0 || p.deleted === false || p.deleted === null
    );
    return projectList.map((m) => new Project(m));
  }

  // @ts-ignore
  static async get(projectId: string, ncMeta = Noco.ncMeta): Promise<Project> {
    let projectData =
      projectId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${projectId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!projectData) {
      projectData = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        id: projectId,
        deleted: false,
      });
      await NocoCache.set(`${CacheScope.PROJECT}:${projectId}`, projectData);
    } else {
      if (projectData.deleted) {
        projectData = null;
      }
    }
    return projectData && new Project(projectData);
  }

  async getBases(ncMeta = Noco.ncMeta): Promise<Base[]> {
    return (this.bases = await Base.list({ projectId: this.id }, ncMeta));
  }

  // todo: hide credentials
  // @ts-ignore
  static async getWithInfo(
    projectId: string,
    ncMeta = Noco.ncMeta
  ): Promise<Project> {
    let projectData =
      projectId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${projectId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!projectData) {
      projectData = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        id: projectId,
        deleted: false,
      });
      await NocoCache.set(`${CacheScope.PROJECT}:${projectId}`, projectData);
      if (projectData?.uuid) {
        await NocoCache.set(
          `${CacheScope.PROJECT}:${projectData.uuid}`,
          projectId
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
      return project;
    }
    return null;
  }

  // Todo: Remove the project entry from the connection pool in NcConnectionMgrv2
  // @ts-ignore
  static async softDelete(
    projectId: string,
    ncMeta = Noco.ncMeta
  ): Promise<any> {
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
      CacheDelDirection.CHILD_TO_PARENT
    );

    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      { deleted: true },
      projectId
    );
  }

  // @ts-ignore
  static async update(
    projectId: string,
    project: Partial<Project>,
    ncMeta = Noco.ncMeta
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
          projectId
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
          projectId
        );
      }
      o = { ...o, ...updateObj };

      await NocoCache.del(CacheScope.INSTANCE_META);

      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      updateObj,
      projectId
    );
  }

  // Todo: Remove the project entry from the connection pool in NcConnectionMgrv2
  static async delete(projectId, ncMeta = Noco.ncMeta): Promise<any> {
    const bases = await Base.list({ projectId });
    for (const base of bases) {
      await base.delete(ncMeta);
    }
    const project = await this.get(projectId);

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
      CacheDelDirection.CHILD_TO_PARENT
    );
    return await ncMeta.metaDelete(null, null, MetaTable.PROJECT, projectId);
  }

  static async getByUuid(uuid, ncMeta = Noco.ncMeta) {
    const projectId =
      uuid &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${uuid}`,
        CacheGetType.TYPE_OBJECT
      ));
    let projectData = null;
    if (!projectId) {
      projectData = await Noco.ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        uuid,
      });
      await NocoCache.set(`${CacheScope.PROJECT}:${uuid}`, projectData?.id);
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
        CacheGetType.TYPE_OBJECT
      ));
    let projectData = null;
    if (!projectId) {
      projectData = await Noco.ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
        title,
        deleted: false,
      });
      await NocoCache.set(`${CacheScope.PROJECT}:${title}`, projectData?.id);
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
        CacheGetType.TYPE_OBJECT
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
        }
      );
      await NocoCache.set(
        `${CacheScope.PROJECT}:ref:${titleOrId}`,
        projectData?.id
      );
    } else {
      return this.get(projectId);
    }
    return projectData?.id && this.get(projectData?.id, ncMeta);
  }

  static async getWithInfoByTitleOrId(titleOrId: string, ncMeta = Noco.ncMeta) {
    const project = await this.getByTitleOrId(titleOrId, ncMeta);
    if (project) await project.getBases(ncMeta);

    return project;
  }
}
