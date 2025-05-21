import { getActivePinia } from 'pinia'
import { Auth } from 'aws-amplify'
import type { AxiosInstance } from 'axios'
import type { Actions, AppInfo, Getters, SignOutParams, State } from '../../../composables/useGlobal/types'

export interface ActionsEE {
  getMainUrl: () => string | undefined
  checkForCognitoToken: (params?: { skipRedirect?: boolean }) => Promise<void>
}

export function useGlobalActions(state: State, getters: Getters): Actions & ActionsEE {
  const isTokenUpdatedTab = useState('isTokenUpdatedTab', () => false)

  const setIsMobileMode = (isMobileMode: boolean) => {
    state.isMobileMode.value = isMobileMode
  }

  // todo: move to pinia/global state
  const isAmplifyConfigured = useState('is-amplify-configured', () => false)

  /** Sign out by deleting the token from localStorage */
  const signOut: Actions['signOut'] = async ({
    redirectToSignin,
    signinUrl = '/signin',
    skipRedirect = true,
    skipApiCall = false,
  }: SignOutParams = {}) => {
    let signoutRes
    const nuxtApp = useNuxtApp()
    try {
      // call and invalidate refresh token only if user manually triggered logout
      if (!skipApiCall) {
        // invalidate token and refresh token on server
        signoutRes = await nuxtApp.$api.auth.signout()
      }
    } catch {
      // ignore error
    } finally {
      // clear token and user data
      state.token.value = null
      state.user.value = null
    }

    // clear amplify session if configured
    try {
      if (isAmplifyConfigured.value) await Auth.signOut()
    } catch {
      // ignore error
    }

    // todo: update type in swagger.json
    if (!skipRedirect && (signoutRes as any).redirect_url) {
      location.href = (signoutRes as any).redirect_url
    }

    if (redirectToSignin) {
      await navigateTo(signinUrl)
    }

    // clear all stores data on logout
    const pn = getActivePinia()
    if (pn) {
      pn._s.forEach((store) => {
        store.$dispose()
        delete pn.state.value[store.$id]
      })
    }
  }

  /** Sign in by setting the token in localStorage
   * keepProps - is for keeping any existing role info if user id is same as previous user
   */
  const signIn: Actions['signIn'] = (newToken, keepProps = false) => {
    isTokenUpdatedTab.value = true
    state.token.value = newToken

    if (state.jwtPayload.value) {
      state.user.value = {
        id: state.jwtPayload.value.id,
        ...(keepProps && state.user.value?.id === state.jwtPayload.value.id ? state.user.value || {} : {}),
        email: state.jwtPayload.value.email,
        firstname: state.jwtPayload.value.firstname,
        lastname: state.jwtPayload.value.lastname,
        roles: state.jwtPayload.value.roles,
      }
    }
  }

  const checkForCognitoToken = async ({
    axiosInstance,
  }: {
    axiosInstance?: any
    skipSignOut?: boolean
  } = {}) => {
    if (state.token.value && getters.signedIn.value) {
      return
    }

    try {
      const cognitoUserSession = await Auth.currentSession()
      const idToken = cognitoUserSession.getIdToken()
      const jwt = idToken.getJwtToken()

      const nuxtApp = useNuxtApp()

      if (!axiosInstance) {
        axiosInstance = nuxtApp.$api?.instance
      }

      const tokenRes = await axiosInstance.post(
        '/auth/cognito',
        {},
        {
          headers: {
            'xc-cognito': jwt,
          },
        },
      )
      if (tokenRes.data.token) {
        updateFirstTimeUser()
        const token = tokenRes.data.token
        await signIn(token)
        return token
      }
    } catch (err) {}
  }

  /** manually try to refresh token */
  const _refreshToken = async ({
    axiosInstance,
    cognitoOnly = false,
  }: {
    axiosInstance?: AxiosInstance
    skipSignOut?: boolean
    cognitoOnly?: boolean
  } = {}) => {
    const nuxtApp = useNuxtApp()
    const t = nuxtApp.vueApp.i18n.global.t

    if (!axiosInstance) {
      const nuxtApp = useNuxtApp()
      axiosInstance = nuxtApp.$api?.instance
    }

    try {
      if (cognitoOnly) {
        return await checkForCognitoToken({
          axiosInstance,
        })
      }

      const response = await axiosInstance.post('/auth/token/refresh', null, {
        withCredentials: true,
      })

      if (response.data?.token) {
        signIn(response.data.token, true)
        return response.data.token
      }
    } catch (e) {
      // if error occurs, check cognito and generate token or signout
      if (isAmplifyConfigured.value) {
        // reset token value to null since cognito token is not valid
        state.token.value = null
        return await checkForCognitoToken({
          axiosInstance,
        })
      } else if (state.token.value && state.user.value) {
        await signOut({
          skipApiCall: true,
        })
        message.error(t('msg.error.youHaveBeenSignedOut'))
      }
    }
  }

  const refreshToken = useSharedExecutionFn('refreshToken', _refreshToken, {
    timeout: 10000,
    storageDelay: 1000,
  })

  const loadAppInfo = async () => {
    try {
      const nuxtApp = useNuxtApp()
      state.appInfo.value = (await nuxtApp.$api.utils.appInfo()) as AppInfo
    } catch (e) {
      console.error(e)
    }
  }

  // todo: remove and use navigateToProject
  const navigateToProject = ({
    workspaceId: _workspaceId,
    baseId,
    query,
  }: {
    workspaceId?: string
    baseId?: string
    query?: any
  }) => {
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''
    const workspaceId = _workspaceId || 'app'
    let path: string
    if (baseId) {
      path = `/${workspaceId}/${baseId}${queryParams}`
    } else {
      path = _workspaceId ? `/${workspaceId}${queryParams}` : `/${queryParams}`
    }

    // if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
    //   location.href = `https://${workspaceId}.${state.appInfo.value.baseHostName}${state.appInfo.value.dashboardPath}#${path}`
    // } else {
    navigateTo(path)
    // }
  }

  const ncNavigateTo = ({
    workspaceId: _workspaceId,
    baseId,
    tableId,
    viewId,
    query,
    automation,
    automationId,
  }: {
    workspaceId?: string
    baseId?: string
    tableId?: string
    viewId?: string
    automationId?: string
    automation?: boolean
    query?: string
  }) => {
    const tablePath = tableId ? `/${tableId}${viewId ? `/${viewId}` : ''}` : ''
    const automationPath = automation ? `/automations/${automationId ?? ''}` : ''
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''
    const workspaceId = _workspaceId || 'app'

    let path: string
    if (baseId) {
      if (automation) {
        path = `/${workspaceId}/${baseId}${automationPath}${queryParams}`
      } else {
        path = `/${workspaceId}/${baseId}${tablePath}${queryParams}`
      }
    } else {
      path = _workspaceId ? `/${workspaceId}${queryParams}` : `/${queryParams}`
    }

    // if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
    //   location.href = `https://${workspaceId}.${state.appInfo.value.baseHostName}${state.appInfo.value.dashboardPath}#${path}`
    // } else {
    navigateTo(path)
    // }
  }

  const getBaseUrl = (workspaceId: string) => {
    if (
      !['base', 'nc', 'view'].includes(workspaceId) &&
      state.appInfo.value.baseHostName &&
      location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`
    ) {
      return `https://${workspaceId}.${state.appInfo.value.baseHostName}`
    }
    return undefined
  }

  // get the base url of the app id base subdomain is used
  // eg: https://app.nocodb.com
  const getMainUrl = () => {
    if (state.appInfo.value.mainSubDomain && state.appInfo.value.baseHostName) {
      return `https://${state.appInfo.value.mainSubDomain}.${state.appInfo.value.baseHostName}`
    }
    return undefined
  }

  const setGridViewPageSize = (pageSize: number) => {
    state.gridViewPageSize.value = pageSize
  }

  const setLeftSidebarSize = ({ old, current }: { old?: number; current?: number }) => {
    state.leftSidebarSize.value = {
      old: old ?? state.leftSidebarSize.value.old,
      current: current ?? state.leftSidebarSize.value.current,
    }
  }

  const setAddNewRecordGridMode = (isGridMode: boolean) => {
    state.isAddNewRecordGridMode.value = isGridMode
  }

  const updateSyncDataUpvotes = (upvotes: string[]) => {
    state.syncDataUpvotes.value = upvotes
  }

  return {
    signIn,
    signOut,
    refreshToken,
    loadAppInfo,
    setIsMobileMode,
    navigateToProject,
    getBaseUrl,
    ncNavigateTo,
    getMainUrl,
    setGridViewPageSize,
    setLeftSidebarSize,
    setAddNewRecordGridMode,
    updateSyncDataUpvotes,
  }
}
