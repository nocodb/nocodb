// All backend route prefixes that need body parsing and global middleware.
// Used by app.module.ts for middleware scoping and by GuiMiddleware exclusion.
// Each entry uses 'prefix/(*)' so NestJS matches /prefix and /prefix/anything
// without accidentally matching unrelated paths (e.g. 'p' matching '/profile').
export const backendRoutePrefixes = [
  'api/(.*)',
  'sso/(.*)',
  'auth/(.*)',
  'download/(.*)',
  'dl/(.*)',
  'dltemp/(.*)',
  'p/(.*)',
  'data/(.*)',
  'nc/(.*)',
  'internal/(.*)',
  'jobs/(.*)',
  '.well-known/(.*)',
  'row-color-(.*)',
];
