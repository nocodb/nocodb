export default defineNuxtRouteMiddleware(() => {
  const params = new URLSearchParams(window.location.search)
  const afterPayment = params.get('afterPayment')
  const afterManage = params.get('afterManage')
  const afterUpgrade = params.get('afterUpgrade')

  const upgrade = params.get('upgrade')

  const pricing = params.get('pricing')

  if (upgrade) {
    const url = `/#/upgrade?${params.toString()}`

    window.location.href = url

    return
  }

  if (pricing) {
    const workspaceId = params.get('workspaceId')

    const url = `/#/${workspaceId}/pricing`

    window.location.href = url

    return
  }

  if (afterPayment || afterManage || afterUpgrade) {
    const workspaceId = params.get('workspaceId')
    const isAccountPage = params.get('isAccountPage') === 'true'

    const url = isAccountPage
      ? `/#/account/workspace/${workspaceId}/settings?${params.toString()}`
      : `/#/${workspaceId}/settings?tab=billing&${params.toString()}`

    window.location.href = url
  }
})
