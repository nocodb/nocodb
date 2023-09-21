import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  PluginCategory,
  ProjectRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as ejs from 'ejs';
import validator from 'validator';
import type { ProjectUserReqType, UserType } from 'nocodb-sdk';
import NocoCache from '~/cache/NocoCache';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { randomTokenString } from '~/helpers/stringHelpers';
import { Project, ProjectUser, User } from '~/models';

import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { getProjectRolePower } from '~/utils/roleHelper';

@Injectable()
export class ProjectUsersService {
  constructor(protected appHooksService: AppHooksService) {}

  async userList(param: { projectId: string; query: any }) {
    return new PagedResponseImpl(
      await ProjectUser.getUsersList({
        ...param.query,
        project_id: param.projectId,
      }),
      {
        ...param.query,
        count: await ProjectUser.getUsersCount({
          project_id: param.projectId,
          ...param.query,
        }),
      },
    );
  }

  async userInvite(param: {
    projectId: string;
    projectUser: ProjectUserReqType;
    req: any;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.projectUser,
    );

    if (
      getProjectRolePower({
        project_roles: extractRolesObj(param.projectUser.roles),
      }) > getProjectRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to invite with this role`);
    }

    if (
      ![
        ProjectRoles.CREATOR,
        ProjectRoles.EDITOR,
        ProjectRoles.COMMENTER,
        ProjectRoles.VIEWER,
        ProjectRoles.NO_ACCESS,
      ].includes(param.projectUser.roles as ProjectRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const emails = (param.projectUser.email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => v.trim());

    // check for invalid emails
    const invalidEmails = emails.filter((v) => !validator.isEmail(v));
    if (!emails.length) {
      return NcError.badRequest('Invalid email address');
    }
    if (invalidEmails.length) {
      NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
    }

    const invite_token = uuidv4();
    const error = [];

    for (const email of emails) {
      // add user to project if user already exist
      const user = await User.getByEmail(email);

      const project = await Project.get(param.projectId);

      if (!project) {
        return NcError.badRequest('Invalid project id');
      }

      if (user) {
        // check if this user has been added to this project
        const projectUser = await ProjectUser.get(param.projectId, user.id);

        const project = await Project.get(param.projectId);

        if (!project) {
          return NcError.badRequest('Invalid project id');
        }

        if (projectUser) {
          NcError.badRequest(
            `${user.email} with role ${projectUser.roles} already exists in this project`,
          );
        }

        await ProjectUser.insert({
          project_id: param.projectId,
          fk_user_id: user.id,
          roles: param.projectUser.roles || 'editor',
        });

        this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
          project,
          user,
          invitedBy: param.req.user,
          ip: param.req.clientIp,
        });

        const cachedUser = await NocoCache.get(
          `${CacheScope.USER}:${email}___${param.projectId}`,
          CacheGetType.TYPE_OBJECT,
        );

        if (cachedUser) {
          cachedUser.roles = param.projectUser.roles || 'editor';
          await NocoCache.set(
            `${CacheScope.USER}:${email}___${param.projectId}`,
            cachedUser,
          );
        }
      } else {
        try {
          // create new user with invite token
          const user = await User.insert({
            invite_token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            email,
            roles: OrgUserRoles.VIEWER,
            token_version: randomTokenString(),
          });

          // add user to project
          await ProjectUser.insert({
            project_id: param.projectId,
            fk_user_id: user.id,
            roles: param.projectUser.roles,
          });

          this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
            project,
            user,
            invitedBy: param.req.user,
            ip: param.req.clientIp,
          });

          // in case of single user check for smtp failure
          // and send back token if failed
          if (
            emails.length === 1 &&
            !(await this.sendInviteEmail(email, invite_token, param.req))
          ) {
            return { invite_token, email };
          } else {
            this.sendInviteEmail(email, invite_token, param.req);
          }
        } catch (e) {
          console.log(e);
          if (emails.length === 1) {
            throw e;
          } else {
            error.push({ email, error: e.message });
          }
        }
      }
    }

    if (emails.length === 1) {
      return {
        msg: 'The user has been invited successfully',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  async projectUserUpdate(param: {
    userId: string;
    // todo: update swagger
    projectUser: ProjectUserReqType & { project_id: string };
    // todo: refactor
    req: any;
    projectId: string;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.projectUser,
    );

    if (!param.projectId) {
      NcError.badRequest('Missing project id');
    }

    const project = await Project.get(param.projectId);

    if (!project) {
      return NcError.badRequest('Invalid project id');
    }

    if (param.projectUser.roles.includes(ProjectRoles.OWNER)) {
      NcError.badRequest('Owner cannot be updated');
    }

    if (
      ![
        ProjectRoles.CREATOR,
        ProjectRoles.EDITOR,
        ProjectRoles.COMMENTER,
        ProjectRoles.VIEWER,
        ProjectRoles.NO_ACCESS,
      ].includes(param.projectUser.roles as ProjectRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' doesn't exist`);
    }

