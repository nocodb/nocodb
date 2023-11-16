import type { UserType } from 'nocodb-sdk';
declare module 'express-serve-static-core' {
  interface Request {
    ncWorkspaceId?: string;
    ncProjectId?: string;
    user: UserType & {
      base_roles?: Record<string, boolean>;
      workspace_roles?: Record<string, boolean>;
      provider?: string;
    };
    ncSiteUrl: string;
    clientIp: string;
  }
}
