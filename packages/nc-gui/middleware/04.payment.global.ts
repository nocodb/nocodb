export default defineNuxtRouteMiddleware((to) => {
  // Use to.query (the incoming route) instead of window.location.search.
  // During client-side navigateTo(), window.location hasn't updated yet
  // when middleware runs for the new route, causing stale param reads and loops.
  const query = to.query

  const afterPayment = query.afterPayment
  const afterManage = query.afterManage
  const afterUpgrade = query.afterUpgrade

  const upgrade = query.upgrade

  const pricing = query.pricing

  if (upgrade) {
    const { upgrade: _, ...rest } = query
    return navigateTo({ path: '/upgrade', query: rest })
  }

  if (pricing) {
    const workspaceId = query.workspaceId as string
    if (!workspaceId) return

    const { pricing: _, workspaceId: __, ...rest } = query
    return navigateTo({ path: `/${workspaceId}/pricing`, query: rest })
  }

  if (afterPayment || afterManage || afterUpgrade) {
    const workspaceId = query.workspaceId as string
    const returnToPage = query.returnToPage as string

    let targetPath = ''

    if (returnToPage === 'self_hosted') {
      targetPath = '/account/self-hosted'
    } else if (!workspaceId) {
      // Non-self-hosted paths require a workspaceId.
      // If missing, we're already on the correct page.
      return
    } else if (returnToPage === 'org') {
      targetPath = `/admin/${workspaceId}/billing`
    } else if (returnToPage === 'account') {
      targetPath = `/account/workspace/${workspaceId}/settings`
    } else {
      targetPath = `/${workspaceId}/billing`
    }

    // Only redirect if we're not already on the target path (prevents loop).
    if (to.path === targetPath) return

    return navigateTo({ path: targetPath, query })
  }
})
