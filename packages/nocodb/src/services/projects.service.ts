import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  SqlUiFactory,
} from 'nocodb-sdk';
import type {
  ProjectReqType,
  ProjectUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractPropsAndSanitize } from '~/helpers/extractProps';
import syncMigration from '~/helpers/syncMigration';
import { Project, ProjectUser } from '~/models';
import Noco from '~/Noco';
import { getToolDir } from '~/utils/nc-config';
import { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { TablesService } from '~/services/tables.service';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

@Injectable()
export class ProjectsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
    protected tablesService: TablesService,
  ) {}

  async projectList(param: {
    user: { id: string; roles: Record<string, boolean> };
    query?: any;
  }) {
    const projects = extractRolesObj(param.user?.roles)[
      OrgUserRoles.SUPER_ADMIN
    ]
      ? await Project.list(param.query)
      : await ProjectUser.getProjectsList(param.user.id, param.query);

    return projects;
  }

  async getProjectWithInfo(param: { projectId: string }) {
    const project = await Project.getWithInfo(param.projectId);
    return project;
  }

  sanitizeProject(project: any) {
    const sanitizedProject = { ...project };
    sanitizedProject.bases?.forEach((b: any) => {
      ['config'].forEach((k) => delete b[k]);
    });
    return sanitizedProject;
  }

  async projectUpdate(param: {
    projectId: string;
    project: ProjectUpdateReqType;
    user: UserType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUpdateReq',
      param.project,
    );

    const project = await Project.getWithInfo(param.projectId);

    const data: Partial<Project> = extractPropsAndSanitize(
      param?.project as Project,
      ['title', 'meta', 'color', 'status'],
    );
    await this.validateProjectTitle(data, project);

    const result = await Project.update(param.projectId, data);

    this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
      project,
      user: param.user,
    });

    return result;
  }

  protected async validateProjectTitle(
    data: Partial<Project>,
    project: Project,
  ) {
    if (
      data?.title &&
      project.title !== data.title &&
      (await Project.getByTitle(data.title))
    ) {
      NcError.badRequest('Project title already in use');
    }
  }

  async projectSoftDelete(param: { projectId: any; user: UserType }) {
    const project = await Project.getWithInfo(param.projectId);

    if (!project) {
      NcError.notFound('Project not found');
    }

    await Project.softDelete(param.projectId);

    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      project,
      user: param.user,
    });

    return true;
  }

  async projectCreate(param: { project: ProjectReqType; user: any }) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectReq',
      param.project,
    );

    const projectId = await this.metaService.genNanoid(MetaTable.PROJECT);

    const projectBody: ProjectReqType & Record<string, any> = param.project;
    projectBody.id = projectId;

    if (!projectBody.external) {
      const ranId = nanoid();
      projectBody.prefix = `nc_${ranId}__`;
      projectBody.is_meta = true;
      if (process.env.NC_MINIMAL_DBS === 'true') {
        // if env variable NC_MINIMAL_DBS is set, then create a SQLite file/connection for each project
        // each file will be named as nc_<random_id>.db
        const fs = require('fs');
        const toolDir = getToolDir();
        const nanoidv2 = customAlphabet(
          '1234567890abcdefghijklmnopqrstuvwxyz',
          14,
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
            is_meta: false,
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

    projectBody.title = DOMPurify.sanitize(projectBody.title);
    projectBody.slug = projectBody.title;

    const project = await Project.createProject(projectBody);

    // TODO: create n:m instances here
    await ProjectUser.insert({
      fk_user_id: (param as any).user.id,
      project_id: project.id,
      roles: 'owner',
    });

    await syncMigration(project);

    // populate metadata if existing table
    for (const base of await project.getBases()) {
      if (process.env.NC_CLOUD !== 'true' && !project.is_meta) {
        const info = await populateMeta(base, project);

        this.appHooksService.emit(AppEvents.APIS_CREATED, {
          info,
        });

        delete base.config;
      }
    }

    this.appHooksService.emit(AppEvents.PROJECT_CREATE, {
      project,
      user: param.user,
      xcdb: !projectBody.external,
    });

    return project;
  }

  async createDefaultProject(param: { user: UserType }) {
    const project = await this.projectCreate({
      project: {
        title: 'Getting Started',
        type: 'database',
      } as any,
      user: param.user,
    });

    const sqlUI = SqlUiFactory.create({ client: project.bases[0].type });
    const columns = sqlUI?.getNewTableColumns() as any;

    const table = await this.tablesService.tableCreate({
      projectId: project.id,
      baseId: project.bases[0].id,
      table: {
        title: 'Features',
        table_name: 'Features',
        columns,
      },
      user: param.user,
    });

    (project as any).tables = [table];

    return project;
  }
}
