import { promisify } from 'util';
import { OrgUserRoles } from 'nocodb-sdk';
import DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import { T } from 'nc-help';
import NcConfigFactory from '../utils/NcConfigFactory';
import { NcError } from '../meta/helpers/catchError';
import Noco from '../Noco';
import ProjectUser from '../models/ProjectUser';
import Project from '../models/Project';
import syncMigration from '../meta/helpers/syncMigration';
import { populateMeta, validatePayload } from '../meta/api/helpers';
import { extractPropsAndSanitize } from '../meta/helpers/extractProps';
import type { ProjectReqType, ProjectUpdateReqType } from 'nocodb-sdk';

export async function projectCreate(param: {
  project: ProjectReqType;
  user: any;
}) {
  validatePayload('swagger.json#/components/schemas/ProjectReq', param.project);

  const projectBody: ProjectReqType & Record<string, any> = param.project;
  if (!projectBody.external) {
    const ranId = nanoid();
    projectBody.prefix = `nc_${ranId}__`;
    projectBody.is_meta = true;
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

  if (await Project.getByTitle(projectBody?.title)) {
    // todo: allow duplicate project name
    // NcError.badRequest('Project title already in use');
  }

  projectBody.title = DOMPurify.sanitize(projectBody.title);
  projectBody.slug = projectBody.title;

  const project = await Project.createProject(projectBody);
  await ProjectUser.insert({
    fk_user_id: (param as any).user.id,
    project_id: project.id,
    roles: 'owner',
  });

  await syncMigration(project);

  // populate metadata if existing table
  for (const base of await project.getBases()) {
    const info = await populateMeta(base, project);

    T.emit('evt_api_created', info);
    delete base.config;
  }

  T.emit('evt', {
    evt_type: 'project:created',
    xcdb: !projectBody.external,
  });

  T.emit('evt', { evt_type: 'project:rest' });

  return project;
}

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

export async function getProjectWithInfo(param: { projectId: string }) {
  const project = await Project.getWithInfo(param.projectId);
  return project;
}

export async function projectSoftDelete(param: { projectId: any }) {
  await Project.softDelete(param.projectId);
  T.emit('evt', { evt_type: 'project:deleted' });
  return true;
}

export function sanitizeProject(project: any) {
  const sanitizedProject = { ...project };
  sanitizedProject.bases?.forEach((b: any) => {
    ['config'].forEach((k) => delete b[k]);
  });
  return sanitizedProject;
}

export async function projectUpdate(param: {
  projectId: string;
  project: ProjectUpdateReqType;
}) {
  validatePayload(
    'swagger.json#/components/schemas/ProjectUpdateReq',
    param.project
  );

  const project = await Project.getWithInfo(param.projectId);

  const data: Partial<Project> = extractPropsAndSanitize(
    param?.project as Project,
    ['title', 'meta', 'color']
  );

  if (
    data?.title &&
    project.title !== data.title &&
    (await Project.getByTitle(data.title))
  ) {
    // todo: allow duplicate project name
    // NcError.badRequest('Project title already in use');
  }

  const result = await Project.update(param.projectId, data);
  T.emit('evt', { evt_type: 'project:update' });

  return result;
}

export async function projectList(param: {
  user: { id: string; roles: string };
  query?: any;
}) {
  const projects = param.user?.roles?.includes(OrgUserRoles.SUPER_ADMIN)
    ? await Project.list(param.query)
    : await ProjectUser.getProjectsList(param.user.id, param.query);

  return projects;
}
