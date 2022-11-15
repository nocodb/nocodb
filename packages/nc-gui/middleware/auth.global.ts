import type { Api } from 'nocodb-sdk'
import type { Actions } from '~/composables/useGlobal/types'
import { defineNuxtRouteMiddleware, message, navigateTo, useApi, useGlobal, useRoles } from '#imports'

/**
 * Global auth middleware
 *
 * On page transitions, this middleware checks if the target route requires authentication.
 * If the user is not signed in, the user is redirected to the sign in page.
 * If the user is signed in and attempts to access a route that does not require authentication (i.e. signin/signup pages),
 * the user is redirected to the home page.
 *
 * By default, we assume that auth is required
 * If not required, mark the page as requiresAuth: false
 *
 * @example
 * ```
 * definePageMeta({
 *   requiresAuth: false
 * })
 * ```
 *
 * If auth should be circumvented completely mark the page as public
 *
 * @example
 * ```
 * definePageMeta({
 *   public: true
 * })
 * ```
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  const state = useGlobal()

  const { api } = useApi({ useGlobalInstance: true })

  const { allRoles } = useRoles()

  /** if user isn't signed in and google auth is enabled, try to check if sign-in data is present */
  if (!state.signedIn.value && state.appInfo.value.googleAuthEnabled) await tryGoogleAuth(api, state.signIn)

  /** if public allow all visitors */
  if (to.meta.public) return

  /** if shared base allow without validating */
  if (to.params.projectType === 'base') return

  /** if auth is required or unspecified (same as required) and user is not signed in, redirect to signin page */
  if ((to.meta.requiresAuth || typeof to.meta.requiresAuth === 'undefined') && !state.signedIn.value) {
    /** If this is the first usern navigate to signup page directly */
    if (state.appInfo.value.firstUser) {
      return navigateTo('/signup')
    }

    return navigateTo('/signin')
  } else if (to.meta.requiresAuth === false && state.signedIn.value) {
    /**
     * if user was turned away from non-auth page but also came from a non-auth page (e.g. user went to /signin and reloaded the page)
     * redirect to home page
     *
     * else redirect back to the page they were coming from
     */
    if (from.meta.requiresAuth === false) {
      return navigateTo('/')
    } else {
      return navigateTo(from.path)
    }
  } else {
    /** If page is limited to certain users verify the user have the roles */
    if (to.meta.allowedRoles && to.meta.allowedRoles.every((role) => !allRoles.value[role])) {
      message.error("You don't have enough permission to access the page.")
      return navigateTo('/')
    }

    /** if users are accessing the projects without having enough permissions, redirect to My Projects page */
    if (to.params.projectId && from.params.projectId !== to.params.projectId) {
      const user = await api.auth.me({ project_id: to.params.projectId as string })

      if (user?.roles?.user) {
        message.error("You don't have enough permission to access the project.")

        return navigateTo('/')
      }
    }
  }
})

/**
 * If present, try using google auth data to sign user in before navigating to the next page
 */
async function tryGoogleAuth(api: Api<any>, signIn: Actions['signIn']) {
  if (window.location.search && /\bscope=|\bstate=/.test(window.location.search) && /\bcode=/.test(window.location.search)) {
    try {
      const {
        data: { token },
      } = await api.instance.post(
        `/auth/${window.location.search.includes('state=github') ? 'github' : 'google'}/genTokenByCode${window.location.search}`,
      )

      signIn(token)
    } catch (e: any) {
      if (e.response && e.response.data && e.response.data.msg) {
        message.error({ content: e.response.data.msg })
      }
    }

    const newURL = window.location.href.split('?')[0]
    window.history.pushState('object', document.title, newURL)
  }
}
