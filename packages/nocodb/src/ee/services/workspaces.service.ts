import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  CloudOrgUserRoles,
  EventType,
  IconType,
  IntegrationsType,
  ProjectRoles,
  ProjectStatus,
  SqlUiFactory,
  WorkspacePlan,
  WorkspaceStatus,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { ConfigService } from '@nestjs/config';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { OnApplicationBootstrap } from '@nestjs/common';
import type {
  BaseType,
  DomainReqType,
  UserType,
  WorkspaceType,
} from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import WorkspaceUser from '~/models/WorkspaceUser';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import Workspace from '~/models/Workspace';
import validateParams from '~/helpers/validateParams';
import { NcError } from '~/helpers/catchError';
import {
  Base,
  BaseUser,
  DataReflection,
  Domain,
  Integration,
  Org,
  OrgUser,
  PresignedUrl,
  Subscription,
  User,
} from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { extractProps } from '~/helpers/extractProps';
import { BasesService } from '~/services/bases.service';
import { TablesService } from '~/services/tables.service';
import Noco from '~/Noco';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import { JobTypes } from '~/interface/Jobs';
import NocoCache from '~/cache/NocoCache';
import { PaymentService } from '~/modules/payment/payment.service';
import { generateRandomTxt, verifyTXTRecord } from '~/utils';
import NocoSocket from '../socket/NocoSocket';

const mockUser = {
  id: '1',
  roles: [ProjectRoles.OWNER],
};

@Injectable()
export class WorkspacesService implements OnApplicationBootstrap {
  protected logger = new Logger(WorkspacesService.name);

  constructor(
    protected appHooksService: AppHooksService,
    protected configService: ConfigService<AppConfig>,
    protected basesService: BasesService,
    protected tablesService: TablesService,
    @Inject(forwardRef(() => 'JobsService')) protected jobsService,
    protected paymentService: PaymentService,
  ) {}

  async onApplicationBootstrap() {
    await this.prepopulateWorkspaces();
  }

