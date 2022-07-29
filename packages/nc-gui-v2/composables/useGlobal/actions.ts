import { notification } from 'ant-design-vue'
import type { UseGlobalStateReturn } from './state'
import type { Actions } from '~/lib'
import { useNuxtApp } from '#imports'

export function useGlobalActions(state: UseGlobalStateReturn) {
  const { $api } = useNuxtApp()

  /** Actions */
  /** Sign out by deleting the token from localStorage */
  const signOut: Actions['signOut'] = () => {
    state.token.value = null
    state.user.value = null
  }

  /** Sign in by setting the token in localStorage */
  const signIn: Actions['signIn'] = async (newToken) => {
    state.token.value = newToken

    if (state.payload.value) {
      state.user.value = {
        id: state.payload.value.id,
        email: state.payload.value.email,
        firstname: state.payload.value.firstname,
        lastname: state.payload.value.lastname,
        roles: state.payload.value.roles,
      }
    }
  }

  /** manually try to refresh token */
  const refreshToken = async () => {
    $api.instance
      .post('/auth/refresh-token', null, {
        withCredentials: true,
      })
      .then((response) => {
        if (response.data?.token) {
          signIn(response.data.token)
        }
      })
      .catch((err) => {
        notification.error({
          // todo: add translation
          message: err.message || 'You have been signed out.',
        })
        console.error(err)

        signOut()
      })
  }

  return { signIn, signOut, refreshToken }
}
