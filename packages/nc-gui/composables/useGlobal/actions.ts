import { getActivePinia } from 'pinia'
import type { Actions, AppInfo, Getters, State } from './types'

export function useGlobalActions(state: State, _getters: Getters): Actions {
  const isTokenUpdatedTab = useState('isTokenUpdatedTab', () => false)

  const setIsMobileMode = (isMobileMode: boolean) => {
    state.isMobileMode.value = isMobileMode
  }

  /** Sign out by deleting the token from localStorage */
  const signOut: Actions['signOut'] = async ({
    redirectToSignin,
    signinUrl = '/signin',
    skipApiCall = false,
  }: SignOutParams = {}) => {
    try {
      // call and invalidate refresh token only if user manually triggered logout
      if (!skipApiCall) {
        const nuxtApp = useNuxtApp()
        await nuxtApp.$api.auth.signout()
      }
    } catch {
      // ignore error
    } finally {
      state.token.value = null
      state.user.value = null

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
  }

  /** Sign in by setting the token in localStorage
   * keepProps - is for keeping any existing role info if user id is same as previous user
   * */
  const signIn: Actions['signIn'] = (newToken, keepProps = false) => {
    isTokenUpdatedTab.value = true
    state.token.value = newToken

    if (state.jwtPayload.value) {
      state.user.value = {
        ...(keepProps && state.user.value?.id === state.jwtPayload.value.id ? state.user.value || {} : {}),
        id: state.jwtPayload.value.id,
        email: state.jwtPayload.value.email,
        firstname: state.jwtPayload.value.firstname,
        lastname: state.jwtPayload.value.lastname,
        roles: state.jwtPayload.value.roles,
        display_name: state.jwtPayload.value.display_name,
      }
    }
  }

  /** manually try to refresh token */
  const _refreshToken = async ({
    axiosInstance,
    skipSignOut = false,
  }: {
    axiosInstance?: any
    skipSignOut?: boolean
  } = {}) => {
    const nuxtApp = useNuxtApp()
    const t = nuxtApp.vueApp.i18n.global.t

    if (!axiosInstance) {
      axiosInstance = nuxtApp.$api?.instance
    }

    try {
      const response = await axiosInstance.post('/auth/token/refresh', null, {
        withCredentials: true,
      })
      if (response.data?.token) {
        signIn(response.data.token, true)
        return response.data.token
      }
      return null
    } catch (e) {
      if (state.token.value && state.user.value && !skipSignOut) {
        await signOut({
          skipApiCall: true,
        })
        message.error(t('msg.error.youHaveBeenSignedOut'))
      }
      return null
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

  const navigateToProject = ({
    workspaceId: _workspaceId,
    type: _type,
    baseId,
    query,
  }: {
    workspaceId?: string
    baseId?: string
    query?: any
  }) => {
    const workspaceId = _workspaceId || 'nc'
    let path: string

    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''

    if (baseId) {
      path = `/${workspaceId}/${baseId}${queryParams}`
    } else {
      path = `/${workspaceId}${queryParams}`
    }

    navigateTo({
      path,
    })
  }

  const ncNavigateTo = ({
    workspaceId: _workspaceId,
    baseId,
    query,
    tableId,
    viewId,
    replace,
  }: {
    workspaceId?: string
    baseId?: string
    query?: any
    tableId?: string
    viewId?: string
    replace?: boolean
  }) => {
    const tablePath = tableId ? `/${tableId}${viewId ? `/${viewId}` : ''}` : ''
    const workspaceId = _workspaceId || 'nc'
    let path: string

    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''

    if (baseId) {
      path = `/${workspaceId}/${baseId}${tablePath}${queryParams}`
    } else {
      path = `/${workspaceId}${queryParams}`
    }

    return navigateTo({
      path,
      replace,
    })
  }

  const getBaseUrl = (workspaceId: string) => {
    // if baseUrl is set in appInfo, use it
    if (state.appInfo.value.baseUrl) {
      return state.appInfo.value.baseUrl
    }

    if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
      return `https://${workspaceId}.${state.appInfo.value.baseHostName}`
    }
    return undefined
  }

  const getMainUrl = () => {
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
