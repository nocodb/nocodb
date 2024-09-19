import { getActivePinia } from 'pinia'
import { Auth } from 'aws-amplify'
import type { Actions, AppInfo, SignOutParams, State } from '../../../composables/useGlobal/types'
import { NcProjectType } from '#imports'

export interface ActionsEE {
  getMainUrl: () => string | undefined
  checkForCognitoToken: (params?: { skipRedirect?: boolean }) => Promise<void>
}

export function useGlobalActions(state: State): Actions & ActionsEE {
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
  const signIn: Actions['signIn'] = async (newToken, keepProps = false) => {
    isTokenUpdatedTab.value = true;
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

  let tokenGenerationProgress: Promise<any> | null = null
  let resolveTokenGenerationProgress: (value: any) => void = null

  const checkForCognitoToken = async () => {
    if (tokenGenerationProgress) {
      await tokenGenerationProgress
    }
    tokenGenerationProgress = new Promise((resolve) => {
      resolveTokenGenerationProgress = resolve
    })

    if (state.token.value) {
      resolveTokenGenerationProgress(true)
      tokenGenerationProgress = null
      return
    }

    try {
      const cognitoUserSession = await Auth.currentSession()
      const idToken = cognitoUserSession.getIdToken()
      const jwt = idToken.getJwtToken()

      const nuxtApp = useNuxtApp()

      const tokenRes = await nuxtApp.$api.instance.post(
        '/auth/cognito',
        {},
        {
          headers: {
            'xc-cognito': jwt,
          },
        },
      )
      if ((await tokenRes).data.token) {
        updateFirstTimeUser()
        await signIn((await tokenRes).data.token)
      }
    } catch (err) {
    } finally {
      tokenGenerationProgress = null
      resolveTokenGenerationProgress(true)
    }
  }

  /** manually try to refresh token */
  const refreshToken = async () => {
    const nuxtApp = useNuxtApp()
    const t = nuxtApp.vueApp.i18n.global.t

    return new Promise((resolve) => {
      nuxtApp.$api.instance
        .post('/auth/token/refresh', null, {
          withCredentials: true,
        })
        .then((response) => {
          if (response.data?.token) {
            signIn(response.data.token, true)
          }
        })
        .catch(async () => {
          if (isAmplifyConfigured.value) {
            await checkForCognitoToken()
          } else if (state.token.value && state.user.value) {
            await signOut({
              skipApiCall: true,
            })
            message.error(t('msg.error.youHaveBeenSignedOut'))
          }
        })
        .finally(() => resolve(true))
    })
  }

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
    type,
    baseId,
    query,
  }: {
    workspaceId?: string
    baseId?: string
    type?: NcProjectType
    query?: any
  }) => {
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''
    const workspaceId = _workspaceId || 'app'
    let path: string
    if (baseId) {
      switch (type) {
        case NcProjectType.DOCS:
          path = `/${workspaceId}/${baseId}/doc${queryParams}`
          break
        default:
          path = `/${workspaceId}/${baseId}${queryParams}`
          break
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

  const ncNavigateTo = ({
    workspaceId: _workspaceId,
    type,
    baseId,
    tableId,
    viewId,
    query,
  }: {
    workspaceId?: string
    baseId?: string
    type?: NcProjectType
    tableId?: string
    viewId?: string
    query?: string
  }) => {
    const tablePath = tableId ? `/${tableId}${viewId ? `/${viewId}` : ''}` : ''
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''
    const workspaceId = _workspaceId || 'app'
    let path: string
    if (baseId)
      switch (type) {
        case NcProjectType.DOCS:
          path = `/${workspaceId}/${baseId}/doc${queryParams}`
          break
        default:
          path = `/${workspaceId}/${baseId}${tablePath}${queryParams}`
          break
      }
    else {
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
      !['base', 'nc', 'view', 'erd', 'doc', 'api', 'app'].includes(workspaceId) &&
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
    checkForCognitoToken,
    setGridViewPageSize,
    setLeftSidebarSize,
    setAddNewRecordGridMode,
    updateSyncDataUpvotes,
  }
}
