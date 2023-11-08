import * as express from 'express';
import { Express } from 'express-serve-static-core';
import type { UserType } from 'nocodb-sdk';
import { User } from '~/models';

// declare global {
//   namespace Express {
//     interface Request {
//       id?: string;
//       ncWorkspaceId?: string;
//       ncProjectId?: string;
//       user?: any;
//     }
//   }
// }
//
// interface TokenData {
//   userId: string;
//   iat: string;
// }
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
