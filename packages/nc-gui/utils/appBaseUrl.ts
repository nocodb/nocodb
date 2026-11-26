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

/**
 * Resolves a backend path against the site URL, keeping its subpath:
 * `resolveSiteUrl('https://h/nocodb', 'dltemp/a')` → `https://h/nocodb/dltemp/a`.
 * Absolute and protocol-relative URLs are returned resolved as-is.
 */
export const resolveSiteUrl = (siteUrl: string | null | undefined, path: string): string => {
  const base = new URL(siteUrl || '/', window.location.origin)
  if (!base.pathname.endsWith('/')) base.pathname += '/'
  const relative = /^[a-z][a-z\d+.-]*:|^\/\//i.test(path) ? path : path.replace(/^\/+/, '')
  return new URL(relative, base).toString()
}
