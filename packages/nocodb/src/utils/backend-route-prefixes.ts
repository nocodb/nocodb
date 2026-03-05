// Backend route prefixes — bare paths for Express app.use() prefix matching.
// Used by app.module.ts forRoutes() which registers via Express app.use(),
// where '/api' matches '/api', '/api/', '/api/v1/...' etc.
export const backendRoutePrefixes = [
  '/api',
  '/sso',
  '/auth',
  '/download',
  '/dl',
  '/dltemp',
  '/p',
  '/data',
  '/nc',
  '/internal',
  '/jobs',
  '/.well-known',
  '/row-color-',
];

// Same prefixes with path-to-regexp wildcard for NestJS .exclude() which
// uses pathToRegexp() matching (not Express prefix matching).
export const backendRouteExcludePatterns = backendRoutePrefixes.map(
  (p) => p + '/(.*)',
);