  async prepopulateWorkspaces() {
    if (process.env.NC_SEED_WORKSPACE === 'true') {
      const templateBase = await Base.get(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        },
        process.env.NC_SEED_BASE_ID_SOURCE,
      );

      if (!templateBase) {
        return new Error('Template base not found');
      }

      const preCount = +process.env.NC_SEED_WORKSPACES_COUNT || 10;

      let preWorkspacesCount = await Workspace.count({
        fk_user_id: mockUser.id,
      });

      while (preWorkspacesCount < preCount) {
        await this.createPrepopulatedWorkspace(templateBase);
        preWorkspacesCount = await Workspace.count({
          fk_user_id: mockUser.id,
        });
      }
    }
  }

  async createPrepopulatedWorkspace(templateBase: Base) {
    const workspace = await Workspace.insert({
      title: 'Untitled Workspace',
      fk_user_id: mockUser.id,
      status: WorkspaceStatus.CREATED,
      plan: WorkspacePlan.FREE,
    });

    await WorkspaceUser.insert({
      fk_workspace_id: workspace.id,
      fk_user_id: mockUser.id,
      roles: WorkspaceUserRoles.OWNER,
    });

    const source = (await templateBase.getSources())[0];

    const dupBase = await this.basesService.baseCreate({
      base: {
        title: 'Getting Started',
        status: ProjectStatus.JOB,
        fk_workspace_id: workspace.id,
        type: 'database',
      } as any,
      user: mockUser,
      req: {
        user: mockUser,
        clientIp: 'system',
      },
    });

    await this.jobsService.add(JobTypes.DuplicateBase, {
      context: {
        workspace_id: templateBase.fk_workspace_id,
        base_id: templateBase.id,
      },
      baseId: templateBase.id,
      sourceId: source.id,
      dupProjectId: dupBase.id,
      options: {
        excludeUsers: true,
      },
      req: {
        user: mockUser,
        clientIp: 'system',
      },
    });
  }

  async list(param: {
    user: {
      id: string;
      roles?: string;
      extra?: Record<string, any>;
    };
    req: NcRequest;
  }) {
    let workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: param.user.id,
      fk_org_id: param.user.extra?.org_id,
      fk_workspace_id: param.user.extra?.woorkspace_id,
    });

    if (!workspaces.length && param.req.user?.id) {
      // create a default workspace if empty
      await this.createDefaultWorkspace(param.req.user, param.req);

      // fetch workspaces again
      workspaces = await WorkspaceUser.workspaceList({
        fk_user_id: param.user.id,
        fk_org_id: param.user.extra?.org_id,
        fk_workspace_id: param.user.extra?.workspace_id,
      });
    }

    return new PagedResponseImpl<WorkspaceType>(workspaces, {
      count: workspaces.length,
    });
  }

  // TODO: Break the bulk creation logic into a separate api
  async create(param: {
    user: UserType & { extra?: Record<string, any> };
    workspaces: WorkspaceType | WorkspaceType[];
    req: NcRequest;
  }) {
    const workspacePayloads = Array.isArray(param.workspaces)
      ? param.workspaces
      : [param.workspaces];

    const isBulkMode = Array.isArray(param.workspaces);

    for (const workspacePayload of workspacePayloads) {
      validateParams(['title'], workspacePayload);

      if (workspacePayload.fk_org_id) {
        const org = await Org.get(workspacePayload.fk_org_id);
        if (!org) {
          NcError.notFound('Org not found');
        }

        // check org user table and validate the permission
        const orgUser = await OrgUser.get(
          workspacePayload.fk_org_id,
          param.user.id,
        );

        if (orgUser.roles !== CloudOrgUserRoles.OWNER) {
          NcError.forbidden('You are not the owner of the organization');
        }
      }
    }

    const workspaces = [];

    for (const workspacePayload of workspacePayloads) {
      const prepopulatedWorkspace = await this.getRandomPrepopulatedWorkspace();

      if (prepopulatedWorkspace && !workspacePayload.fk_org_id) {
        const transferred = await this.transferOwnership({
          user: param.user,
          workspace: prepopulatedWorkspace,
          req: param.req as any,
        });
        if (transferred) {
          await Workspace.update(prepopulatedWorkspace.id, {
            ...workspacePayload,
            title: workspacePayload.title.trim(),
            status: WorkspaceStatus.CREATED,
            plan: WorkspacePlan.FREE,
          });
          workspaces.push(prepopulatedWorkspace);
          continue;
        }
      }

      const workspace = await Workspace.insert({
        ...workspacePayload,
        title: workspacePayload.title.trim(),
        // todo : extend request type
        fk_user_id: param.user.id,
        status: WorkspaceStatus.CREATED,
        plan: WorkspacePlan.FREE,
        fk_org_id: workspacePayload.fk_org_id || param.user.extra?.org_id,
      });

      // todo: error handling
      // await this.createWorkspaceSubdomain({ titleOrId: workspace.id });

      await WorkspaceUser.insert({
        fk_workspace_id: workspace.id,
        fk_user_id: param.user.id,
        roles: WorkspaceUserRoles.OWNER,
      });

      this.appHooksService.emit(AppEvents.WORKSPACE_CREATE, {
        workspace,
        req: param.req,
      });

      // Create a default base for single workspace creation
      if (!isBulkMode) {
        const base = await this.basesService.baseCreate({
          base: {
            title: 'Getting Started',
            fk_workspace_id: workspace.id,
            type: 'database',
          } as any,
          user: param.user,
          req: param.req,
        });

        const context = {
          workspace_id: workspace.id,
          base_id: base.id,
        };

        const sqlUI = SqlUiFactory.create({ client: base.sources[0].type });
        const columns = sqlUI?.getNewTableColumns() as any;

        const table = await this.tablesService.tableCreate(context, {
          baseId: base.id,
          sourceId: base.sources[0].id,
          table: {
            title: 'Features',
            table_name: 'Features',
            columns,
          },
          user: param.user,
          req: param.req,
        });

        (base as any).tables = [table];
        (workspace as any).bases = [base];
      }

      workspaces.push(workspace);
    }

    for (const workspace of workspaces) {
      NocoSocket.broadcastEventToWorkspaceUsers(
        { workspace_id: workspace.id, base_id: null },
        {
          event: EventType.USER_EVENT,
          payload: {
            action: 'workspace_create',
            payload: workspace,
          },
        },
        param.req.ncSocketId,
      );
    }

    return isBulkMode ? workspaces : workspaces[0];
  }

  async transferOwnership(param: {
    user: UserType & { extra?: any };
    workspace: WorkspaceType;
    req: Request;
  }) {
    const user = await User.get(param.user.id);

    if (!user) NcError.userNotFound(param.user.id);

    const workspace = await Workspace.get(param.workspace.id);

    if (!workspace) NcError.workspaceNotFound(param.workspace.id);

    const context = {
      workspace_id: workspace.id,
      base_id: RootScopes.WORKSPACE,
    };

    const oldWorkspaceOwnerId = workspace.fk_user_id;

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const updateObj = {
        fk_user_id: user.id,
      };

      if (param.user.extra?.org_id) {
        updateObj['fk_org_id'] = param.user.extra.org_id;
      }

      // update workspace owner
      await ncMeta.metaUpdate(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE,
        updateObj,
        workspace.id,
      );

      await NocoCache.update(
        `${CacheScope.WORKSPACE}:${workspace.id}`,
        updateObj,
      );

      // check workspace user exists or not and if exists then update workspace user
      // and if not then create new workspace user

      const workspaceUsers = await ncMeta.metaList2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE_USER,
        {
          condition: {
            fk_workspace_id: workspace.id,
          },
        },
      );

      if (workspaceUsers.length) {
        // update workspace user
        await ncMeta.metaUpdate(
          RootScopes.WORKSPACE,
          RootScopes.WORKSPACE,
          MetaTable.WORKSPACE_USER,
          {
            fk_user_id: user.id,
          },
          {
            fk_workspace_id: workspace.id,
            roles: WorkspaceUserRoles.OWNER,
          },
        );
      } else {
        // create workspace user
        await WorkspaceUser.insert({
          fk_workspace_id: workspace.id,
          fk_user_id: user.id,
          roles: WorkspaceUserRoles.OWNER,
        });
      }

      // get all bases
      const bases = await ncMeta.metaList2(
        context.workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.PROJECT,
        {
          condition: {
            fk_workspace_id: context.workspace_id,
          },
        },
      );

      // update base owners
      for (const base of bases) {
        await ncMeta.metaUpdate(
          context.workspace_id,
          base.id,
          MetaTable.PROJECT_USERS,
          {
            fk_user_id: user.id,
          },
          {
            base_id: base.id,
            roles: ProjectRoles.OWNER,
            fk_user_id: oldWorkspaceOwnerId,
          },
        );
      }

      await ncMeta.commit();

      if (workspace.fk_user_id === mockUser.id) {
        // prepopulate more workspaces if required
        this.prepopulateWorkspaces().catch((e) => {
          this.logger.error('### Failed to prepopulate workspace');
          this.logger.error(e);
        });
      }
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e);
      return false;
    }

    return true;
  }

  async getRandomPrepopulatedWorkspace() {
    if (process.env.NC_SEED_WORKSPACE !== 'true') return null;

    const workspaces = await Noco.ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        condition: {
          fk_user_id: mockUser.id,
          plan: WorkspacePlan.FREE,
        },
      },
    );

    if (!workspaces?.length) {
      return null;
    }

    const randomWorkspace =
      workspaces[Math.floor(Math.random() * workspaces.length)];

    return randomWorkspace;
  }

  async get(param: {
    user: {
      id: string;
      roles?: string;
    };
    workspaceId: string;
  }) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.workspaceNotFound(param.workspaceId);

    const workspaceRoles = await WorkspaceUser.get(workspace.id, param.user.id);

    const rawIntegrations = await Integration.list({
      workspaceId: workspace.id,
      userId: param.user.id,
      includeDatabaseInfo: true,
      type: IntegrationsType.Ai,
    });

    const integrations = (rawIntegrations.list || []).map((i) =>
      extractProps(i, ['id', 'type', 'sub_type', 'title', 'is_default']),
    );

    const dataReflection = await DataReflection.get({
      fk_workspace_id: workspace.id,
    });

    if (
      (workspace.meta as Record<string, any>)?.icon &&
      (workspace.meta as Record<string, any>)?.iconType === IconType.IMAGE
    ) {
      await PresignedUrl.signAttachment(
        {
          attachment: (workspace.meta as Record<string, any>)?.icon,
        },
        Noco.ncMeta,
      );
    }

    return {
      ...workspace,
      roles: workspaceRoles?.roles,
      integrations: integrations,
      data_reflection_enabled: !!dataReflection,
    } as Workspace;
  }

  async upgrade(param: {
    user: {
      email: string;
      id: string;
      roles?: string;
    };
    workspaceId: string;
  }) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.workspaceNotFound(param.workspaceId);

    if (workspace.plan === WorkspacePlan.BUSINESS) {
      NcError.internalServerError('Workspace is already upgraded');
    }

    if (
      process.env.NC_DISABLE_MUX === 'true' &&
      process.env.NC_CLOUD === 'true'
    ) {
      await this.createWorkspaceSubdomain({
        titleOrId: workspace.id,
        user: param.user?.email ?? param.user?.id,
      });

      await Workspace.updateStatusAndPlan(param.workspaceId, {
        plan: WorkspacePlan.BUSINESS,
        status: WorkspaceStatus.CREATING,
      });
    } else {
      await Workspace.updateStatusAndPlan(param.workspaceId, {
        plan: WorkspacePlan.BUSINESS,
      });
    }

    await Workspace.updateStatusAndPlan(param.workspaceId, {
      plan: WorkspacePlan.BUSINESS,
    });

    return workspace;
  }

  async update(param: {
    user: UserType;
    workspaceId: string;
    workspace: WorkspaceType;
    req: NcRequest;
  }) {
    const { workspace, user, workspaceId } = param;

    const existingWorkspace = await Workspace.get(param.workspaceId);

    if (!existingWorkspace) NcError.workspaceNotFound(param.workspaceId);

    if ('order' in workspace) {
      existingWorkspace.order = workspace.order;
      await WorkspaceUser.update(workspaceId, user.id, {
        order: workspace.order,
      });
      delete workspace.order;
    }

    // allow only owner and creator to update anything other that order
    if (
      !(user as any).workspace_roles[WorkspaceUserRoles.OWNER] &&
      !(user as any).workspace_roles[WorkspaceUserRoles.CREATOR]
    )
      return;

    const updateObj = extractProps(workspace, ['title', 'description', 'meta']);

    const updatedWorkspace = await Workspace.update(workspaceId, updateObj);

    if (
      existingWorkspace.stripe_customer_id &&
      existingWorkspace.title !== updatedWorkspace.title
    ) {
      await this.paymentService.customerUpdate(existingWorkspace.id);
    }

    this.appHooksService.emit(AppEvents.WORKSPACE_UPDATE, {
      oldWorkspace: existingWorkspace as WorkspaceType,
      workspace: {
        ...existingWorkspace,
        ...workspace,
      } as WorkspaceType,
      req: param.req,
    });

    NocoSocket.broadcastEventToWorkspaceUsers(
      { workspace_id: existingWorkspace.id, base_id: null },
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'workspace_update',
          payload: {
            ...existingWorkspace,
            ...workspace,
          },
        },
      },
      param.req.ncSocketId,
    );

    return updatedWorkspace;
  }

  async delete(
    param: { user: UserType; workspaceId: string; req: NcRequest },
    ncMeta = Noco.ncMeta,
  ) {
    const workspace = await Workspace.get(param.workspaceId, false, ncMeta);

    if (!workspace) NcError.workspaceNotFound(param.workspaceId);

    // check if workspace have subscription
    const subscription = await Subscription.getByWorkspaceOrOrg(
      workspace.id,
      ncMeta,
    );

    // If subscription is active and not canceled, then do not allow deletion
    if (subscription && !subscription.canceled_at) {
      NcError.badRequest(
        'Workspace cannot be deleted as it has an active subscription',
      );
    }

    const transaction = await ncMeta.startTransaction();

    try {
      // todo: avoid removing owner

      // block unauthorized user form deleting

      // todo: unlink any base linked
      await Workspace.softDelete(param.workspaceId, transaction);

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    // TODO: remove optional chaining on cloud only code updated
    await this.paymentService?.reseatSubscription(workspace.id, ncMeta);

    this.appHooksService.emit(AppEvents.WORKSPACE_DELETE, {
      workspace,
      req: param.req,
    });

    return true;
  }

  async moveProject(param: {
    user: {
      id: string;
      roles?: string;
    };
    workspaceId: string;
    baseId: string;
  }) {
    const { workspaceId, baseId, user } = param;

    const context = {
      workspace_id: workspaceId,
      base_id: baseId,
    };

    const base = await Base.get(context, baseId);

    const baseUser = await BaseUser.get(context, baseId, user.id);
    const currentWorkspaceUser = await WorkspaceUser.get(
      (base as Base).fk_workspace_id,
      user.id,
    );

    if (
      baseUser?.roles !== ProjectRoles.OWNER &&
      currentWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER
    ) {
      NcError.forbidden('You are not the base owner');
    }

    // verify user is workaggerspace owner

    const destWorkspaceUser = await WorkspaceUser.get(workspaceId, user.id);

    if (destWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER) {
      NcError.forbidden('You are not the workspace owner');
    }

    // update the base workspace id
    await Base.update(context, param.baseId, {
      fk_workspace_id: workspaceId,
    });

    return true;
  }

  async getProjectList(param: {
    user: {
      id: string;
      roles?: string;
    };
    workspaceId: string;
    req: NcRequest;
  }) {
    const { workspaceId, user } = param;
    const bases = await Base.listByWorkspaceAndUser(workspaceId, user.id);

    return new PagedResponseImpl<BaseType>(bases, {
      count: bases.length,
    });
  }

  // todo: handle error case
  private async createWorkspaceSubdomain(param: {
    titleOrId: string;
    user: string;
  }) {
    const snsConfig = this.configService.get('sns', {
      infer: true,
    });
    const workspaceSnsTopic = this.configService.get('workspace.sns.topicArn', {
      infer: true,
    });

    if (
      !workspaceSnsTopic ||
      !snsConfig.credentials ||
      !snsConfig.credentials.secretAccessKey ||
      !snsConfig.credentials.accessKeyId
    ) {
      NcError.internalServerError(
        'SNS is not configured for workspace upgrade',
      );
    }

    const params = {
      Message: JSON.stringify({
        WS_NAME: param.titleOrId,
        user: param.user,
      }) /* required */,
      TopicArn: workspaceSnsTopic,
    };

    const snsClient = new SNSClient({
      region: snsConfig.region,
      credentials: {
        accessKeyId: snsConfig.credentials.accessKeyId,
        secretAccessKey: snsConfig.credentials.secretAccessKey,
      },
    });

    try {
      // Handle promise's fulfilled/rejected states
      const data = await snsClient.send(new PublishCommand(params));
      this.logger.log(
        `Message ${params.Message} sent to the topic ${params.TopicArn}`,
      );
      this.logger.log('MessageID is ' + data.MessageId);
    } catch (err) {
      this.logger.error(err.message, err.stack);
      NcError.internalServerError(
        'There was an error while sending the workspace upgrade request',
      );
    }
  }

  async deleteDeprecatedWorkspaces() {
    const deprecatedWorkspaceTemplates = await Workspace.count({
      fk_user_id: 'DEPRECATED',
    });

    if (deprecatedWorkspaceTemplates) {
      const list = await Noco.ncMeta.metaList2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE,
        {
          condition: {
            fk_user_id: 'DEPRECATED',
          },
        },
      );

      for (const workspace of list) {
        const ncMeta = await Noco.ncMeta.startTransaction();
        try {
          await Workspace.delete(workspace.id, ncMeta);
          await ncMeta.commit();
          this.logger.log(`[TEMPLATES] ${workspace.id} deleted`);
        } catch (e) {
          this.logger.error(`[TEMPLATES] ${workspace.id} failed to delete`);
          await ncMeta.rollback();
        }
      }
    }
  }

  public async createDefaultWorkspace(user: User, req: any) {
    const title = `${user.email?.split('@')?.[0]}`;

    let createdWorkspace;

    const prepopulatedWorkspace = await this.getRandomPrepopulatedWorkspace();

    let transferred = false;

    if (prepopulatedWorkspace) {
      transferred = await this.transferOwnership({
        user,
        workspace: prepopulatedWorkspace,
        req,
      });
      if (transferred) {
        await Workspace.update(
          prepopulatedWorkspace.id,
          {
            title,
          },
          undefined,
          true,
        );
        createdWorkspace = prepopulatedWorkspace;
      }
    }

    if (!transferred) {
      // create new workspace for user
      createdWorkspace = await this.create({
        user,
        workspaces: {
          title,
        },
        req,
      });
    }

    return createdWorkspace;
  }

  async verifyDomain(param: { domainId: string; req: any }) {
    const domain = await Domain.get(param.domainId);

    if (!domain) {
      NcError.notFound('Domain not found');
    }

    const verified = await verifyTXTRecord(domain.domain, domain.txt_value);

    if (domain.verified !== verified) {
      await Domain.update(param.domainId, {
        verified,
      });
    }

    return verified;
  }

  async domainList(param: { workspaceId: string; req: NcRequest }) {
    const domainList = await Domain.list({ workspaceId: param.workspaceId });

    return domainList;
  }

  async addDomain(param: {
    body: DomainReqType;
    workspaceId: string;
    req: NcRequest;
  }) {
    // todo: validate and verify

    // generate a txt value
    const txtValue = generateRandomTxt();

    const domain = await Domain.insert({
      deleted: param.body.deleted,
      domain: param.body.domain,
      txt_value: txtValue,
      fk_workspace_id: param.workspaceId,
      fk_user_id: param.req.user?.id,
    });

    await this.verifyDomain({ domainId: domain.id, req: param.req });

    return domain;
  }
}
