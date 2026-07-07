import type { UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
declare module 'express-serve-static-core' {
  interface Request {
    context: NcContext;
    ncWorkspaceId?: string;
    // @Acl scope of the matched route; gates the default-workspace fallback
    ncAclScope?: string;
    ncBaseId?: string;
    user: UserType & {
      base_roles?: Record<string, boolean>;
      workspace_roles?: Record<string, boolean>;
      provider?: string;
      direct_teams?: { team_id: string; path: string }[];
    };
    ncSiteUrl: string;
    clientIp: string;
    dashboardUrl: string;
    // Set by AppOriginMiddleware when the request Host is an app origin
    // (`<slug>.<NC_APPS_BASE_DOMAIN>`). Carries the resolved app identity so the
    // invoke/auth controller (B-3 / C-2) never reads it from request input.
    ncAppOrigin?: {
      slug: string;
      appId: string;
      baseId: string;
      fkWorkspaceId: string;
    };
  }
}
