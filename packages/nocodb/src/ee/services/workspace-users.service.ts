import { promisify } from 'util';
import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { ConfigService } from '@nestjs/config';
import {
  AppEvents,
  CloudOrgUserRoles,
  EventType,
  extractRolesObj,
  HigherPlan,
  NcBaseError,
  NON_SEAT_ROLES,
  parseProp,
  TeamUserRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import type { NcContext, UserType, WorkspaceType } from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { WorkspaceUserDeleteEvent } from '~/services/app-hooks/interfaces';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { handleOrphanBases } from '~/ee/utils/orphanBaseHandler';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { NcError } from '~/helpers/catchError';
import {
  checkSeatLimit,
  getLimit,
  PlanLimitTypes,
} from '~/helpers/paymentHelpers';
import validateParams from '~/helpers/validateParams';
import { MailEvent } from '~/interface/Mail';
import {
  Base,
  BaseUser,
  Permission,
  PresignedUrl,
  Subscription,
  User,
} from '~/models';
import Workspace from '~/models/Workspace';
import WorkspaceUser from '~/models/WorkspaceUser';
import { Team } from '~/ee/models';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import { PrincipalType, ResourceType } from '~/utils/globals';
import { PaymentService } from '~/modules/payment/payment.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MailService } from '~/services/mail/mail.service';
import { UsersService } from '~/services/users/users.service';
import NocoSocket from '~/socket/NocoSocket';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import { getWorkspaceRolePower } from '~/utils/roleHelper';

@Injectable()
export class WorkspaceUsersService {
  private logger = new Logger('WorkspaceUsersService');
  constructor(
    private appHooksService: AppHooksService,
    private usersService: UsersService,
    private config: ConfigService<AppConfig>,
    private mailService: MailService,
    private paymentService: PaymentService,
  ) {}

  async list(
    param: { workspaceId; includeDeleted?: boolean },
    ncMeta = Noco.ncMeta,
  ) {
    const users = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: param.includeDeleted,
    });

    const { seatUsersMap } = await Subscription.calculateWorkspaceSeatCount(
      param.workspaceId,
      ncMeta,
    );

    for (const user of users) {
      if (seatUsersMap.has(user.fk_user_id)) {
        user.meta = parseProp(user.meta);
        user.meta.billable = true;
      }
    }

    await PresignedUrl.signMetaIconImage(users);
    // todo: pagination
    return new PagedResponseImpl<WorkspaceType>(users, {
      count: users.length,
    });
  }

  async count(param: { workspaceId: string; includeDeleted?: boolean }) {
    return await WorkspaceUser.count({
      workspaceId: param.workspaceId,
      include_deleted: param.includeDeleted,
    });
  }

  async ownerCount(param: { workspaceId: string }) {
    return await WorkspaceUser.count({
      workspaceId: param.workspaceId,
      include_deleted: false,
      onlyOwner: true,
    });
  }

  async get({ workspaceId, userId }) {
    const user = await WorkspaceUser.get(workspaceId, userId);

    if (!user) NcError.userNotFound(userId);

    await PresignedUrl.signMetaIconImage(user);

    return user;
  }

  async update(
    param: {
      workspaceId: string;
      userId: string;
      roles: WorkspaceUserRoles;
      siteUrl: string;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceUser = await WorkspaceUser.get(
      param.workspaceId,
      param.userId,
      {},
      ncMeta,
    );

    if (!workspaceUser) NcError.userNotFound(param.userId);

    const isOrgOwner = extractRolesObj(
      (param.req.user as any).org_roles as any,
    )?.[CloudOrgUserRoles.OWNER];

    // check current user have permission to update user by checking role power
    if (
      !isOrgOwner &&
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(workspaceUser.roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to update user`);
    }

    // check user have update role to target role by checking role power
    if (
      !isOrgOwner &&
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(param.roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(
        `Insufficient privilege to update user with this role`,
      );
    }

    const user = await User.get(param.userId, ncMeta);

    if (!user) NcError.userNotFound(param.userId);

    const workspace = await Workspace.get(param.workspaceId, undefined, ncMeta);

    if (!workspace) NcError.workspaceNotFound(param.workspaceId);

    if (
      ![
        WorkspaceUserRoles.OWNER,
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.COMMENTER,
        WorkspaceUserRoles.NO_ACCESS,
        WorkspaceUserRoles.INHERIT,
      ].includes(param.roles)
    ) {
      NcError.badRequest('Invalid role');
    }

    // if old role is owner and there is only one owner then restrict update
    if (workspaceUser.roles === WorkspaceUserRoles.OWNER) {
      const wsOwners = await WorkspaceUser.userList(
        {
          fk_workspace_id: workspace.id,
          roles: WorkspaceUserRoles.OWNER,
        },
        ncMeta,
      );

      if (wsOwners.length === 1) {
        NcError.badRequest('At least one owner should be there');
      }
    }

    const transaction = await ncMeta.startTransaction();

    try {
      await checkSeatLimit(
        param.workspaceId,
        workspaceUser.fk_user_id,
        workspaceUser.roles as WorkspaceUserRoles,
        param.roles,
        transaction,
      );

      await WorkspaceUser.update(
        param.workspaceId,
        param.userId,
        {
          roles: param.roles,
        },
        transaction,
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();

      // rollback cache
      await NocoCache.del(
        {
          workspace_id: param.workspaceId,
          base_id: null,
        },
        `${CacheScope.WORKSPACE_USER}:${param.workspaceId}:${param.userId}`,
      );
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to update user role', e);
      NcError.get(param.req.context).internalServerError(
        'Failed to update user role',
      );
    }

    await this.paymentService.reseatSubscription(workspace.id, ncMeta);

    this.mailService
      .sendMail({
        mailEvent: MailEvent.WORKSPACE_ROLE_UPDATE,
        payload: {
          workspace,
          user,
          oldRole: workspaceUser.roles as WorkspaceUserRoles,
          req: param.req,
          newRole: param.roles,
        },
      })
      .then(() => {
        /* ignore */
      });

    await PresignedUrl.signMetaIconImage(workspaceUser);

    this.appHooksService.emit(AppEvents.WORKSPACE_USER_UPDATE, {
      workspace,
      user,
      req: param.req,
      workspaceUser: {
        roles: param.roles,
      },
      oldWorkspaceUser: workspaceUser,
    });

    NocoSocket.broadcastEventToWorkspaceUsers(
      {
        workspace_id: workspace.id,
        base_id: null,
      },
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'workspace_user_update',
          payload: {
            workspaceUser: {
              ...workspaceUser,
              roles: param.roles,
            },
            workspace,
          },
        },
      },
      param.req.ncSocketId,
    );

    return workspaceUser;
  }

  async delete(
    param: { workspaceId: string; userId: string; req: NcRequest },
    ncMeta = Noco.ncMeta,
  ) {
    const { workspaceId, userId } = param;
    const context =
      param.req?.context ||
      ({
        workspace_id: workspaceId,
      } as NcContext);

    const workspace = await Workspace.get(workspaceId);

    const user = await User.get(userId);
    const workspaceUser = await WorkspaceUser.get(
      workspaceId,
      userId,
      {},
      ncMeta,
    );

    if (!workspaceUser) NcError.userNotFound(userId);

    // Block removal of SCIM-managed users — deactivation must happen via IdP
    if (workspaceUser.scim_managed) {
      NcError.badRequest(
        'This user is managed via SCIM. Removal must be done from your identity provider.',
      );
    }

    if (workspaceUser.roles === WorkspaceUserRoles.OWNER) {
      // current workspaceUser should have owner role to delete owner
      if (
        !extractRolesObj(param.req.user.workspace_roles)?.[
          WorkspaceUserRoles.OWNER
        ]
      ) {
        NcError.badRequest('Insufficient privilege to delete owner');
      }

      // at least one owner should be there after deletion
      const owners = await WorkspaceUser.userList({
        fk_workspace_id: workspaceId,
        roles: WorkspaceUserRoles.OWNER,
      });

      if (owners.length < 2) {
        NcError.badRequest('At least one owner should be there');
      }
    }

    // for other workspaceUser delete workspaceUser should have higher or equal role
    if (
      getWorkspaceRolePower(workspaceUser) >
      getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to delete user`);
    }

    // if not owner/creator then workspaceUser can only delete self
    if (
      ![WorkspaceUserRoles.OWNER, WorkspaceUserRoles.CREATOR].some((r) => {
        return extractRolesObj(param.req.user.workspace_roles)?.[r];
      }) &&
      workspaceUser.fk_user_id !== param.req.user.id
    ) {
      NcError.badRequest('Insufficient privilege to delete workspaceUser');
    }

    // Block removal if user is the sole owner of any team in the workspace
    const wsTeams = await Team.list(context, {
      fk_workspace_id: workspaceId,
    });

    for (const team of wsTeams) {
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        team.id,
        PrincipalType.USER,
        userId,
      );

      if (assignment?.roles === TeamUserRoles.OWNER) {
        const managersCount = await PrincipalAssignment.countByResourceAndRole(
          context,
          ResourceType.TEAM,
          team.id,
          TeamUserRoles.OWNER,
        );

        if (managersCount <= 1) {
          NcError.badRequest(
            `Cannot remove user — they are the sole owner of team "${team.title}". Transfer ownership first.`,
          );
        }
      }
    }

    // Soft delete + full cleanup (base access, teams, orphan bases, seat recount, socket)
    const res = await WorkspaceUser.softDelete(workspaceId, userId);

    await this.cleanupWorkspaceUser({ context, workspaceId, userId });

    this.appHooksService.emit(AppEvents.WORKSPACE_USER_DELETE, {
      workspace,
      workspaceUser: workspaceUser,
      user,
      req: param.req,
    } as WorkspaceUserDeleteEvent);

    return res;
  }

  /**
   * Shared cleanup for workspace user removal/deactivation.
   * Handles base access, team membership, orphan bases, cache, seat recount,
   * and socket notifications. Used by both normal delete and SCIM deactivation.
   *
   * Does NOT call WorkspaceUser.softDelete — caller must handle that separately.
   */
  async cleanupWorkspaceUser(param: {
    context: NcContext;
    workspaceId: string;
    userId: string;
  }) {
    const { context, workspaceId, userId } = param;
    const ncMeta = Noco.ncMeta;

    const transaction = await ncMeta.startTransaction();
    const cacheTransaction: (() => Promise<any>)[] = [];

    try {
      // Remove user from all bases in the workspace
      const workspaceBases = await Base.listByWorkspace(
        workspaceId,
        { includeDeleted: true, includeSnapshot: true },
        transaction,
      );

      for (const base of workspaceBases) {
        await BaseUser.delete(
          { workspace_id: workspaceId, base_id: base.id },
          base.id,
          userId,
          transaction,
        );

        await Permission.removeSubjectBase(
          { workspace_id: workspaceId, base_id: base.id },
          { type: 'user', id: userId },
          transaction,
        );

        cacheTransaction.push(() =>
          NocoCache.del(
            { workspace_id: workspaceId, base_id: base.id },
            `${CacheScope.BASE_USER}:${base.id}:${userId}`,
          ),
        );
        cacheTransaction.push(() =>
          Permission.clearBaseCache({
            workspace_id: workspaceId,
            base_id: base.id,
          }),
        );
      }

      // Remove user from all teams in the workspace
      const teams = await Team.list(
        context,
        { fk_workspace_id: workspaceId },
        transaction,
      );

      for (const team of teams) {
        const teamAssignment = await PrincipalAssignment.get(
          context,
          ResourceType.TEAM,
          team.id,
          PrincipalType.USER,
          userId,
          transaction,
        );

        if (teamAssignment) {
          await PrincipalAssignment.delete(
            context,
            ResourceType.TEAM,
            team.id,
            PrincipalType.USER,
            userId,
            transaction,
          );
        }
      }

      cacheTransaction.push(() =>
        NocoCache.del(
          { workspace_id: workspaceId, base_id: null },
          `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
        ),
      );

      // Handle orphan bases after user removal
      await handleOrphanBases(workspaceId, userId, transaction);

      await transaction.commit();

      // Execute cache cleanup after successful commit
      await Promise.all(cacheTransaction.map((fn) => fn()));
    } catch (e) {
      await transaction.rollback();

      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to cleanup workspace user', e);
      throw e;
    }

    // Reseat subscription (seat recount)
    await this.paymentService.reseatSubscription(workspaceId, ncMeta);

    // Broadcast socket event to notify user
    NocoSocket.broadcastEventToUser(userId, {
      event: EventType.USER_EVENT,
      payload: {
        action: 'workspace_user_remove',
        payload: { id: userId },
        workspaceId,
      },
    });

    // Broadcast to workspace users
    NocoSocket.broadcastEventToWorkspaceUsers(
      { workspace_id: workspaceId, base_id: null },
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'workspace_user_remove',
          payload: { id: userId },
          workspaceId,
        },
      },
    );
  }

  /**
   * Restore caches and seat count after a workspace user is reactivated
   * (e.g. via SCIM PATCH active=true). Counterpart of cleanupWorkspaceUser.
   *
   * Unlike cleanupWorkspaceUser, this does NOT re-create BaseUser records —
   * workspace-level users inherit base access via the leftJoin in getUsersList.
   * It only invalidates caches so the fresh DB state (deleted=false) is picked up.
   */
  async restoreWorkspaceUser(param: {
    context: NcContext;
    workspaceId: string;
    userId: string;
  }) {
    const { workspaceId, userId } = param;
    const ncMeta = Noco.ncMeta;

    // 1. Invalidate BASE_USER list cache for every base in the workspace
    //    so the next getUsersList query re-runs and includes the reactivated user
    const workspaceBases = await Base.listByWorkspace(workspaceId, {
      includeDeleted: true,
      includeSnapshot: true,
    });

    for (const base of workspaceBases) {
      await NocoCache.deepDel(
        { workspace_id: workspaceId, base_id: base.id },
        `${CacheScope.BASE_USER}:${base.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    // 2. Invalidate the individual WORKSPACE_USER cache entry
    await NocoCache.del(
      { workspace_id: workspaceId, base_id: null },
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
    );

    // 3. Reseat subscription (seat recount — user is now active again)
    await this.paymentService.reseatSubscription(workspaceId, ncMeta);

    // 4. Broadcast socket event so UI refreshes
    NocoSocket.broadcastEventToWorkspaceUsers(
      { workspace_id: workspaceId, base_id: null },
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'workspace_user_add',
          payload: { id: userId },
          workspaceId,
        },
      },
    );
  }

  async preInviteValidate(
    param: {
      workspaceId: string;
      body: any;
      invitedBy?: UserType;
      siteUrl: string;
      req: NcRequest;
      skipEmailInvite?: boolean;
      // invite user as soft deleted from workspace
      invitePassive?: boolean;
      baseEditor?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validateParams(['email', 'roles'], param.body);

    const {
      workspaceId,
      body: { email, roles },
    } = param;

    if (
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to invite with this role`);
    }

    const workspace = await Workspace.get(workspaceId, undefined, ncMeta);

    if (!workspace) {
      NcError.workspaceNotFound(workspaceId);
    }

    if (roles?.split(',').length > 1) {
      NcError.badRequest('Only one role can be assigned');
    }

    if (
      ![
        WorkspaceUserRoles.OWNER,
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.INHERIT,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.COMMENTER,
        WorkspaceUserRoles.NO_ACCESS,
      ].includes(roles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const emails = (email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => v.trim())
      .filter(Boolean);

    // check for invalid emails
    const invalidEmails = emails.filter((v) => !validator.isEmail(v));
    if (!emails.length) {
      return NcError.badRequest('Invalid email address');
    }

    if (invalidEmails.length) {
      NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
    }

    const { seatCount, nonSeatCount } =
      await Subscription.calculateWorkspaceSeatCount(workspaceId, ncMeta);

    const { limit: editorLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_EDITOR,
      workspaceId,
      ncMeta,
    );

    const { limit: commenterLimitForWorkspace } = await getLimit(
      PlanLimitTypes.LIMIT_COMMENTER,
      workspaceId,
      ncMeta,
    );

    const totalUserLimit = editorLimitForWorkspace + commenterLimitForWorkspace;

    if (!NON_SEAT_ROLES.includes(roles) || param.baseEditor) {
      // check if user limit is reached or going to be exceeded
      /**
       * If non seat user is more than commenters limit then we should restrict editor so that total users is under limit
       * @example (limit 3 editors, 10 commenter)
       * Non seat users = 11 and 1 owner then we should allow only 1 editor to add
       */
      const updatedEditorLimitForWorkspace =
        nonSeatCount > commenterLimitForWorkspace
          ? totalUserLimit - nonSeatCount
          : editorLimitForWorkspace;

      if (
        seatCount + emails.length > updatedEditorLimitForWorkspace &&
        // if invitePassive is true then don't check for user limit
        !param.invitePassive
      ) {
        NcError.planLimitExceeded(
          `The ${
            workspace.payment.plan.title
          } plan allows up to ${editorLimitForWorkspace} editors & ${commenterLimitForWorkspace} commenters per workspace. Upgrade to the ${
            HigherPlan[workspace.payment.plan.title]
          } plan for unlimited users.`,
          {
            plan: plan.title,
            limit: editorLimitForWorkspace,
            current: seatCount,
          },
        );
      }
    }

    /**
     * User limit handling if only 1 owner is present
     * no-access — We should be able to invite 12 users (later we can change role)
     * commenter — We should be able to add 10 users (which is under limit)
     * editor — We should be able to add 2 editors
     */

    if (NON_SEAT_ROLES.includes(roles) && !param.baseEditor) {
      let commenterLimitForWorkspaceToCheck = commenterLimitForWorkspace;

      /**
       * If role is no access then we should allow use to add more users than commenter limit but should ne less than total (editors + commenters)
       * @example (limit 3 editors, 10 commenter)
       * If 1 Owner and 1 viewer already present then we should allow to add 11 no access users
       * allow to add = (3 + 10) - 1 - 1 = 11
       */
      if (
        isFinite(commenterLimitForWorkspaceToCheck) &&
        WorkspaceUserRoles.NO_ACCESS === roles &&
        seatCount < editorLimitForWorkspace &&
        nonSeatCount + emails.length > commenterLimitForWorkspaceToCheck
      ) {
        commenterLimitForWorkspaceToCheck =
          totalUserLimit - seatCount - nonSeatCount;
      }

      // check if user limit is reached or going to be exceeded
      if (
        nonSeatCount + emails.length > commenterLimitForWorkspaceToCheck &&
        // if invitePassive is true then don't check for user limit
        !param.invitePassive
      ) {
        NcError.planLimitExceeded(
          `The ${
            workspace.payment.plan.title
          } plan allows up to ${editorLimitForWorkspace} editors & ${commenterLimitForWorkspace} commenters per workspace. Upgrade to the ${
            HigherPlan[workspace.payment.plan.title]
          } plan for unlimited users.`,
          {
            plan: plan.title,
            limit: commenterLimitForWorkspace,
            current: nonSeatCount,
          },
        );
      }
    }

    return { workspace, emails, roles };
  }

  async invite(
    param: {
      workspaceId: string;
      body: any;
      invitedBy?: UserType;
      siteUrl: string;
      req: NcRequest;
      skipEmailInvite?: boolean;
      // invite user as soft deleted from workspace
      invitePassive?: boolean;
      baseEditor?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const { workspace, emails, roles } = await this.preInviteValidate(
      param,
      ncMeta,
    );

    const invite_token = uuidv4();
    const error = [];
    const emailUserMap = new Map<string, User>();
    const registeredEmails = [];

    for (const email of emails) {
      // register user if not exists (canonical lookup handles alias variants)
      let user = await User.getByCanonicalEmail(email, ncMeta);
      if (!user) {
        const salt = await promisify(bcrypt.genSalt)(10);
        user = await this.usersService.registerNewUserIfAllowed(
          {
            email,
            password: '',
            email_verification_token: null,
            avatar: null,
            user_name: null,
            display_name: '',
            salt,
            invite_token,
            req: param.req,
            workspace_invite: true,
          },
          ncMeta,
        );
        registeredEmails.push(email);
      }

      emailUserMap.set(email, user);
    }

    const transaction = await ncMeta.startTransaction();
    const postOperations = [];

    try {
      // invite users
      for (const email of emails) {
        const { postOperations: eachPostOperations } =
          (await this.unhandledUserInviteByEmail(
            {
              workspace,
              email,
              error,
              roles,
              req: param.req,
              emailUserMap,
              invite_token,
              invitePassive: param.invitePassive,
              skipEmailInvite: param.skipEmailInvite,
            },
            transaction,
          )) ?? { postOperations: [] };
        postOperations.push(...eachPostOperations);
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();

      // rollback cache
      for (const email of emails) {
        const user = emailUserMap.get(email);
        await NocoCache.del(
          {
            workspace_id: param.workspaceId,
            base_id: null,
          },
          `${CacheScope.WORKSPACE_USER}:${workspace.id}:${user.id}`,
        );
      }

      this.logger.error('Failed to invite users', e);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      NcError.get(param.req.context).internalServerError(
        'Failed to invite users',
      );
    }

    await this.paymentService.reseatSubscription(workspace.id, ncMeta);

    for (const postOperation of postOperations) {
      await postOperation();
    }

    return { invite_token, emails, error, registeredEmails };
  }

  async prepareUserInviteByEmail(
    param: {
      roles: WorkspaceUserRoles;
      email: string;
      displayName?: string;
      siteUrl: string;
      workspaceId: string;
      req: NcRequest;
      // to keep refactor at minimum, we pass error array
      error?: any[];
      invitePassive?: boolean;
      invite_token?: string;
      skipEmailInvite?: boolean;
      // to keep refactor at minimum, we pass emailUserMap
      emailUserMap?: Map<string, User>;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const {
      email,
      roles,
      emailUserMap = new Map(),
      invite_token = uuidv4(),
      error = [],
    } = param;
    const { workspace } = await this.preInviteValidate(
      {
        ...param,
        body: {
          email,
          roles,
        },
      },
      ncMeta,
    );

    return {
      execute: async () => {
        const result = await this.unhandledUserInviteByEmail(
          {
            email,
            displayName: param.displayName,
            req: param.req,
            roles,
            workspace,
            emailUserMap,
            invite_token,
            invitePassive: param.invitePassive,
            skipEmailInvite: param.skipEmailInvite,
            error,
          },
          ncMeta,
        );
        await this.paymentService.reseatSubscription(workspace.id, ncMeta);
        return result;
      },
      rollback: async () => {
        // rollback cache

        const user = emailUserMap.get(email);
        if (user) {
          await NocoCache.del(
            {
              workspace_id: workspace.id,
              base_id: null,
            },
            `${CacheScope.WORKSPACE_USER}:${workspace.id}:${user.id}`,
          );
        }
      },
    };
  }

  async unhandledUserInviteByEmail(
    param: {
      workspace: Workspace;
      email: string;
      displayName?: string;
      roles: WorkspaceUserRoles;
      req: NcRequest;
      // to keep refactor at minimum, we pass error array
      error?: any[];
      invitePassive?: boolean;
      invite_token?: string;
      skipEmailInvite?: boolean;
      // to keep refactor at minimum, we pass emailUserMap
      emailUserMap?: Map<string, User>;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const {
      workspace,
      email,
      displayName,
      invite_token = uuidv4(),
      emailUserMap,
      roles,
      error,
    } = param;
    const postOperations = [];
    let isUserCreated = false;

    // register user if not exists (canonical lookup handles alias variants)
    let user = await User.getByCanonicalEmail(email, ncMeta);
    if (!user) {
      const salt = await promisify(bcrypt.genSalt)(10);
      user = await this.usersService.registerNewUserIfAllowed(
        {
          email,
          password: '',
          email_verification_token: null,
          avatar: null,
          user_name: null,
          display_name: displayName,
          salt,
          invite_token,
          req: param.req,
          workspace_invite: true,
        },
        ncMeta,
      );
      isUserCreated = true;
    } else if (user.invite_token) {
      // User exists but never completed signup — refresh their invite token
      // so the new invite URL is valid
      await User.update(
        user.id,
        {
          invite_token,
          invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        ncMeta,
      );
      isUserCreated = true;
    }

    emailUserMap?.set(email, user);

    const workspaceUser = await WorkspaceUser.get(
      workspace.id,
      user.id,
      {},
      ncMeta,
    );

    if (workspaceUser) {
      // If user was pre-created with NO_ACCESS (e.g. from on-prem lazy workspace addition),
      // upgrade their role instead of rejecting the invite
      if (workspaceUser.roles === WorkspaceUserRoles.NO_ACCESS) {
        await WorkspaceUser.update(
          workspace.id,
          user.id,
          { roles: roles || WorkspaceUserRoles.VIEWER },
          ncMeta,
        );
      } else {
        error?.push({
          email,
          msg: `${user.email} with role ${workspaceUser.roles} already exists in this workspace`,
        });
        return { postOperations: [] };
      }
    } else {
      await WorkspaceUser.insert(
        {
          fk_workspace_id: workspace.id,
          fk_user_id: user.id,
          roles: roles || WorkspaceUserRoles.VIEWER,
          invited_by: param.req?.user?.id,
          ...(param.invitePassive
            ? { deleted: true, deleted_at: ncMeta.now() }
            : {}),
        },
        ncMeta,
      );
    }

    if (!param.skipEmailInvite) {
      postOperations.push(async () => {
        this.mailService
          .sendMail({
            mailEvent: MailEvent.WORKSPACE_INVITE,
            payload: {
              workspace,
              user,
              req: param.req,
              token: isUserCreated ? invite_token : null,
            },
          })
          .then(() => {
            /* ignore */
          })
          .catch((e) => {
            console.error(e);
          });

        this.appHooksService.emit(AppEvents.WORKSPACE_USER_INVITE, {
          workspace,
          user,
          roles: roles || WorkspaceUserRoles.NO_ACCESS,
          invitedBy: param.req?.user,
          req: param.req,
        });

        const workspaceUser = await WorkspaceUser.get(
          workspace.id,
          user.id,
          {},
          ncMeta,
        );

        NocoSocket.broadcastEventToWorkspaceUsers(
          {
            workspace_id: workspace.id,
            base_id: null,
          },
          {
            event: EventType.USER_EVENT,
            payload: {
              action: 'workspace_user_add',
              payload: {
                workspaceUser,
                workspace,
              },
            },
          },
          param.req.ncSocketId,
        );
      });
    }
    return { postOperations, user };
  }

  async acceptInvite(param: { invitationToken: string; userId: string }) {
    const workspaceUser = await WorkspaceUser.getByToken(
      param.invitationToken,
      param.userId,
    );
    if (!workspaceUser) {
      NcError.badRequest('Invitation not found');
    }

    return await WorkspaceUser.update(
      workspaceUser.fk_workspace_id,
      workspaceUser.fk_user_id,
      {
        invite_accepted: true,
        invite_token: null,
      },
    );
  }

  async rejectInvite(param: { invitationToken: string; userId: string }) {
    const workspaceUser = await WorkspaceUser.getByToken(
      param.invitationToken,
      param.userId,
    );
    if (!workspaceUser) {
      NcError.badRequest('Invitation not found');
    }

    return await WorkspaceUser.update(
      workspaceUser.fk_workspace_id,
      workspaceUser.fk_user_id,
      {
        invite_accepted: false,
        invite_token: null,
      },
    );
  }
}
