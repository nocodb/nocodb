import { promisify } from 'util';
import { BasesService as BasesServiceCE } from 'src/services/bases.service';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import { AppEvents, OrgUserRoles } from 'nocodb-sdk';
import { extractRolesObj } from 'nocodb-sdk';
import type { ProjectReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import syncMigration from '~/helpers/syncMigration';
import {
  Base,
  BaseUser,
  DashboardProjectDBProject,
  Workspace,
  WorkspaceUser,
} from '~/models';
import Noco from '~/Noco';
import { getToolDir } from '~/utils/nc-config';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { TablesService } from '~/services/tables.service';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

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
      const dbProject = await Base.get(dbProjectId);
      if (!dbProject) {
        NcError.badRequest(`Linked db base with id ${dbProjectId} not found`);
      }

      // Find the workspace-user association for the current user and the workspace of the linked db base
      const workspaceUser = await WorkspaceUser.get(
        (dbProject as Base).fk_workspace_id,
        user.id,
      );

      if (!workspaceUser) {
        NcError.forbidden(
          'User does not have read permissions for workspace of the linked db base',
        );
      }

      // TODO: double check with team whether checking the BaseUser table is meaningful or sufficient
      // Background: checked if I still can access DB bases via NocoDB UI after I removed all entries from BaseUser table
      // and restarted server. I could still access the DB bases via NocoDB UI.
      // After removing the workspace-user association though, I coudln't access it anymore.
      const dbProjectUser = await BaseUser.get(dbProjectId, user.id);
      if (!dbProjectUser) {
        NcError.forbidden(
          'User does not have read permissions for linked db base',
        );
      }
    }),
  );
};

@Injectable()
export class BasesService extends BasesServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
    protected tablesService: TablesService,
  ) {
    super(appHooksService, metaService, tablesService);
  }

  async baseList(param: {
    user: { id: string; roles?: Record<string, boolean> | string };
    query?: any;
  }) {
    const bases =
      extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN] &&
      !['shared', 'starred', 'recent'].some((k) => k in param.query)
        ? await Base.list(param.query)
        : await BaseUser.getProjectsList(param.user.id, param.query);

    return bases;
  }

  async baseCreate(param: { base: ProjectReqType; user: any; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/ProjectReq', param.base);

    if (process.env.TEST !== 'true') {
      const fk_workspace_id = (param.base as any)?.fk_workspace_id;

      if (!fk_workspace_id) {
        NcError.badRequest('fk_workspace_id is required');
      }

      const workspace = await Workspace.get(fk_workspace_id);

      if (!workspace) {
        NcError.badRequest('Workspace not found');
      }

      const basesInWorkspace = await Base.countByWorkspace(fk_workspace_id);
      const baseLimitForWorkspace = await getLimit(
        PlanLimitTypes.BASE_LIMIT,
        fk_workspace_id,
      );

      if (basesInWorkspace >= baseLimitForWorkspace) {
        NcError.badRequest(
          `Only ${baseLimitForWorkspace} bases are allowed, for more please upgrade your plan`,
        );
      }
    }

    const baseId = await this.metaService.genNanoid(MetaTable.PROJECT);

    const baseBody: ProjectReqType & Record<string, any> = param.base;
    baseBody.id = baseId;

    if (!baseBody.external) {
      const ranId = nanoid();
      baseBody.prefix = `nc_${ranId}__`;
      baseBody.is_meta = true;
      if (process.env.NC_MINIMAL_DBS === 'true') {
        const dataConfig = await NcConnectionMgrv2.getDataConfig();
        if (dataConfig?.client === 'pg') {
          baseBody.prefix = '';
          baseBody.sources = [
            {
              type: 'pg',
              is_local: true,
              is_meta: false,
              config: {
                schema: baseId,
              },
              inflection_column: 'camelize',
              inflection_table: 'camelize',
            },
          ];
        } else {
          // if env variable NC_MINIMAL_DBS is set, then create a SQLite file/connection for each base
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
          const baseTitle = DOMPurify.sanitize(baseBody.title);
          baseBody.prefix = '';
          baseBody.sources = [
            {
              type: 'sqlite3',
              is_local: true,
              is_meta: false,
              config: {
                client: 'sqlite3',
                connection: {
                  client: 'sqlite3',
                  database: baseTitle,
                  connection: {
                    filename: `${toolDir}/nc_minimal_dbs/${baseTitle}_${dbId}.db`,
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
        baseBody.sources = [
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
      baseBody.is_meta = false;
    }

    if (baseBody?.title.length > 50) {
      NcError.badRequest('Base title exceeds 50 characters');
    }

    // TODO: check that the current user has at leas reading permissions for all linked_db_projects
    if (
      param.base.type === 'dashboard' &&
      baseBody.linked_db_project_ids?.length > 0
    ) {
      await validateUserHasReadPermissionsForLinkedDbProjects(
        baseBody.linked_db_project_ids,
        param.user,
      );
    }

    baseBody.title = DOMPurify.sanitize(baseBody.title);
    baseBody.slug = baseBody.title;

    const base = await Base.createProject(baseBody);

    // TODO: consider to also include check if the base is of type Dashboard
    // (because probably also in the future no other base types will be tied to db bases)
    if (baseBody.linked_db_project_ids?.length > 0) {
      await Promise.all(
        baseBody.linked_db_project_ids?.map(async (dbProjectId: string) => {
          await DashboardProjectDBProject.insert({
            dashboard_project_id: base.id,
            db_project_id: dbProjectId,
          });
        }),
      );
    }

    // TODO: create n:m instances here
    await BaseUser.insert({
      fk_user_id: (param as any).user.id,
      base_id: base.id,
      roles: 'owner',
    });

    await syncMigration(base);

    // populate metadata if existing table
    for (const source of await base.getSources()) {
      if (process.env.NC_CLOUD !== 'true' && !base.is_meta) {
        const info = await populateMeta(source, base);

        this.appHooksService.emit(AppEvents.APIS_CREATED, {
          info,
          req: param.req,
        });

        delete source.config;
      }
    }

    this.appHooksService.emit(AppEvents.PROJECT_CREATE, {
      base,
      user: param.user,
      xcdb: !baseBody.external,
      req: param.req,
    });

    return base;
  }

  protected async validateProjectTitle(_data: Partial<Base>, _project: Base) {}
}
