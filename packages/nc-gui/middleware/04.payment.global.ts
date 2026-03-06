export default defineNuxtRouteMiddleware(() => {
  const params = new URLSearchParams(window.location.search)
  const afterPayment = params.get('afterPayment')
  const afterManage = params.get('afterManage')
  const afterUpgrade = params.get('afterUpgrade')

  const upgrade = params.get('upgrade')

  const pricing = params.get('pricing')

  if (upgrade) {
    const url = `/upgrade?${params.toString()}`

    window.location.href = url

    return
  }

  if (pricing) {
    const workspaceId = params.get('workspaceId')

    const searchParams = new URLSearchParams(params.toString())
    searchParams.delete('workspaceId')

    const url = `/${workspaceId}/pricing${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    window.location.href = url

    return
  }

  if (afterPayment || afterManage || afterUpgrade) {
    const workspaceId = params.get('workspaceId')
    const returnToPage = params.get('returnToPage')

    // If no workspaceId in query, we're already on the correct page
    // (e.g. updateSubscription navigates directly with workspace in path)
    if (!workspaceId) return

    let targetPath = ''

    if (returnToPage === 'org') {
      targetPath = `/admin/${workspaceId}/billing`
    } else if (returnToPage === 'account') {
      targetPath = `/account/workspace/${workspaceId}/settings`
    } else {
      targetPath = `/${workspaceId}/settings/ws-billing`
    }

    // Only redirect if we're not already on the target path (prevents loop)
    if (window.location.pathname === targetPath) return

    window.location.href = `${targetPath}?${params.toString()}`
  }
})
