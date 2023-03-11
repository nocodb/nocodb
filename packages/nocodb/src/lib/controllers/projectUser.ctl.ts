import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
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
  await projectUserService.userInvite({
    projectId: req.params.projectId,
    projectUser: req.body,
    req,
  })
  res.json({
    msg: 'The user has been invited successfully',
  });
}

async function projectUserUpdate(req, res): Promise<any> {
  await projectUserService.projectUserUpdate({
    projectUser: req.body,
    projectId: req.params.projectId,
    userId: req.params.userId,
    req,
  })
  res.json({
    msg: 'The user has been updated successfully',
  });
}

async function projectUserDelete(req, res): Promise<any> {
  await projectUserService.projectUserDelete({
    projectId: req.params.projectId,
    userId: req.params.userId,
    req,
  });
  res.json({
    msg: 'The user has been deleted successfully',
  });
}

async function projectUserInviteResend(req, res): Promise<any> {
  await projectUserService.projectUserInviteResend({
    projectId: req.params.projectId,
    userId: req.params.userId,
    projectUser: req.body,
    req,
  })
;
  res.json({
    msg: 'The invitation has been sent to the user'
  })
    
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
