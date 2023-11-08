import * as express from 'express';
import { Express } from 'express-serve-static-core';

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
    // id?: string;
    // ncWorkspaceId?: string;
    // ncProjectId?: string;
    user: any;
  }
}
