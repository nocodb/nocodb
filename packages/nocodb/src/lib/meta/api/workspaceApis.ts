import { Request, Response, Router } from 'express';
import { Workspace } from '../../models/Workspace';
import { ProjectRoles, WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { WorkspaceUser } from '../../models/WorkspaceUser';
import { NcError } from '../helpers/catchError';
import validator from 'validator';
import User from '../../models/User';

import { v4 as uuidv4 } from 'uuid';
import Project from '../../models/Project';
import validateParams from '../helpers/validateParams';
import ProjectUser from '../../models/ProjectUser';

const workspaceCreate = async (
  req: Request<any, WorkspaceType, WorkspaceType>,
  res
) => {
  validateParams(['title'], req.body);

  const workspaceTitles = req.body.title
    .split(',')
    .map((title) => title.trim())
    .filter(Boolean);

  const workspaces = [];

  for (const workspaceTitle of workspaceTitles) {
    const workspace = await Workspace.insert({
      ...req.body,
      title: workspaceTitle,
      // todo : extend request type
      fk_user_id: (req as any).user.id,
    });

    await WorkspaceUser.insert({
      fk_workspace_id: workspace.id,
      fk_user_id: (req as any).user.id,
      roles: WorkspaceUserRoles.OWNER,
    });

    workspaces.push(workspace);
  }
  res.json(workspaces.length === 1 ? workspaces[0] : workspaces);
};

const workspaceGet = async (
  req: Request<{ workspaceId: string }>,
  res: Response<WorkspaceType>
) => {
  const workspace = await Workspace.get(req.params.workspaceId);

  if (!workspace) NcError.notFound('Workspace not found');

  res.json(workspace);
};

const workspaceList = async (
  req: Request,
  // todo: replace type with paginated type
  res: Response
) => {
  const workspaces = await WorkspaceUser.workspaceList({
    fk_user_id: (req as any).user?.id,
  });

  // todo: pagination
  res.json(
    new PagedResponseImpl<WorkspaceType>(workspaces, {
      count: workspaces.length,
    })
  );
};

const workspaceUpdate = async (
  req: Request<{ workspaceId: string }, any, Partial<WorkspaceType>>,
  res: Response
) => {
  // todo: allow order update for all user
  //       and block rest of the options
  if ('order' in req.body) {
    await WorkspaceUser.update(req.params.workspaceId, req['user']?.id, {
      order: req.body.order,
    });
    delete req.body.order;
  }

  // todo: validate params
  // validateParams(['title', 'description'], req.body);

  const workspace = await Workspace.update(req.params.workspaceId, req.body);

  res.json(workspace);
};
const workspaceDelete = async (
  req: Request<{ workspaceId: string }>,
  res: Response
) => {
  // todo: avoid removing owner

  // block unauthorized user form deleting

  // todo: unlink any project linked
  res.json(await Workspace.delete(req.params.workspaceId));
};

const workspaceUserList = async (req, res) => {
  const users = await WorkspaceUser.userList({
    fk_workspace_id: req.params.workspaceId,
  });

  // todo: pagination
  res.json(
    new PagedResponseImpl<WorkspaceType>(users, {
      count: users.length,
    })
  );
};
const workspaceUserGet = (_req, _res) => {
  // todo
};
const workspaceUserUpdate = async (req, res) => {
  // validateParams(['roles'], req.body);

  // todo
  const { workspaceId, userId } = req.params;
  const { roles } = req.body;

  res.json(await WorkspaceUser.update(workspaceId, userId, { roles }));
};
const workspaceUserDelete = async (req, res) => {
  // todo
  const { workspaceId, userId } = req.params;

  res.json(await WorkspaceUser.delete(workspaceId, userId));
};

const workspaceInvite = async (req, res) => {
  validateParams(['email', 'roles'], req.body);

  const { workspaceId } = req.params;
  const { email, roles } = req.body;

  if (roles?.split(',').length > 1) {
    NcError.badRequest('Only one role can be assigned');
  }

  if (
    roles !== WorkspaceUserRoles.CREATOR &&
    roles !== WorkspaceUserRoles.VIEWER
  ) {
    NcError.badRequest('Invalid role');
  }

  const emails = (email || '')
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

    if (user) {
      // check if this user has been added to this project
      const workspaceUser = await WorkspaceUser.get(workspaceId, user.id);
      if (workspaceUser) {
        NcError.badRequest(
          `${user.email} with role ${workspaceUser.roles} already exists in this project`
        );
      }

      await WorkspaceUser.insert({
        fk_workspace_id: workspaceId,
        fk_user_id: user.id,
        roles: roles || 'editor',
      });

      // const cachedUser = await NocoCache.get(
      //   `${CacheScope.USER}:${email}___${req.params.projectId}`,
      //   CacheGetType.TYPE_OBJECT
      // );
      //
      // if (cachedUser) {
      //   cachedUser.roles = req.body.roles || 'editor';
      //   await NocoCache.set(
      //     `${CacheScope.USER}:${email}___${req.params.projectId}`,
      //     cachedUser
      //   );
      // }

      // await Audit.insert({
      //   project_id: req.params.projectId,
      //   op_type: 'AUTHENTICATION',
      //   op_sub_type: 'INVITE',
      //   user: req.user.email,
      //   description: `invited ${email} to ${req.params.projectId} project `,
      //   ip: req.clientIp,
      // });
    } else {
      // todo: send invite email
      NcError.badRequest(`${email} is not registerd in noco`);
      // try {
      //   // create new user with invite token
      //   const {id} = await User.insert({
      //     invite_token,
      //     invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      //     email,
      //     roles: OrgUserRoles.VIEWER,
      //     token_version: randomTokenString(),
      //   });
      //
      //   // add user to project
      //   await ProjectUser.insert({
      //     project_id: req.params.projectId,
      //     fk_user_id: id,
      //     roles: req.body.roles,
      //   });
      //
      //   const count = await User.count();
      //   Tele.emit('evt', {evt_type: 'project:invite', count});
      //
      //   await Audit.insert({
      //     project_id: req.params.projectId,
      //     op_type: 'AUTHENTICATION',
      //     op_sub_type: 'INVITE',
      //     user: req.user.email,
      //     description: `invited ${email} to ${req.params.projectId} project `,
      //     ip: req.clientIp,
      //   });
      //   // in case of single user check for smtp failure
      //   // and send back token if failed
      //   if (
      //     emails.length === 1 &&
      //     !(await sendInviteEmail(email, invite_token, req))
      //   ) {
      //     return res.json({invite_token, email});
      //   } else {
      //     sendInviteEmail(email, invite_token, req);
      //   }
      // } catch (e) {
      //   console.log(e);
      //   if (emails.length === 1) {
      //     return next(e);
      //   } else {
      //     error.push({email, error: e.message});
      //   }
      // }
    }
  }

  if (emails.length === 1) {
    res.json({
      msg: 'success',
    });
  } else {
    return res.json({ invite_token, emails, error });
  }

  // check if user exists
  // if not, create user
  // create workspace user
  // send email
};

