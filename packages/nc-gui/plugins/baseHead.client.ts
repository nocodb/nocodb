/**
 * Under a subpath deployment, prefixes root-absolute `<link href>` values from
 * `app.head` (favicon, manifest, touch icon) with the base. The backend rewrites
 * them in the served shell, but the client re-renders them from the build config.
 */
export default defineNuxtPlugin(() => {
  const base = ncAppBasePath()
  if (!base) return

  injectHead().hooks.hook('tags:resolve', ({ tags }) => {
    for (const tag of tags) {
      const href = tag.tag === 'link' ? tag.props?.href : undefined
      if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.startsWith(`${base}/`)) {
        tag.props.href = `${base}${href}`
      }
    }
  })
})
