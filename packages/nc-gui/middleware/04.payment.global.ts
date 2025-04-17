export default defineNuxtRouteMiddleware(() => {
  const params = new URLSearchParams(window.location.search)
  const afterPayment = params.get('afterPayment')
  const afterManage = params.get('afterManage')

  const upgrade = params.get('upgrade')

  if (upgrade) {
    const url = `/#/upgrade?${params.toString()}`

    window.location.href = url

    return
  }

  if (afterPayment || afterManage) {
    const workspaceId = params.get('workspaceId')
    const isAccountPage = params.get('isAccountPage') === 'true'

    const url = isAccountPage
      ? `/#/account/workspace/${workspaceId}/settings?${params.toString()}`
      : `/#/${workspaceId}/settings?tab=billing&${params.toString()}`

    window.location.href = url
  }
})
