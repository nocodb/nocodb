/**
 * Path prefix the app is served under, without a trailing slash: `''` at the
 * root, `/nocodb` for a subpath deployment. The backend sets it in the shell's
 * runtime config, which is also what the router and asset loader use.
 */
export const ncAppBasePath = (): string => {
  const baseURL: unknown = typeof window === 'undefined' ? '/' : window.__NUXT__?.config?.app?.baseURL
  return typeof baseURL === 'string' ? baseURL.replace(/\/+$/, '') : ''
}

/** Absolute URL of an app route, e.g. `ncAppUrl('/invite/x')`. */
export const ncAppUrl = (path = ''): string => {
  const normalized = path && !path.startsWith('/') && !path.startsWith('#') ? `/${path}` : path
  return `${window.location.origin}${ncAppBasePath()}${normalized}`
}
