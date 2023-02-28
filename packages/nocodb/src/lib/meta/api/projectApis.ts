import { Request, Response } from 'express';
import { ProjectType } from 'nocodb-sdk';
import Project from '../../models/Project';
import { ProjectListType } from 'nocodb-sdk';
import DOMPurify from 'isomorphic-dompurify';
import { packageVersion } from '../../utils/packageVersion';
import { Tele } from 'nc-help';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import syncMigration from '../helpers/syncMigration';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import ProjectUser from '../../models/ProjectUser';
import { customAlphabet } from 'nanoid';
import Noco from '../../Noco';
import isDocker from 'is-docker';
import { NcError } from '../helpers/catchError';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { extractProps, extractPropsAndSanitize } from '../helpers/extractProps';
import NcConfigFactory from '../../utils/NcConfigFactory';
import { promisify } from 'util';
import { populateMeta } from './helpers';
import Filter from '../../models/Filter';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

// // Project CRUD

export async function projectGet(
  req: Request<any, any, any>,
  res: Response<Project>
) {
  const project = await Project.getWithInfo(req.params.projectId);

  if (!project) {
    NcError.notFound('Project not found');
  }

  // delete datasource connection details
  project.bases?.forEach((b) => {
    ['config'].forEach((k) => delete b[k]);
  });

  // update updated_at whenever api is called
  ProjectUser.updateOrInsert(project.id, req['user']?.id, {}).catch(() => {});

  res.json(project);
}

async function handleGetPublicProject(req, res, next) {
  if (req?.headers['xc-auth']) {
    next();
    return;
  }

  try {
    const project = await Project.getWithInfo(req.params.projectId);
    const projectMeta = JSON.parse(project.meta);

    if (projectMeta?.isPublic) {
      res.json({
        id: project.id,
        title: project.title,
        meta: project.meta,
        isPublicView: true,
      });

      return;
    }
  } catch (e) {
    console.log(e);
  }

  next();
}

export async function projectUpdate(
  req: Request<any, any, any>,
  res: Response<ProjectListType>
) {
  const project = await Project.getWithInfo(req.params.projectId);

  if (!project) {
    NcError.notFound('Project not found');
  }

  const data: Partial<Project> = extractPropsAndSanitize(req.body, [
    'title',
    'meta',
    'color',
  ]);

  const result = await Project.update(req.params.projectId, data);
  Tele.emit('evt', { evt_type: 'project:update' });
  res.json(result);
}

export async function projectUserMetaUpdate(
  req: Request<any, any, any>,
  res: Response
) {
  // update project user data
  const projectUserData = extractProps(req.body, [
    'starred',
    'order',
    'hidden',
  ]);

  if (Object.keys(projectUserData).length) {
    // create new project user if it doesn't exist
    if (!(await ProjectUser.get(req['ncProjectId'], req['user']?.id))) {
      await ProjectUser.insert({
        ...projectUserData,
        project_id: req['ncProjectId'],
        fk_user_id: req['user']?.id,
      });
    } else {
      await ProjectUser.update(
        req['ncProjectId'],
        req['user']?.id,
        projectUserData
      );
    }
  }
  res.json({ msg: 'success' });
}

// todo: limit return fields
export async function projectList(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response<ProjectListType>,
  next
) {
  try {
    // const projects = req.user?.roles?.includes(OrgUserRoles.SUPER_ADMIN)
    //   ? await Project.list(req.query)
    //   : await ProjectUser.getProjectsList(req.user.id, req.query);
    const projects = await ProjectUser.getProjectsList(req.user.id, req.query);

    res // todo: pagination
      .json(
        new PagedResponseImpl(projects as ProjectType[], {
          count: projects.length,
          limit: projects.length,
        })
      );
  } catch (e) {
    console.log(e);
    next(e);
  }
}

export async function projectDelete(
  req: Request<any>,
  res: Response<ProjectListType>
) {
  const result = await Project.softDelete(req.params.projectId);
  Tele.emit('evt', { evt_type: 'project:deleted' });
  res.json(result);
}

//
//

