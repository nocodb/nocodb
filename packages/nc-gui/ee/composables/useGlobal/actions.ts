import type { Actions, AppInfo, State } from '~/composables/useGlobal/types'
import { NcProjectType, message, useNuxtApp } from '#imports'
import { navigateTo } from '#app'

export function useGlobalActions(state: State): Actions {
  const setIsMobileMode = (isMobileMode: boolean) => {
    state.isMobileMode.value = isMobileMode
  }

  /** Sign out by deleting the token from localStorage */
  const signOut: Actions['signOut'] = async () => {
    let signoutRes
    try {
      const nuxtApp = useNuxtApp()
      signoutRes = await nuxtApp.$api.auth.signout()
    } catch {
    } finally {
      state.token.value = null
      state.user.value = null
      // todo: update type in swagger.json
      if ((signoutRes as any).redirect_url) {
        location.href = (signoutRes as any).redirect_url
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

  // todo: remove and use navigateToProject
  const navigateToProject = ({
    workspaceId: _workspaceId,
    type,
    projectId,
    query,
  }: {
    workspaceId?: string
    projectId?: string
    type?: NcProjectType
    query?: any
  }) => {
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''
    const workspaceId = _workspaceId || 'app'
    let path: string
    if (projectId) {
      switch (type) {
        case NcProjectType.DOCS:
          path = `/${workspaceId}/${projectId}/doc${queryParams}`
          break
        default:
          path = `/${workspaceId}/${projectId}${queryParams}`
          break
      }
    } else {
      path = _workspaceId ? `/${workspaceId}${queryParams}` : `/${queryParams}`
    }

    if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
      location.href = `https://${workspaceId}.${state.appInfo.value.baseHostName}/dashboard/#${path}`
    } else {
      navigateTo(path)
    }
  }

  const ncNavigateTo = ({
    workspaceId: _workspaceId,
    type,
    projectId,
    tableId,
    viewId,
    query,
  }: {
    workspaceId?: string
    projectId?: string
    type?: NcProjectType
    tableId?: string
    viewId?: string
    query?: string
  }) => {
    const tablePath = tableId ? `/table/${tableId}${viewId ? `/${viewId}` : ''}` : ''
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''
    const workspaceId = _workspaceId || 'app'
    let path: string
    if (projectId)
      switch (type) {
        case NcProjectType.DOCS:
          path = `/${workspaceId}/${projectId}/doc${queryParams}`
          break
        default:
          path = `/${workspaceId}/${projectId}${tablePath}${queryParams}`
          break
      }
    else {
      path = _workspaceId ? `/${workspaceId}${queryParams}` : `/${queryParams}`
    }

    if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
      location.href = `https://${workspaceId}.${state.appInfo.value.baseHostName}/dashboard/#${path}`
    } else {
      navigateTo(path)
    }
  }

  const getBaseUrl = (workspaceId: string) => {
    if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
      return `https://${workspaceId}.${state.appInfo.value.baseHostName}`
    }
    return undefined
  }

  return { signIn, signOut, refreshToken, loadAppInfo, setIsMobileMode, navigateToProject, getBaseUrl, ncNavigateTo }
}
