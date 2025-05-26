import { promisify } from 'util';
import { UsersService as UsersServiceCE } from 'src/services/users/users.service';
import { Injectable, Logger } from '@nestjs/common';
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  AppEvents,
  OrgUserRoles,
  ProjectRoles,
  validatePassword,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import isEmail from 'validator/lib/isEmail';
import bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { setTokenCookie } from './helpers';
import type { BaseType, MetaType, SignUpReqType, UserType } from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { Source } from '~/models';
import { T } from '~/utils';
import { NC_APP_SETTINGS } from '~/constants';
import { validatePayload } from '~/helpers';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import {
  ApiToken,
  Base,
  BaseUser,
  Extension,
  Integration,
  PresignedUrl,
  Store,
  SyncSource,
  User,
  UserRefreshToken,
  Workspace,
  WorkspaceUser,
} from '~/models';
import { randomTokenString } from '~/helpers/stringHelpers';
import { NcError } from '~/helpers/catchError';
import { WorkspacesService } from '~/services/workspaces.service';
import Noco from '~/Noco';
import { CacheGetType, MetaTable, RootScopes } from '~/utils/globals';
import { IntegrationsService } from '~/services/integrations.service';
import NocoCache from '~/cache/NocoCache';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { TelemetryService } from '~/services/telemetry.service';

async function listUserBases(
  fk_user_id: string,
  ncMeta: MetaService,
): Promise<(BaseType & { base_role: string })[]> {
  return ncMeta
    .knexConnection(`${MetaTable.PROJECT} as b`)
    .select(
      'b.*',
      ncMeta.knexConnection.raw(`CASE
          WHEN "bu"."roles" is not null THEN "bu"."roles"
          ${Object.values(WorkspaceUserRoles)
            .map(
              (value) =>
                `WHEN "wu"."roles" = '${value}' THEN '${WorkspaceRolesToProjectRoles[value]}'`,
            )
            .join(' ')}
          ELSE '${ProjectRoles.NO_ACCESS}'
          END as base_role`),
    )
    .innerJoin(
      `${MetaTable.WORKSPACE_USER} as wu`,
      `wu.fk_workspace_id`,
      `b.fk_workspace_id`,
    )
    .leftJoin(`${MetaTable.PROJECT_USERS} as bu`, function () {
      this.on(`bu.base_id`, `=`, `b.id`).andOn(
        `bu.fk_user_id`,
        `=`,
        `wu.fk_user_id`,
      );
    })
    .where('wu.fk_user_id', fk_user_id);
}

async function listBaseUsers(
  fk_workspace_id: string,
  base_id: string,
  ncMeta: MetaService,
) {
  // return base_role considering inherited roles from workspace
  const qb = ncMeta
    .knexConnection(`${MetaTable.WORKSPACE_USER} as wu`)
    .select(
      'wu.*',
      ncMeta.knexConnection.raw(`CASE
        WHEN "bu"."roles" IS NOT NULL THEN "bu"."roles"
        ${Object.values(WorkspaceUserRoles)
          .map(
            (value) =>
              `WHEN "wu"."roles" = '${value}' THEN '${WorkspaceRolesToProjectRoles[value]}'`,
          )
          .join(' ')}
        ELSE '${ProjectRoles.NO_ACCESS}'
        END as base_role`),
    )
    .innerJoin(
      `${MetaTable.PROJECT} as b`,
      `b.fk_workspace_id`,
      `wu.fk_workspace_id`,
    )
    .leftJoin(`${MetaTable.PROJECT_USERS} as bu`, function () {
      this.on(`bu.fk_user_id`, `=`, `wu.fk_user_id`).andOn(
        `bu.base_id`,
        `=`,
        `b.id`,
      );
    })
    .where('b.id', base_id)
    .andWhere('wu.fk_workspace_id', fk_workspace_id);

  return qb;
}

