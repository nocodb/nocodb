import { Router } from 'express';
import { OrgUserRoles } from 'nocodb-sdk';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { orgUserService } from '../services';

async function userList(req, res) {
  res.json(
    await orgUserService.userList({
      query: req.query,
    })
  );
}

async function userUpdate(req, res) {
  res.json(
    await orgUserService.userUpdate({
      user: req.body,
      userId: req.params.userId,
    })
  );
}

async function userDelete(req, res) {
  await orgUserService.userDelete({
    userId: req.params.userId,
  });
  res.json({ msg: 'success' });
}

async function userAdd(req, res) {
  const result = await orgUserService.userAdd({
    user: req.body,
    req,
    projectId: req.params.projectId,
  });

  res.json(result);
}

async function userSettings(_req, res): Promise<any> {
  await orgUserService.userSettings({});
  res.json({});
}

async function userInviteResend(req, res): Promise<any> {
  await orgUserService.userInviteResend({
    userId: req.params.userId,
    req,
  });

  res.json({ msg: 'success' });
}

async function generateResetUrl(req, res) {
  const result = await orgUserService.generateResetUrl({
    siteUrl: req.ncSiteUrl,
    userId: req.params.userId,
  });

  res.json(result);
}

async function appSettingsGet(_req, res) {
  const settings = await orgUserService.appSettingsGet();
  res.json(settings);
}

async function appSettingsSet(req, res) {
  await orgUserService.appSettingsSet({
    settings: req.body,
  });

  res.json({ msg: 'Settings saved' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userList, 'userList', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.patch(
  '/api/v1/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userUpdate, 'userUpdate', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.delete(
  '/api/v1/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userDelete, 'userDelete', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userAdd, 'userAdd', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/users/settings',
  metaApiMetrics,
  ncMetaAclMw(userSettings, 'userSettings', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/users/:userId/resend-invite',
  metaApiMetrics,
  ncMetaAclMw(userInviteResend, 'userInviteResend', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

router.post(
  '/api/v1/users/:userId/generate-reset-url',
  metaApiMetrics,
  ncMetaAclMw(generateResetUrl, 'generateResetUrl', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

router.get(
  '/api/v1/app-settings',
  metaApiMetrics,
  ncMetaAclMw(appSettingsGet, 'appSettingsGet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

router.post(
  '/api/v1/app-settings',
  metaApiMetrics,
  ncMetaAclMw(appSettingsSet, 'appSettingsSet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

export default router;
