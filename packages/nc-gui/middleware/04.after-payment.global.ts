export default defineNuxtRouteMiddleware(() => {
  // Get the query params from the URL
  const params = new URLSearchParams(window.location.search)
  const afterPayment = params.get('afterPayment')
  const afterManage = params.get('afterManage')

  if (afterPayment || afterManage) {
    const workspaceId = params.get('workspaceId')
    const isAccountPage = params.get('isAccountPage') === 'true'

    const url = isAccountPage
      ? `/#/account/workspace/${workspaceId}/settings?${params.toString()}`
      : `/#/${workspaceId}/settings?tab=billing&${params.toString()}`

    window.location.href = url
  }
})
