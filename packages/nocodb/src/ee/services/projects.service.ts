import { promisify } from 'util';
import { ProjectsService as ProjectsServiceCE } from 'src/services/projects.service';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import { AppEvents, OrgUserRoles } from 'nocodb-sdk';
import type { ProjectReqType } from 'nocodb-sdk';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import syncMigration from '~/helpers/syncMigration';
import {
  DashboardProjectDBProject,
  Project,
  ProjectUser,
  WorkspaceUser,
} from '~/models';
import Noco from '~/Noco';
import { getToolDir } from '~/utils/nc-config';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { TablesService } from '~/services/tables.service';
import extractRolesObj from '~/utils/extractRolesObj';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

const validateUserHasReadPermissionsForLinkedDbProjects = async (
  dbProjectIds: string[],
  user: {
    id: string;
    roles: string[];
  },
) => {
  await Promise.all(
    dbProjectIds?.map(async (dbProjectId: string) => {
      const dbProject = await Project.get(dbProjectId);
      if (!dbProject) {
        NcError.badRequest(
          `Linked db project with id ${dbProjectId} not found`,
        );
      }

      // Find the workspace-user association for the current user and the workspace of the linked db project
      const workspaceUser = await WorkspaceUser.get(
        (dbProject as Project).fk_workspace_id,
        user.id,
      );

      if (!workspaceUser) {
        NcError.forbidden(
          'User does not have read permissions for workspace of the linked db project',
        );
      }

      // TODO: double check with team whether checking the ProjectUser table is meaningful or sufficient
      // Background: checked if I still can access DB projects via NocoDB UI after I removed all entries from ProjectUser table
      // and restarted server. I could still access the DB projects via NocoDB UI.
      // After removing the workspace-user association though, I coudln't access it anymore.
      const dbProjectUser = await ProjectUser.get(dbProjectId, user.id);
      if (!dbProjectUser) {
        NcError.forbidden(
          'User does not have read permissions for linked db project',
        );
      }
    }),
  );
};

@Injectable()
export class ProjectsService extends ProjectsServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
    protected tablesService: TablesService,
  ) {
    super(appHooksService, metaService, tablesService);
  }

  async projectList(param: {
    user: { id: string; roles: Record<string, boolean> };
    query?: any;
  }) {
    const projects =
      extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN] &&
      !['shared', 'starred', 'recent'].some((k) => k in param.query)
        ? await Project.list(param.query)
        : await ProjectUser.getProjectsList(param.user.id, param.query);

    return projects;
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
        const dataConfig = await NcConnectionMgrv2.getDataConfig();
        if (dataConfig?.client === 'pg') {
          projectBody.prefix = '';
          projectBody.bases = [
            {
              type: 'pg',
              is_local: true,
              is_meta: false,
              config: {
                schema: projectId,
              },
              inflection_column: 'camelize',
              inflection_table: 'camelize',
            },
          ];
        } else {
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
              is_local: true,
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
        }
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

    // TODO: check that the current user has at leas reading permissions for all linked_db_projects
    if (
      param.project.type === 'dashboard' &&
      projectBody.linked_db_project_ids?.length > 0
    ) {
      await validateUserHasReadPermissionsForLinkedDbProjects(
        projectBody.linked_db_project_ids,
        param.user,
      );
    }

    projectBody.title = DOMPurify.sanitize(projectBody.title);
    projectBody.slug = projectBody.title;

    const project = await Project.createProject(projectBody);

    // TODO: consider to also include check if the project is of type Dashboard
    // (because probably also in the future no other project types will be tied to db projects)
    if (projectBody.linked_db_project_ids?.length > 0) {
      await Promise.all(
        projectBody.linked_db_project_ids?.map(async (dbProjectId: string) => {
          await DashboardProjectDBProject.insert({
            dashboard_project_id: project.id,
            db_project_id: dbProjectId,
          });
        }),
      );
    }

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

  protected async validateProjectTitle(
    _data: Partial<Project>,
    _project: Project,
  ) {}
}
