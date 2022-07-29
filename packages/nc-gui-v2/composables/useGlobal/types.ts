import type { ComputedRef, Ref, ToRefs } from 'vue'
import type { WritableComputedRef } from '@vue/reactivity'
import type { JwtPayload } from 'jwt-decode'
import type { User } from '~/lib'

export interface StoredState {
  token: string | null
  user: User | null
  lang: string
  darkMode: boolean
}

export type State = ToRefs<StoredState> & {
  token: WritableComputedRef<string | null>
  jwtPayload: ComputedRef<(JwtPayload & User) | null>
  sidebarOpen: Ref<boolean>
  timestamp: Ref<number>
  isLoading: Ref<boolean>
}

export interface Getters {
  signedIn: ComputedRef<boolean>
}

export interface Actions {
  signOut: () => void
  signIn: (token: string) => void
}

export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

export type GlobalState = Getters & Actions & ReadonlyState