const workspaceProjectList = async (req, res) => {
  const projects = await Project.listByWorkspaceAndUser(
    req.params.workspaceId,
    req.user?.id
  );

  res.json(
    new PagedResponseImpl<WorkspaceType>(projects, {
      count: projects.length,
    })
  );
};

/*
const workspaceInvitationGet = (_req, _res) => {
  // todo
};
const workspaceInvitationUpdate = (_req, _res) => {
  // todo
};
const workspaceInvitationDelete = (_req, _res) => {
  // todo
};*/

const workspaceInvitationAccept = async (req, res) => {
  const workspaceUser = await WorkspaceUser.getByToken(
    req.params.invitationToken,
    req.params.userId
  );
  if (!workspaceUser) {
    NcError.badRequest('Invitation not found');
  }

  res.json(
    await WorkspaceUser.update(
      workspaceUser.fk_workspace_id,
      workspaceUser.fk_user_id,
      {
        invite_accepted: true,
        invite_token: null,
      }
    )
  );
};
const workspaceInvitationReject = async (req, res) => {
  const workspaceUser = await WorkspaceUser.getByToken(
    req.params.invitationToken,
    req.params.userId
  );
  if (!workspaceUser) {
    NcError.badRequest('Invitation not found');
  }

  res.json(
    await WorkspaceUser.update(
      workspaceUser.fk_workspace_id,
      workspaceUser.fk_user_id,
      {
        invite_accepted: false,
        invite_token: null,
      }
    )
  );
};

