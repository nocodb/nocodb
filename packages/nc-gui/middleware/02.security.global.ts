export default defineNuxtRouteMiddleware(async (to) => {
  // avoid non-embeddable paths within an iframe
  if (self !== top) {
    // A legacy hash-fragment embed (`/dashboard/#/nc/view/<uuid>`) arrives with
    // the share route in the fragment, so `to.path` is still the bare shell.
    // plugins/hashRedirect.client.ts rewrites those, but it races this guard —
    // whichever wins, the destination is the same share route, so resolve it
    // here rather than 403-ing the intermediate shell. This guard then re-runs
    // on the resulting navigation and applies the checks below to it.
    const legacyHashRoute = extractLegacyHashRoute()
    if (legacyHashRoute && legacyHashRoute !== to.fullPath) {
      return navigateTo(legacyHashRoute, { replace: true })
    }

    // allow for shared base
    if (to.path.startsWith('/base/')) {
      return
    }

    // allow for shared docs (public reader uses /doc/<uuid> without
    // shared-view layout meta — embed previews would otherwise be blocked).
    if (to.path.startsWith('/doc/')) {
      return
    }

    // allow for shared views based on page layout
    if (to.meta?.layout === 'shared-view') {
      return
    }

    // allow for shared views based on pageType meta prop
    if (to.meta?.pageType === 'shared-view') {
      return
    }

    // throw for all other pages
    throw createError({ statusCode: 403, message: 'Not allowed' })
  }
})
