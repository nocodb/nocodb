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

export type State = ToRefs<Omit<StoredState, 'token'>> & {
  storage: Ref<StoredState>
  token: WritableComputedRef<StoredState['token']>
  jwtPayload: ComputedRef<(JwtPayload & User) | null>
  sidebarOpen: Ref<boolean>
  timestamp: Ref<number>
  runningRequests: Ref<number[]>
  error: Ref<any>
}

export interface Getters {
  signedIn: ComputedRef<boolean>
  isLoading: WritableComputedRef<boolean>
}

export interface Actions {
  signOut: () => void
  signIn: (token: string) => void
}

export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

export type UseGlobalReturn = Getters & Actions & ReadonlyState
