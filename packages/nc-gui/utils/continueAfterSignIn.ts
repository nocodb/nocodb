const isFullUrl = (url: string) => {
  return /^(https?:)?\/\//.test(url)
}

/** Only allow same-origin relative paths (e.g. /request-base-access?base=...). */
export const isSafeContinuePath = (url: string) => {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed.startsWith('/')) return false
  if (trimmed.startsWith('//')) return false
  if (isFullUrl(trimmed)) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false
  return true
}