const moveProjectToWorkspace = async (req, res) => {
  // verify user is current project owner or workspace owner

  const project = await Project.get(req.params.projectId);

  const projectUser = await ProjectUser.get(
    req.params.projectId,
    req['user']?.id
  );
  const currentWorkspaceUser = await WorkspaceUser.get(
    project.fk_workspace_id,
    req['user']?.id
  );

  if (
    projectUser?.roles !== ProjectRoles.OWNER &&
    currentWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER
  ) {
    NcError.forbidden('You are not the project owner');
  }

  // verify user is workaggerspace owner

  const destWorkspaceUser = await WorkspaceUser.get(
    req.params.workspaceId,
    req['user']?.id
  );

  if (destWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER) {
    NcError.forbidden('You are not the workspace owner');
  }

  // update the project workspace id
  await Project.update(req.params.projectId, {
    fk_workspace_id: req.params.workspaceId,
  });

  res.json({ msg: 'success' });
};

/*const workspaceInvitationTokenRead = (_req, _res) => {
  // todo
};*/

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/workspaces',
  ncMetaAclMw(workspaceCreate, 'workspaceCreate')
);

router.get('/api/v1/workspaces/', ncMetaAclMw(workspaceList, 'workspaceList'));

router.get(
  '/api/v1/workspaces/:workspaceId',
  ncMetaAclMw(workspaceGet, 'workspaceGet')
);

router.patch(
  '/api/v1/workspaces/:workspaceId',
  ncMetaAclMw(workspaceUpdate, 'workspaceUpdate')
);

router.post(
  '/api/v1/workspaces/:workspaceId/projects/:projectId/move',
  ncMetaAclMw(moveProjectToWorkspace, 'moveProjectToWorkspace')
);

//
router.delete(
  '/api/v1/workspaces/:workspaceId',
  ncMetaAclMw(workspaceDelete, 'workspaceDelete')
);

// user list
router.get(
  '/api/v1/workspaces/:workspaceId/users',
  ncMetaAclMw(workspaceUserList, 'workspaceUserList')
);
// user get
router.get(
  '/api/v1/workspaces/:workspaceId/users/:userId',
  ncMetaAclMw(workspaceUserGet, 'workspaceUserGet')
);
// user update
router.patch(
  '/api/v1/workspaces/:workspaceId/users/:userId',
  ncMetaAclMw(workspaceUserUpdate, 'workspaceUserUpdate')
);
// user delete
router.delete(
  '/api/v1/workspaces/:workspaceId/users/:userId',
  ncMetaAclMw(workspaceUserDelete, 'workspaceUserDelete')
);

router.post(
  '/api/v1/workspaces/:workspaceId/invitations',
  ncMetaAclMw(workspaceInvite, 'workspaceInvite')
);

router.get(
  '/api/v1/workspaces/:workspaceId/projects',
  ncMetaAclMw(workspaceProjectList, 'workspaceProjectList')
);

// invitation accept
router.post(
  '/api/v1/workspaces/:workspaceId/invitations/:invitationToken/accept',
  ncMetaAclMw(workspaceInvitationAccept, 'workspaceInvitationAccept')
);

// invitation reject
router.post(
  '/api/v1/workspaces/:workspaceId/invitations/:invitationToken/reject',
  ncMetaAclMw(workspaceInvitationReject, 'workspaceInvitationReject')
);

export default router;
