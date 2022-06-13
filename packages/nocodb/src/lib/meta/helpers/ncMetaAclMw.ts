import projectAcl from '../../utils/projectAcl';
import { NextFunction, Request, Response } from 'express';
import catchError, { NcError } from './catchError';
import extractProjectIdAndAuthenticate from './extractProjectIdAndAuthenticate';
import NocoCache from '../../cache/NocoCache';
import Noco from '../../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../../utils/globals';

export default function(handlerFn, permissionName) {
  return [
    extractProjectIdAndAuthenticate,
    catchError(async function authMiddleware(req, _res, next) {
      const roles = req?.session?.passport?.user?.roles;
      if (
        !(
          roles?.creator ||
          roles?.owner ||
          roles?.editor ||
          roles?.viewer ||
          roles?.commenter ||
          roles?.user ||
          roles?.user_new
        )
      ) {
        NcError.unauthorized('Unauthorized access');
      }

      // check if the token is still valid for non-public base
      if (!req?.session?.passport?.user?.isPublicBase) {
        const email = req?.session?.passport?.user?.email;
        let user =
          email &&
          (await NocoCache.get(
            `${CacheScope.USER}:${email}`,
            CacheGetType.TYPE_OBJECT
          ));
        if (!user) {
          user = await Noco.ncMeta.metaGet2(null, null, MetaTable.USERS, {
            email
          });
        }
        if (user.token_expired) {
          NcError.unauthorized('Token Expired. Please login again.');
        }
      }
      next();
    }),
    // @ts-ignore
    catchError(async function projectAclMiddleware(
      req: Request<any, any, any, any, any>,
      _res: Response,
      next: NextFunction
    ) {
      // if (req['files'] && req.body.json) {
      //   req.body = JSON.parse(req.body.json);
      // }
      // if (req['session']?.passport?.user?.isAuthorized) {
      //   if (
      //     req?.body?.project_id &&
      //     !req['session']?.passport?.user?.isPublicBase &&
      //     !(await this.xcMeta.isUserHaveAccessToProject(
      //       req?.body?.project_id,
      //       req['session']?.passport?.user?.id
      //     ))
      //   ) {
      //     return res
      //       .status(403)
      //       .json({ msg: "User doesn't have project access" });
      //   }
      //
      //   if (req?.body?.api) {

      // todo : verify user have access to project or not

      const roles = req['session']?.passport?.user?.roles;
      const isAllowed =
        roles &&
        Object.entries(roles).some(([name, hasRole]) => {
          return (
            hasRole &&
            projectAcl[name] &&
            (projectAcl[name] === '*' || projectAcl[name][permissionName])
          );
        });
      if (!isAllowed) {
        NcError.forbidden(
          `${permissionName} - ${Object.keys(roles).filter(
            k => roles[k]
          )} : Not allowed`
        );
      }
      //   }
      // }
      next();
    }),
    catchError(handlerFn)
  ];
}
