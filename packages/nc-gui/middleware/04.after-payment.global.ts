export default defineNuxtRouteMiddleware(() => {
  // Get the query params from the URL
  const params = new URLSearchParams(window.location.search)
  const afterPayment = params.get('afterPayment')

  if (afterPayment) {
    const workspaceId = params.get('workspaceId')

    const url = `/#/account/workspace/${workspaceId}/settings?${params.toString()}`

    window.location.href = url
  }
})
