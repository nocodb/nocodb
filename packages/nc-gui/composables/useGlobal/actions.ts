import { getActivePinia } from 'pinia'
import type { Actions, AppInfo, State } from './types'
import { type NcProjectType, message, useNuxtApp } from '#imports'
import { navigateTo } from '#app'

export function useGlobalActions(state: State): Actions {
  const setIsMobileMode = (isMobileMode: boolean) => {
    state.isMobileMode.value = isMobileMode
  }

  /** Sign out by deleting the token from localStorage */
  const signOut: Actions['signOut'] = async (_skipRedirect = false) => {
    try {
      const nuxtApp = useNuxtApp()
      await nuxtApp.$api.auth.signout()
    } catch {
    } finally {
      state.token.value = null
      state.user.value = null
      const pn = getActivePinia()
      if (pn) {
        pn._s.forEach((store) => {
          store.$dispose()
          delete pn.state.value[store.$id]
        })
      }
    }
  }

  /** Sign in by setting the token in localStorage */
  const signIn: Actions['signIn'] = async (newToken) => {
    state.token.value = newToken

    if (state.jwtPayload.value) {
      state.user.value = {
        id: state.jwtPayload.value.id,
        email: state.jwtPayload.value.email,
        firstname: state.jwtPayload.value.firstname,
        lastname: state.jwtPayload.value.lastname,
        roles: state.jwtPayload.value.roles,
      }
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
            signIn(response.data.token)
          }
        })
        .catch(async () => {
          if (state.token.value && state.user.value) {
            await signOut()
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

  const navigateToProject = ({
    workspaceId: _workspaceId,
    type: _type,
    projectId,
    query,
  }: {
    workspaceId?: string
    projectId?: string
    type?: NcProjectType
    query?: any
  }) => {
    const workspaceId = _workspaceId || 'nc'
    let path: string

    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''

    if (projectId) {
      path = `/${workspaceId}/${projectId}${queryParams}`
    } else {
      path = `/${workspaceId}${queryParams}`
    }

    navigateTo({
      path,
    })
  }

  const ncNavigateTo = ({
    workspaceId: _workspaceId,
    type: _type,
    projectId,
    query,
    tableId,
    viewId,
  }: {
    workspaceId?: string
    projectId?: string
    type?: NcProjectType
    query?: any
    tableId?: string
    viewId?: string
  }) => {
    const tablePath = tableId ? `/${tableId}${viewId ? `/${viewId}` : ''}` : ''
    const workspaceId = _workspaceId || 'nc'
    let path: string

    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''

    if (projectId) {
      path = `/${workspaceId}/${projectId}${tablePath}${queryParams}`
    } else {
      path = `/${workspaceId}${queryParams}`
    }

    navigateTo({
      path,
    })
  }

  const getBaseUrl = (workspaceId: string) => {
    if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
      return `https://${workspaceId}.${state.appInfo.value.baseHostName}`
    }
    return undefined
  }

  return { signIn, signOut, refreshToken, loadAppInfo, setIsMobileMode, navigateToProject, getBaseUrl, ncNavigateTo }
}
