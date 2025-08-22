import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import {
  AppEvents,
  EventType,
  IntegrationsType,
  ncIsUndefined,
  PlanFeatureTypes,
  ProjectRoles,
} from 'nocodb-sdk';
import { BasesService as BasesServiceCE } from 'src/services/bases.service';
import type {
  NcApiVersion,
  ProjectReqType,
  ProjectUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { getFeature, getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import syncMigration from '~/helpers/syncMigration';
import { MetaService } from '~/meta/meta.service';
import {
  Base,
  BaseUser,
  DataReflection,
  Integration,
  Workspace,
} from '~/models';
import { PaymentService } from '~/modules/payment/payment.service';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import { DataReflectionService } from '~/services/data-reflection.service';
import { TablesService } from '~/services/tables.service';
import { isEE, isOnPrem } from '~/utils';
import { getWorkspaceDbServer } from '~/utils/cloudDb';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaTable } from '~/utils/globals';
import { getToolDir } from '~/utils/nc-config';
import NocoSocket from '~/socket/NocoSocket';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

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

  async baseCreate(param: {
    base: ProjectReqType;
    user: any;
    req: any;
    apiVersion?: NcApiVersion;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectReq',
      param.base,
      false,
      {
        api_version: param.apiVersion,
      },
    );

    let workspace: Workspace;

    if (process.env.TEST !== 'true') {
      const fk_workspace_id = (param.base as any).fk_workspace_id;

      if (!fk_workspace_id) {
        NcError.badRequest('fk_workspace_id is required');
      }

      workspace = await Workspace.get(fk_workspace_id);

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
    await this.validateDefaultRoleFeature(
      {
        workspace_id: (param.base as any).fk_workspace_id,
      },
      param,
    );

    const baseId = await this.metaService.genNanoid(MetaTable.PROJECT);

    const baseBody: ProjectReqType & Record<string, any> = param.base;
    baseBody.id = baseId;

    if (!baseBody.external) {
      const ranId = nanoid();
      baseBody.prefix = `nc_${ranId}__`;
      baseBody.is_meta = true;

      const workspaceDbInstance = await getWorkspaceDbServer(
        baseBody.fk_workspace_id,
      );

      // This config is only used to determine db client type (TODO: check if this can be improved)
      const dataConfig = workspaceDbInstance
        ? workspaceDbInstance.config
        : await NcConnectionMgrv2.getDataConfig();

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

    baseBody.title = DOMPurify.sanitize(baseBody.title);
    baseBody.slug = baseBody.title;

    const base = await Base.createProject(baseBody);

    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

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

    await DataReflection.grantBase(base.fk_workspace_id, base.id);

    this.appHooksService.emit(AppEvents.PROJECT_CREATE, {
      base,
      user: param.user,
      xcdb: !baseBody.external,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEventToBaseUsers(
      context,
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_user_add',
          payload: {
            base,
          },
        },
      },
      param.req.ncSocketId,
    );

    return base;
  }

  private async validateDefaultRoleFeature(
    context: Pick<NcContext, 'workspace_id'>,
    param: { base: ProjectReqType | ProjectUpdateReqType },
  ) {
    // check if marked as private, only allow if user upgraded to pain plan
    if (
      param.base.default_role &&
      !(await getFeature(
        PlanFeatureTypes.FEATURE_PRIVATE_BASES,
        context.workspace_id,
      ))
    ) {
      if (isOnPrem) {
        NcError.badRequest(
          'Setting a default role (private base) is not available in Enterprise Starter license. Please upgrade your license to enable this feature.',
        );
      }
      NcError.badRequest(
        'Setting a default role (private base) is only available on paid plans. Please upgrade your workspace plan to enable this feature.',
      );
    }
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

    let baseUsers: BaseUser[] = [];

    try {
      baseUsers = await BaseUser.getUsersList(
        context,
        {
          base_id: base.id,
        },
        ncMeta,
      );
    } catch {}

    const transaction = await ncMeta.startTransaction();

    try {
      await Base.softDelete(context, param.baseId, ncMeta);

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    await this.paymentService.reseatSubscription(workspace.id, ncMeta);

    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      base,
      user: param.user,
      req: param.req,
      context,
    });

    for (const user of baseUsers || []) {
      NocoSocket.broadcastEventToUser(
        user.fk_user_id,
        {
          event: EventType.USER_EVENT,
          payload: {
            action: 'base_user_remove',
            payload: user,
            baseId: context.base_id,
            workspaceId: context.workspace_id,
          },
        },
        context.socket_id,
      );
    }

    return true;
  }

  async baseUpdate(
    context: NcContext,
    param: {
      baseId: string;
      base: ProjectUpdateReqType;
      user: UserType;
      req: NcRequest;
      apiVersion?: NcApiVersion;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUpdateReq',
      param.base,
      false,
      context,
    );

    await this.validateDefaultRoleFeature(context, param);

    // if user does not have Owner role, then block the request
    // param.base.default_role is string empty when public, and undefined for any other requests
    if (
      !ncIsUndefined(param.base.default_role) &&
      !param.req.user?.base_roles?.[ProjectRoles.OWNER as string]
    ) {
      NcError.forbidden('Only base owners can set the default role');
    }
    if (param.base.default_role) {
      await this.addBaseOwnerIfMissing(context, param);
    }

    return super.baseUpdate(context, param);
  }

  protected async validateProjectTitle(
    _context: NcContext,
    _data: Partial<Base>,
    _project: Base,
  ) {}

  /**
   * Ensures the current user is an owner in the given base.
   * - Blocks the action if the user lacks base-level owner rights.
   * - Adds the user as owner(Workspace level owner) if no owner exists in the base.
   */
  protected async addBaseOwnerIfMissing(
    context: NcContext,
    param: {
      baseId: string;
      base: ProjectUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // if user does not have Owner role, then block the request
    if (!param.req.user?.base_roles?.[ProjectRoles.OWNER as string]) {
      NcError.forbidden('Only base owners can set the default role');
    }

    // check if current user is there in baseUser table
    const baseUser = await BaseUser.get(context, param.baseId, param.user?.id);

    if (baseUser?.roles) return;

    // if not, check if there is any base user with owner role
    const ownerUser = await ncMeta
      .knex(MetaTable.PROJECT_USERS)
      .where('base_id', param.baseId)
      .where('roles', ProjectRoles.OWNER)
      .first();

    // if owner user exists, block the request
    if (ownerUser) {
      NcError.forbidden(
        'Only the base owner can modify the default role. Current workspace owner is not registered as base owner.',
      );
    }

    // else add the current user as base owner and proceed with the update
    if (!baseUser) {
      await BaseUser.insert(context, {
        fk_user_id: param.user.id,
        base_id: param.baseId,
        roles: ProjectRoles.OWNER,
      });
    } else if (!baseUser?.roles) {
      // if user is already there but roles set as `null` / empty string, update the role to owner
      await BaseUser.update(context, param.baseId, param.user.id, {
        roles: ProjectRoles.OWNER,
      });
    }
  }
}
