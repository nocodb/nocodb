import { promisify } from 'util';
import { BasesService as BasesServiceCE } from 'src/services/bases.service';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import { AppEvents, IntegrationsType } from 'nocodb-sdk';
import type { ProjectReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import syncMigration from '~/helpers/syncMigration';
import {
  Base,
  BaseUser,
  DashboardProjectDBProject,
  Integration,
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
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import { DataReflectionService } from '~/services/data-reflection.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { ColumnsService } from '~/services/columns.service';
import { isEE } from '~/utils';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

const validateUserHasReadPermissionsForLinkedDbProjects = async (
  context: NcContext,
  dbProjectIds: string[],
  user: {
    id: string;
    roles: string[];
  },
) => {
  await Promise.all(
    dbProjectIds?.map(async (dbProjectId: string) => {
      const dbProject = await Base.get(context, dbProjectId);
      if (!dbProject) {
        NcError.baseNotFound(dbProjectId);
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
      const dbProjectUser = await BaseUser.get(context, dbProjectId, user.id);
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
    protected columnsService: ColumnsService,
    protected dataReflectionService: DataReflectionService,
    protected paymentService: PaymentService,
  ) {
    super(appHooksService, metaService, tablesService);
  }

  async baseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: Record<string, boolean> | string };
      query?: any;
    },
  ) {
    const bases = await BaseUser.getProjectsList(param.user.id, param.query);

    return bases;
  }

  async baseCreate(param: { base: ProjectReqType; user: any; req: any }) {
    validatePayload('swagger.json#/components/schemas/ProjectReq', param.base);

    if (process.env.TEST !== 'true') {
      const fk_workspace_id = (param.base as any).fk_workspace_id;

      if (!fk_workspace_id) {
        NcError.badRequest('fk_workspace_id is required');
      }

      const workspace = await Workspace.get(fk_workspace_id);

      if (!workspace) {
        NcError.workspaceNotFound(fk_workspace_id);
      }

      const basesInWorkspace = await Base.countByWorkspace(fk_workspace_id);
      const { limit: baseLimitForWorkspace, plan } = await getLimit(
        PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE,
        fk_workspace_id,
      );

      if (basesInWorkspace >= baseLimitForWorkspace) {
        NcError.planLimitExceeded(
          `Only ${baseLimitForWorkspace} bases are allowed, for more please upgrade your plan`,
          {
            plan: plan?.title,
            limit: baseLimitForWorkspace,
            current: basesInWorkspace,
          },
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

      const dataConfig = await NcConnectionMgrv2.getDataConfig();
      if (
        dataConfig?.client === 'pg' &&
        process.env.NC_DISABLE_PG_DATA_REFLECTION !== 'true'
      ) {
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
      } else if (
        dataConfig?.client === 'sqlite3' &&
        process.env.NC_MINIMAL_DBS === 'true'
      ) {
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

      for (const source of baseBody.sources || []) {
        if (!source.fk_integration_id) {
          const integration = await Integration.createIntegration({
            title: source.alias || baseBody.title,
            type: IntegrationsType.Database,
            sub_type: source.config?.client,
            is_private: !!param.req.user?.id,
            config: source.config,
            workspaceId: param.req?.ncWorkspaceId,
            created_by: param.req.user?.id,
          });

          source.fk_integration_id = integration.id;
          source.config = {
            client: baseBody.config?.client,
          };
        }
      }

      baseBody.is_meta = false;
    }

    // Limited for consistent behaviour across identifier names for table, view, columns
    if (baseBody?.title.length > 50) {
      NcError.badRequest('Base title exceeds 50 characters');
    }

    // TODO: check that the current user has at leas reading permissions for all linked_db_projects
    if (
      param.base.type === 'dashboard' &&
      baseBody.linked_db_project_ids?.length > 0
    ) {
      await validateUserHasReadPermissionsForLinkedDbProjects(
        { workspace_id: baseBody.fk_workspace_id, base_id: baseBody.id },
        baseBody.linked_db_project_ids,
        param.user,
      );
    }

    baseBody.title = DOMPurify.sanitize(baseBody.title);
    baseBody.slug = baseBody.title;

    const base = await Base.createProject(baseBody);

    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

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
    await BaseUser.insert(context, {
      fk_user_id: (param as any).user.id,
      base_id: base.id,
      roles: 'owner',
    });

    await syncMigration(base);

    // populate metadata if existing table
    for (const source of await base.getSources()) {
      if (process.env.NC_CLOUD !== 'true' && !base.is_meta) {
        const info = await populateMeta(context, {
          source,
          base,
          user: param.user,
        });

        this.appHooksService.emit(AppEvents.APIS_CREATED, {
          info,
          req: param.req,
          context,
        });

        source.config = undefined;
      }
    }

    this.appHooksService.emit(AppEvents.PROJECT_CREATE, {
      base,
      user: param.user,
      xcdb: !baseBody.external,
      req: param.req,
      context,
    });

    return base;
  }

  async baseSoftDelete(
    context: NcContext,
    param: { baseId: any; user: UserType; req: NcRequest },
    ncMeta = Noco.ncMeta,
  ) {
    const base = await Base.getWithInfo(context, param.baseId);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    if (isEE) {
      // delete all cross base links
      const crossBaseLinks = await ncMeta
        .knex(MetaTable.COL_RELATIONS)
        .where({
          base_id: context.base_id,
          fk_workspace_id: context.workspace_id,
        })
        .where((qb) => {
          qb.where((mmQb) => {
            mmQb
              .whereNot('fk_mm_base_id', base.id)
              .whereNotNull('fk_mm_base_id');
          }).orWhere((relQb) => {
            relQb
              .whereNot('fk_related_base_id', base.id)
              .whereNotNull('fk_related_base_id');
          });
        });

      for (const link of crossBaseLinks) {
        await this.columnsService.columnDelete(context, {
          columnId: link.fk_column_id,
          req: param.req,
          user: param.user,
        });
      }
    }

    const workspace = await Workspace.get(base.fk_workspace_id);

    if (!workspace) {
      NcError.workspaceNotFound(base.fk_workspace_id);
    }

    const transaction = await ncMeta.startTransaction();

    try {
      await Base.softDelete(context, param.baseId, ncMeta);

      await this.paymentService.reseatSubscription(
        workspace.fk_org_id ?? workspace.id,
        ncMeta,
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      base,
      user: param.user,
      req: param.req,
      context,
    });

    return true;
  }

  protected async validateProjectTitle(
    _context: NcContext,
    _data: Partial<Base>,
    _project: Base,
  ) {}
}