@Injectable()
export class UsersService extends UsersServiceCE {
  logger = new Logger(UsersService.name);

  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected workspaceService: WorkspacesService,
    protected baseService: BasesService,
    protected mailService: MailService,
    protected integrationsService: IntegrationsService,
    protected configService: ConfigService<AppConfig>,
    protected telemetryService: TelemetryService,
  ) {
    super(metaService, appHooksService, baseService, mailService);
  }
  async registerNewUserIfAllowed(
    {
      avatar,
      display_name,
      user_name,
      email,
      salt,
      password,
      email_verification_token,
      meta,
      req,
      invite_token,
      workspace_invite,
    }: {
      avatar;
      display_name;
      user_name;
      email: string;
      salt: any;
      password;
      email_verification_token;
      meta?: MetaType;
      req: NcRequest;
      invite_token?: string;
      workspace_invite?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    this.validateEmailPattern(email);

    let roles: string = OrgUserRoles.CREATOR;

    let settings: { invite_only_signup?: boolean } = {};
    try {
      settings = JSON.parse(
        (await Store.get(NC_APP_SETTINGS, undefined, ncMeta))?.value,
      );
    } catch {}

    // allow super user signup(first user) in non cloud mode(on-prem)
    const isFirstUserAndSuperUserAllowed =
      process.env.NC_CLOUD !== 'true' && (await User.isFirst(ncMeta));

    if (isFirstUserAndSuperUserAllowed) {
      roles = `${OrgUserRoles.CREATOR},${OrgUserRoles.SUPER_ADMIN}`;
    } else if (settings?.invite_only_signup && !workspace_invite) {
      NcError.badRequest('Not allowed to signup, contact super admin.');
    } else {
      roles = OrgUserRoles.VIEWER;
    }

    const token_version = randomTokenString();
    const user = await User.insert(
      {
        avatar,
        display_name,
        user_name,
        email,
        salt,
        password,
        email_verification_token,
        roles,
        token_version,
        invite_token,
        // define invite_token_expiry if invite_token is defined
        invite_token_expires: invite_token
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : null,
        meta,
      },
      ncMeta,
    );

    if (req?.user) {
      this.appHooksService.emit(AppEvents.USER_INVITE, {
        user: user,
        req: req,
        role: req.user.roles,
        workspaceInvite: workspace_invite,
        workspaceId: req.ncWorkspaceId,
      });
    } else {
      this.appHooksService.emit(AppEvents.USER_SIGNUP, {
        user: user,
        req: req,
      });

      await this.mailService.sendMail({
        mailEvent: MailEvent.WELCOME,
        payload: {
          user,
          req: req,
        },
      });
    }

    this.appHooksService.emit(AppEvents.WELCOME, {
      user,
      req: req,
    });

    await PresignedUrl.signMetaIconImage(user);

    return user;
  }

  async signup(param: {
    body: SignUpReqType;
    req: any;
    res: any;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SignUpReq', param.body);

    const {
      email: _email,
      avatar,
      display_name,
      user_name,
      token,
      ignore_subscribe,
    } = param.req.body;

    let createdWorkspace;

    let { password } = param.req.body;

    // validate password and throw error if password is satisfying the conditions
    const { valid, error } = validatePassword(password);
    if (!valid) {
      NcError.badRequest(`Password : ${error}`);
    }

    if (!isEmail(_email)) {
      NcError.badRequest(`Invalid email`);
    }

    const email = _email.toLowerCase();

    this.validateEmailPattern(email);

    let user = await User.getByEmail(email);

    if (user) {
      if (token) {
        if (token !== user.invite_token) {
          NcError.badRequest(`Invalid invite url`);
        } else if (user.invite_token_expires < new Date()) {
          NcError.badRequest(
            'Expired invite url, Please contact super admin to get a new invite url',
          );
        }
      } else {
        // todo : opening up signup for timebeing
        // return next(new Error(`Email '${email}' already registered`));
      }
    }

    const salt = await promisify(bcrypt.genSalt)(10);
    password = await promisify(bcrypt.hash)(password, salt);
    const email_verification_token = uuidv4();

    if (!ignore_subscribe) {
      T.emit('evt_subscribe', email);
    }

    if (user) {
      if (token) {
        await User.update(user.id, {
          avatar,
          display_name,
          user_name,
          salt,
          password,
          email_verification_token,
          invite_token: null,
          invite_token_expires: null,
          email: user.email,
        });

        this.appHooksService.emit(AppEvents.USER_SIGNUP, {
          user: user,
          req: param.req,
        });

        await this.mailService.sendMail({
          mailEvent: MailEvent.WELCOME,
          payload: {
            user,
            req: param.req,
          },
        });

        this.appHooksService.emit(AppEvents.WELCOME, {
          user,
          req: param.req,
        });
      } else {
        NcError.badRequest('User already exist');
      }
    } else {
      const user = await this.registerNewUserIfAllowed({
        avatar,
        display_name,
        user_name,
        email,
        salt,
        password,
        email_verification_token,
        req: param.req,
      });

      createdWorkspace = await this.workspaceService.createDefaultWorkspace(
        user,
        param.req,
      );
    }
    user = await User.getByEmail(email);

    // We should not send verify email in cloud
    // This is handled by Cognito
    /*try {
      await this.mailService.sendMail({
        mailEvent: MailEvent.VERIFY_EMAIL,
        payload: {
          user,
          req: param.req,
        },
      });
    } catch (e) {
      this.logger.warn(
        'Warning : `mailSend` failed, Please configure emailClient configuration.',
      );
    }*/

    const refreshToken = randomTokenString();

    await UserRefreshToken.insert({
      token: refreshToken,
      fk_user_id: user.id,
    });

    setTokenCookie(param.res, refreshToken);

    return { ...(await this.login(user, param.req)), createdWorkspace };
  }

  async login(
    user: UserType & { provider?: string; extra?: Record<string, any> },
    req: NcRequest,
  ): Promise<any> {
    const workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: user.id,
      fk_org_id: user.extra?.org_id,
      fk_workspace_id: user.extra?.workspace_id,
    });

    if (workspaces.length === 0) {
      await this.workspaceService.createDefaultWorkspace(user, req);
    }

    return await super.login(user, req);
  }

  async userDryDelete(param: { id: string; req: NcRequest }) {
    if (param.id !== param.req.user.id) {
      NcError.notAllowed('Not allowed to delete other user');
    }

    const ncMeta = Noco.ncMeta;

    const toBeDeleted: {
      workspaces: Workspace[];
      bases: BaseType & { base_role: string; workspace_title: string }[];
      integrations: Integration[];
      sources: Source[];
      apiTokens: ApiToken[];
      access: {
        workspaces: Workspace[];
        bases: BaseType & { base_role: string; workspace_title: string }[];
      };
    } = {
      workspaces: [],
      bases: [],
      integrations: [],
      sources: [],
      apiTokens: [],
      access: {
        workspaces: [],
        bases: [],
      },
    };

    const user = await User.get(param.id, ncMeta);

    if (!user) {
      NcError.notFound('User not found');
    }

    // find user workspaces
    const workspaces = await WorkspaceUser.workspaceList(
      {
        fk_user_id: user.id,
      },
      ncMeta,
    );

    for (const workspace of workspaces) {
      if (workspace.roles === WorkspaceUserRoles.OWNER) {
        const owners = await WorkspaceUser.userList({
          fk_workspace_id: workspace.id,
          roles: WorkspaceUserRoles.OWNER,
        });

        // Delete workspace if user is sole owner
        if (owners.length === 1) {
          toBeDeleted.workspaces.push(workspace);
        } else {
          toBeDeleted.access.workspaces.push(workspace);
        }
      } else if (workspace.roles !== WorkspaceUserRoles.NO_ACCESS) {
        toBeDeleted.access.workspaces.push(workspace);
      }
    }

    // find user bases
    const bases = await listUserBases(user.id, ncMeta);

    for (const bs of bases) {
      const workspace = await Workspace.get(bs.fk_workspace_id, false, ncMeta);

      if (!workspace) {
        this.logger.warn(`Hanging base found with id ${bs.id}`);
        continue;
      }

      const base = {
        ...bs,
        workspace_title: workspace.title,
      } as BaseType & { base_role: string; workspace_title: string };

      // if user is sole owner of workspace, all bases of that workspace will be deleted
      if (toBeDeleted.workspaces.find((w) => w.id === base.fk_workspace_id)) {
        toBeDeleted.bases.push(base);
        continue;
      }

      if (base.base_role === ProjectRoles.OWNER) {
        const owners = (
          await listBaseUsers(base.fk_workspace_id, base.id, ncMeta)
        ).filter((u) => u.base_role === ProjectRoles.OWNER);

        // Delete base if user is sole owner
        if (owners.length === 1) {
          toBeDeleted.bases.push(base);
        } else {
          toBeDeleted.access.bases.push(base);
        }
      } else if (base.base_role !== ProjectRoles.NO_ACCESS) {
        toBeDeleted.access.bases.push(base);
      }
    }

    // find user integrations
    const integrationsData = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        condition: {
          created_by: user.id,
        },
      },
    );

    for (const data of integrationsData) {
      const integration = new Integration(data);

      // avoid exposing config
      delete integration.config;

      const sources: Source[] = await integration.getSources(ncMeta);

      for (const source of sources) {
        toBeDeleted.sources.push(source);
      }

      toBeDeleted.integrations.push(integration);
    }

    // get all api tokens of user and delete them
    const apiTokens = await ApiToken.list(user.id, ncMeta);

    for (const apiToken of apiTokens) {
      toBeDeleted.apiTokens.push(apiToken);
    }

    await NocoCache.setExpiring(
      `user:${user.id}:delete`,
      `${Date.now()}`,
      10 * 60,
    );

    return toBeDeleted;
  }

  async userDelete(param: { id: string; req: NcRequest }) {
    if (param.id !== param.req.user.id) {
      NcError.notAllowed('Not allowed to delete other user');
    }

    const ncMeta = Noco.ncMeta;

    const dryRun = await NocoCache.get(
      `user:${param.id}:delete`,
      CacheGetType.TYPE_STRING,
    );

    if (!dryRun) {
      NcError.badRequest(
        'You must perform dry run before deleting the user account to see which resources will be deleted\nCall same API with `dry=true` as query param',
      );
    }

    const transaction = await ncMeta.startTransaction();

    try {
      const user = await User.get(param.id, transaction);

      if (!user) {
        NcError.notFound('User not found');
      }

      /*
        Delete steps:
        1. Delete all workspaces solely owned by user
        2. Delete all bases solely owned by user
        3. Delete all integrations created by user -> disabled until we introduce transfer ownership of integrations
        4. Delete user from all bases
        5. Delete user from all workspaces
        6. Delete all refresh tokens of user
        7. Delete all api tokens of user
        8. Delete all extensions of users
        9. Delete all sync sources of user (Airtable import settings)

        10. Mark user as deleted in meta - replace email & display_name with placeholder (Anonymous or Deleted User)
      */

      // find user workspaces
      const workspaces = await WorkspaceUser.workspaceList(
        {
          fk_user_id: user.id,
        },
        transaction,
      );

      for (const workspace of workspaces) {
        let soleOwner = false;

        if (workspace.roles === WorkspaceUserRoles.OWNER) {
          const owners = await WorkspaceUser.userList(
            {
              fk_workspace_id: workspace.id,
              roles: WorkspaceUserRoles.OWNER,
            },
            transaction,
          );

          // Delete workspace if user is sole owner
          if (owners.length === 1) {
            soleOwner = true;
            await Workspace.softDelete(workspace.id, transaction);
          }
        }

        // Delete user from workspace if there are multiple owners
        if (!soleOwner) {
          await WorkspaceUser.softDelete(workspace.id, user.id, transaction);
        }
      }

      // find user bases
      const bases = await listUserBases(user.id, transaction);

      for (const base of bases) {
        let soleOwner = false;
        if (base.base_role === ProjectRoles.OWNER) {
          const owners = (
            await listBaseUsers(base.fk_workspace_id, base.id, transaction)
          ).filter((u) => u.base_role === ProjectRoles.OWNER);

          // Delete base if user is sole owner
          if (owners.length === 1) {
            soleOwner = true;
            await Base.softDelete(
              {
                workspace_id: base.fk_workspace_id,
                base_id: base.id,
              },
              base.id,
              transaction,
            );
          }
        }

        // Delete user from base if there are multiple owners
        if (!soleOwner) {
          await BaseUser.delete(
            {
              workspace_id: base.fk_workspace_id,
              base_id: base.id,
            },
            base.id,
            user.id,
            transaction,
          );
        }
      }

      /* TODO: We don't have a way to transfer integrations to another user yet - hence we are skipping this for now

      // find user integrations
      const integrationsData = await transaction.metaList2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.INTEGRATIONS,
        {
          condition: {
            created_by: user.id,
          },
        },
      );


      for (const data of integrationsData) {
        const integration = new Integration(data);

        // avoid exposing config
        delete integration.config;

        await integration.softDelete(transaction);
      }
      */

      // delete all user refresh tokens
      await UserRefreshToken.deleteAllUserToken(user.id, transaction);

      // get all api tokens of user and delete them
      const apiTokens = await ApiToken.list(user.id, transaction);

      for (const apiToken of apiTokens) {
        await ApiToken.delete(apiToken.id, transaction);
      }

      // list & delete all extensions owned by user
      const extensions = await transaction
        .knexInstance(MetaTable.EXTENSIONS)
        .where({
          fk_user_id: user.id,
        });

      for (const extension of extensions) {
        await Extension.delete(
          {
            workspace_id: extension.fk_workspace_id,
            base_id: extension.base_id,
          },
          extension.id,
          transaction,
        );
      }

      // delete all sync sources owned by user
      await SyncSource.deleteByUserId(user.id, transaction);

      // mark user as deleted in meta
      await User.softDelete(user.id, transaction);

      // delete user from cognito if configured
      if (
        this.configService.get('cognito.aws_user_pools_id', { infer: true })
      ) {
        const client = new CognitoIdentityProviderClient({
          region: this.configService.get('cognito.aws_cognito_region', {
            infer: true,
          }),
        });

        const { Users: userList } = await client.send(
          new ListUsersCommand({
            UserPoolId: this.configService.get('cognito.aws_user_pools_id', {
              infer: true,
            }),
            Filter: `email = "${user.email}"`,
          }),
        );

        for (const cognitoUser of userList) {
          await client.send(
            new AdminDeleteUserCommand({
              UserPoolId: this.configService.get('cognito.aws_user_pools_id', {
                infer: true,
              }),
              Username: cognitoUser.Username,
            }),
          );
        }
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();

      this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'userDelete',
        error_type: e?.name,
        message: e?.message,
        error_details: e?.stack,
        affected_resources: [param.id],
      });

      throw e;
    }
  }

  protected clearCookie(param: { res: any; req: NcRequest }) {
    param.res.clearCookie('refresh_token', {
      httpOnly: true,
      domain: process.env.NC_BASE_HOST_NAME || undefined,
    });
  }
}
