/**
 * Returns an object with methods to manage the last visited base.
 *
 * @returns An object containing:
 *   - `key`: The key used for storage.
 *   - `get`: A function to retrieve the last visited base.
 *   - `set`: A function to set the last visited base.
 *
 * @example
 * ```typescript
 * const lastVisitedBase = ncLastVisitedBase();
 * lastVisitedBase.set('my-base');
 * const lastVisited = lastVisitedBase.get();
 * console.log(lastVisited); // Output: 'my-base'
 * ```
 */
export const ncBackRoute = (): {
  get: () => string
  set: (value: string) => void
} => {
  const key = 'ncBackRoute'

  return {
    get: () => {
      return sessionStorage.getItem(key) || '/'
    },
    set: (value: string) => {
      if (!value) {
        sessionStorage.removeItem(key)
        return
      }

      sessionStorage.setItem(key, value)
    },
  }
}

export const ncLastVisitedBase = (): {
  key: string
  get: () => string | null
  set: (value: string | null | undefined) => void
} => {
  const key = 'ncLastVisitedBase'

  return {
    key,
    get: () => {
      return localStorage.getItem(key)
    },
    set: (value: string | null | undefined) => {
      if (!value) return

      localStorage.setItem(key, value)
    },
  }
}

const LAST_VISITED_COOKIE_MAX_AGE = 90 * 24 * 60 * 60

/**
 * Root domain for cookies shared with sibling sites: `baseHostName`, else `ncSiteUrl`'s host minus its
 * first label (`app.nocodb.com` → `nocodb.com`). The fallback is cloud-only so self-hosted installs
 * never write to their parent domain.
 */
const getCookieRootDomain = (appInfo: { baseHostName?: string; ncSiteUrl?: string; isCloud?: boolean }) => {
  if (appInfo.baseHostName) return appInfo.baseHostName
  if (!appInfo.isCloud || !appInfo.ncSiteUrl) return

  try {
    const labels = new URL(appInfo.ncSiteUrl).hostname.split('.')
    return labels.length > 2 ? labels.slice(1).join('.') : labels.join('.')
  } catch {
    return undefined
  }
}

/**
 * Last visited workspace/base ids in cookies on the root domain, so sibling sites like
 * docs.nocodb.com can read them.
 */
export const ncLastVisitedCookie = (appInfo: {
  baseHostName?: string
  ncSiteUrl?: string
  isCloud?: boolean
}): {
  setWorkspace: (value: string | null | undefined) => void
  setBase: (value: string | null | undefined) => void
  clear: () => void
} => {
  const rootDomain = getCookieRootDomain(appInfo)

  const write = (name: string, value: string, maxAge: number) => {
    if (!rootDomain || typeof document === 'undefined') return

    const secure = location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${name}=${encodeURIComponent(
      value,
    )}; domain=.${rootDomain}; path=/; max-age=${maxAge}; samesite=lax${secure}`
  }

  return {
    setWorkspace: (value) => {
      if (value) write('nc_last_workspace_id', value, LAST_VISITED_COOKIE_MAX_AGE)
    },
    setBase: (value) => {
      if (value) write('nc_last_base_id', value, LAST_VISITED_COOKIE_MAX_AGE)
    },
    clear: () => {
      write('nc_last_workspace_id', '', 0)
      write('nc_last_base_id', '', 0)
    },
  }
}
