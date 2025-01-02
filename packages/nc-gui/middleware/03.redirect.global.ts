export default defineNuxtRouteMiddleware(async () => {
  // get query params
  const params = new URLSearchParams(window.location.search)
  // get redirect query param
  const redirect = params.get('redirect')
  // if redirect query param is set
  if (redirect) {
    // redirect to the value of the redirect query param
    window.location.href = redirect
  }
})
