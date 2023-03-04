import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { Router } from 'express';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { projectUserService } from '../services';

async function userList(req, res) {
  res.json({
    users: await projectUserService.userList({
      projectId: req.params.projectId,
      query: req.query,
    }),
  });
}

async function userInvite(req, res): Promise<any> {
  res.json(
    await projectUserService.userInvite({
      projectId: req.params.projectId,
      projectUser: req.body,
      req,
    })
  );
}

// @ts-ignore
async function projectUserUpdate(req, res, next): Promise<any> {
  res.json(
    await projectUserService.projectUserUpdate({
      projectUser: req.body,
      projectId: req.params.projectId,
      userId: req.params.userId,
      req,
    })
  );
}

async function projectUserDelete(req, res): Promise<any> {
  await projectUserService.projectUserDelete({
    projectId: req.params.projectId,
    userId: req.params.userId,
    req,
  });
  res.json({
    msg: 'success',
  });
}

async function projectUserInviteResend(req, res): Promise<any> {
  res.json(
    await projectUserService.projectUserInviteResend({
      projectId: req.params.projectId,
      userId: req.params.userId,
      projectUser: req.body,
      req,
    })
  );
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/users',
  metaApiMetrics,
  ncMetaAclMw(userList, 'userList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/users',
  metaApiMetrics,
  ncMetaAclMw(userInvite, 'userInvite')
);
router.patch(
  '/api/v1/db/meta/projects/:projectId/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(projectUserUpdate, 'projectUserUpdate')
);
router.delete(
  '/api/v1/db/meta/projects/:projectId/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(projectUserDelete, 'projectUserDelete')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/users/:userId/resend-invite',
  metaApiMetrics,
  ncMetaAclMw(projectUserInviteResend, 'projectUserInviteResend')
);
export default router;
