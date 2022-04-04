// // Project CRUD
import { Request, Response } from 'express';

import { packageVersion } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import SqlMgrv2 from '../../../sqlMgr/v2/SqlMgrv2';
import { defaultConnectionConfig } from '../../../utils/NcConfigFactory';
import User from '../../../noco-models/User';
import catchError from '../helpers/catchError';

export async function testConnection(req: Request, res: Response) {
  res.json(await SqlMgrv2.testConnection(req.body));
}
export async function appInfo(_req: Request, res: Response) {
  const projectHasAdmin = !(await User.isFirst());
  const result = {
    authType: 'jwt',
    projectHasAdmin,
    firstUser: !projectHasAdmin,
    type: 'rest',
    env: process.env.NODE_ENV,
    googleAuthEnabled: !!(
      process.env.NC_GOOGLE_CLIENT_ID && process.env.NC_GOOGLE_CLIENT_SECRET
    ),
    githubAuthEnabled: !!(
      process.env.NC_GITHUB_CLIENT_ID && process.env.NC_GITHUB_CLIENT_SECRET
    ),
    oneClick: !!process.env.NC_ONE_CLICK,
    connectToExternalDB: !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
    version: packageVersion,
    defaultLimit: Math.max(
      Math.min(
        +process.env.DB_QUERY_LIMIT_DEFAULT || 25,
        +process.env.DB_QUERY_LIMIT_MAX || 100
      ),
      +process.env.DB_QUERY_LIMIT_MIN || 1
    ),
    timezone: defaultConnectionConfig.timezone,
    ncMin: !!process.env.NC_MIN,
    teleEnabled: !process.env.NC_DISABLE_TELE
  };

  res.json(result);
}

export default router => {
  router.post('/testConnection', ncMetaAclMw(testConnection));
  router.get('/appInfo', catchError(appInfo));
};
