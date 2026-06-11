import type { UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
declare module 'express-serve-static-core' {
  interface Request {
    context: NcContext;
    ncWorkspaceId?: string;
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
  }
}
