import type { Request, Response } from 'express';
import { Router } from 'express';
import type { UserType, WorkspaceType } from 'nocodb-sdk';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';

import { workspaceService } from '../services';

const workspaceCreate = async (
  req: Request<any, WorkspaceType, WorkspaceType>,
  res
) => {
  const result = await workspaceService.workspaceCreate({
    workspaces: req.body,
    user: (req as any)?.session?.passport?.user as UserType,
  });

  res.json(result);
};

const workspaceGet = async (
  req: Request<{ workspaceId: string }>,
  res: Response<WorkspaceType>
) => {
  const workspace = await workspaceService.workspaceGet({
    workspaceId: req.params.workspaceId,
  });

  res.json(workspace);
};

const workspaceList = async (
  req: Request,
  // todo: replace type with paginated type
  res: Response
) => {
  const workspaces = await workspaceService.workspaceList({
    userId: (req as any).user?.id,
  });

  res.json(workspaces);
};

const workspaceUpdate = async (
  req: Request<{ workspaceId: string }, any, Partial<WorkspaceType>>,
  res: Response
) => {
  const workspace = await workspaceService.workspaceUpdate({
    workspaceId: req.params.workspaceId,
    body: req.body,
    userId: (req as any).user?.id,
  });

  res.json(workspace);
};
const workspaceDelete = async (
  req: Request<{ workspaceId: string }>,
  res: Response
) => {
  await workspaceService.workspaceDelete({
    workspaceId: req.params.workspaceId,
  });
  res.json({
    msg: 'Workspace deleted',
  });
};

const workspaceUserList = async (req, res) => {
  const users = workspaceService.workspaceUserList({
    workspaceId: req.params.workspaceId,
  });

  // todo: pagination
  res.json(users);
};
const workspaceUserGet = (_req, res) => {
  // todo
  res.json({});
};
const workspaceUserUpdate = async (req, res) => {
  const result = await workspaceService.workspaceUserUpdate({
    workspaceId: req.params.workspaceId,
    userId: req.params.userId,
    body: req.body,
  });

  res.json(result);
};
const workspaceUserDelete = async (req, res) => {
  await workspaceService.workspaceUserDelete({
    workspaceId: req.params.workspaceId,
    userId: req.params.userId,
  });

  res.json({
    msg: 'User deleted',
  });
};

const workspaceInvite = async (req, res) => {
  const result = await workspaceService.workspaceInvite({
    workspaceId: req.params.workspaceId,
    body: req.body,
  });

  res.json(result);
};

const workspaceProjectList = async (req, res) => {
  const paginatedProjectList = await workspaceService.workspaceProjectList({
    workspaceId: req.params.workspaceId,
    userId: req.user?.id,
  });

  res.json(paginatedProjectList);
};

const workspaceInvitationAccept = async (req, res) => {
  const response = await workspaceService.workspaceInvitationAccept({
    invitationToken: req.params.invitationToken,
    userId: req.params.userId,
  });

  res.json(response);
};
const workspaceInvitationReject = async (req, res) => {
  const response = await workspaceService.workspaceInvitationReject({
    invitationToken: req.params.invitationToken,
    userId: req.params.userId,
  });

  res.json(response);
};

const moveProjectToWorkspace = async (req, res) => {
  await workspaceService.moveProjectToWorkspace({
    projectId: req.params.projectId,
    workspaceId: req.params.workspaceId,
    userId: req.user?.id,
  });

  res.json({ msg: 'success' });
};

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