    const targetUser = await User.getWithRoles(param.userId, {
      user,
      projectId: param.projectId,
    });

    if (!targetUser) {
      NcError.badRequest(
        `User with id '${param.userId}' doesn't exist in this project`,
      );
    }

    if (
      getProjectRolePower(targetUser) >= getProjectRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to update user`);
    }

    await ProjectUser.updateRoles(
      param.projectId,
      param.userId,
      param.projectUser.roles,
    );

    this.appHooksService.emit(AppEvents.PROJECT_USER_UPDATE, {
      project,
      user,
      updatedBy: param.req.user,
      ip: param.req.clientIp,
      projectUser: param.projectUser,
    });

    return {
      msg: 'User has been updated successfully',
    };
  }

  async projectUserDelete(param: {
    projectId: string;
    userId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const project_id = param.projectId;

    if (param.req.user?.id === param.userId) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    if (!param.req.user?.project_roles?.owner) {
      const user = await User.get(param.userId);
      if (user.roles?.split(',').includes('super'))
        NcError.forbidden(
          'Insufficient privilege to delete a super admin user.',
        );

      const projectUser = await ProjectUser.get(project_id, param.userId);
      if (projectUser?.roles?.split(',').includes('owner'))
        NcError.forbidden('Insufficient privilege to delete a owner user.');
    }

    await ProjectUser.delete(project_id, param.userId);
    return true;
  }

  async projectUserInviteResend(param: {
    userId: string;
    projectUser: ProjectUserReqType;
    projectId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' not found`);
    }

    const project = await Project.get(param.projectId);

    if (!project) {
      return NcError.badRequest('Invalid project id');
    }

    const invite_token = uuidv4();

    await User.update(user.id, {
      invite_token,
      invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const pluginData = await Noco.ncMeta.metaGet2(
      null,
      null,
      MetaTable.PLUGIN,
      {
        category: PluginCategory.EMAIL,
        active: true,
      },
    );

    if (!pluginData) {
      NcError.badRequest(
        `No Email Plugin is found. Please go to App Store to configure first or copy the invitation URL to users instead.`,
      );
    }

    await this.sendInviteEmail(user.email, invite_token, param.req);

    this.appHooksService.emit(AppEvents.PROJECT_USER_RESEND_INVITE, {
      project,
      user,
      invitedBy: param.req.user,
      ip: param.req.clientIp,
      projectUser: param.projectUser,
    });

    return true;
  }

  // todo: refactor the whole function
  async sendInviteEmail(email: string, token: string, req: any): Promise<any> {
    try {
      const template = (await import('./ui/emailTemplates/invite')).default;

      const emailAdapter = await NcPluginMgrv2.emailAdapter();

      if (emailAdapter) {
        await emailAdapter.mailSend({
          to: email,
          subject: 'Verify email',
          html: ejs.render(template, {
            signupLink: `${req.ncSiteUrl}${
              Noco.getConfig()?.dashboardPath
            }#/signup/${token}`,
            projectName: req.body?.projectName,
            roles: (req.body?.roles || '')
              .split(',')
              .map((r) => r.replace(/^./, (m) => m.toUpperCase()))
              .join(', '),
            adminEmail: req.user?.email,
          }),
        });
        return true;
      }
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.',
        e.message,
      );
      throw e;
    }
  }

  async projectUserMetaUpdate(param: {
    body: any;
    projectId: string;
    user: UserType;
  }) {
    // update project user data
    const projectUserData = extractProps(param.body, [
      'starred',
      'order',
      'hidden',
    ]);

    if (Object.keys(projectUserData).length) {
      // create new project user if it doesn't exist
      if (!(await ProjectUser.get(param.projectId, param.user?.id))) {
        await ProjectUser.insert({
          ...projectUserData,
          project_id: param.projectId,
          fk_user_id: param.user?.id,
        });
      } else {
        await ProjectUser.update(
          param.projectId,
          param.user?.id,
          projectUserData,
        );
      }
    }

    return true;
  }
}