async function projectCreate(req: Request<any, any>, res) {
  const projectBody = req.body;
  if (!projectBody.external) {
    const ranId = nanoid();
    projectBody.prefix = `nc_${ranId}__`;
    projectBody.is_meta = true;
    projectBody.type = req.body.type;
    projectBody.fk_workspace_id = req.body.fk_workspace_id;

    if (process.env.NC_MINIMAL_DBS) {
      // if env variable NC_MINIMAL_DBS is set, then create a SQLite file/connection for each project
      // each file will be named as nc_<random_id>.db
      const fs = require('fs');
      const toolDir = NcConfigFactory.getToolDir();
      const nanoidv2 = customAlphabet(
        '1234567890abcdefghijklmnopqrstuvwxyz',
        14
      );
      if (!(await promisify(fs.exists)(`${toolDir}/nc_minimal_dbs`))) {
        await promisify(fs.mkdir)(`${toolDir}/nc_minimal_dbs`);
      }
      const dbId = nanoidv2();
      const projectTitle = DOMPurify.sanitize(projectBody.title);
      projectBody.prefix = '';
      projectBody.bases = [
        {
          type: 'sqlite3',
          config: {
            client: 'sqlite3',
            connection: {
              client: 'sqlite3',
              database: projectTitle,
              connection: {
                filename: `${toolDir}/nc_minimal_dbs/${projectTitle}_${dbId}.db`,
              },
            },
          },
          inflection_column: 'camelize',
          inflection_table: 'camelize',
        },
      ];
    } else {
      const db = Noco.getConfig().meta?.db;
      projectBody.bases = [
        {
          type: db?.client,
          config: null,
          is_meta: true,
          inflection_column: 'camelize',
          inflection_table: 'camelize',
        },
      ];
    }
  } else {
    if (process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED) {
      NcError.badRequest('Connecting to external db is disabled');
    }
    projectBody.is_meta = false;
  }

  if (projectBody?.title.length > 50) {
    NcError.badRequest('Project title exceeds 50 characters');
  }

  // todo: check if project with same title exists
  // if (await Project.getByTitle(projectBody?.title)) {
  //   NcError.badRequest('Project title already in use');
  // }

  projectBody.title = DOMPurify.sanitize(projectBody.title);
  projectBody.slug = projectBody.title;

  const project = await Project.createProject({
    ...projectBody,
    user: (req as any).user,
  });
  await ProjectUser.insert({
    fk_user_id: (req as any).user.id,
    project_id: project.id,
    roles: 'owner',
  });

  await syncMigration(project);

  // populate metadata if existing table
  for (const base of await project.getBases()) {
    const info = await populateMeta(base, project);

    Tele.emit('evt_api_created', info);
    delete base.config;
  }

  Tele.emit('evt', {
    evt_type: 'project:created',
    xcdb: !projectBody.external,
  });

  Tele.emit('evt', { evt_type: 'project:rest' });

  res.json(project);
}

export async function projectInfoGet(_req, res) {
  res.json({
    Node: process.version,
    Arch: process.arch,
    Platform: process.platform,
    Docker: isDocker(),
    RootDB: Noco.getConfig()?.meta?.db?.client,
    PackageVersion: packageVersion,
  });
}

export async function projectCost(req, res) {
  let cost = 0;
  const project = await Project.getWithInfo(req.params.projectId);

  for (const base of project.bases) {
    const sqlClient = await NcConnectionMgrv2.getSqlClient(base);
    const userCount = await ProjectUser.getUsersCount(req.query);
    const recordCount = (await sqlClient.totalRecords())?.data.TotalRecords;

    if (recordCount > 100000) {
      // 36,000 or $79/user/month
      cost = Math.max(36000, 948 * userCount);
    } else if (recordCount > 50000) {
      // $36,000 or $50/user/month
      cost = Math.max(36000, 600 * userCount);
    } else if (recordCount > 10000) {
      // $240/user/yr
      cost = Math.min(240 * userCount, 36000);
    } else if (recordCount > 1000) {
      // $120/user/yr
      cost = Math.min(120 * userCount, 36000);
    }
  }

  Tele.event({
    event: 'a:project:cost',
    data: {
      cost,
    },
  });

  res.json({ cost });
}

export async function hasEmptyOrNullFilters(req, res) {
  res.json(await Filter.hasEmptyOrNullFilters(req.params.projectId));
}

export default (router) => {
  router.get(
    '/api/v1/db/meta/projects/:projectId/info',
    metaApiMetrics,
    ncMetaAclMw(projectInfoGet, 'projectInfoGet')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    handleGetPublicProject,
    ncMetaAclMw(projectGet, 'projectGet')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId/user',
    metaApiMetrics,
    // todo: refactor method name and path
    ncMetaAclMw(projectUserMetaUpdate, 'projectUserMetaUpdate')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectUpdate, 'projectUpdate')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/cost',
    metaApiMetrics,
    ncMetaAclMw(projectCost, 'projectCost')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectDelete, 'projectDelete')
  );
  router.post(
    '/api/v1/db/meta/projects',
    metaApiMetrics,
    ncMetaAclMw(projectCreate, 'projectCreate')
  );
  router.get(
    '/api/v1/db/meta/projects',
    metaApiMetrics,
    ncMetaAclMw(projectList, 'projectList')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/has-empty-or-null-filters',
    metaApiMetrics,
    ncMetaAclMw(hasEmptyOrNullFilters, 'hasEmptyOrNullFilters')
  );
};
