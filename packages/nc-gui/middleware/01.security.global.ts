export default defineNuxtRouteMiddleware(async (to) => {
  // avoid non-embeddable paths within an iframe
  if (self !== top) {
    // allow for shared base
    const embeddablePaths = ['/base/']
    const embedRegex = new RegExp(`^(${embeddablePaths.join('|')})`)
    if (embedRegex.test(to.path)) {
      return
    }

    // allow for shared views
    if (to.meta?.layout === 'shared-view') {
      return
    }

    // throw for all other pages
    throw createError({ statusCode: 403, message: 'Not allowed' })
  }
})
