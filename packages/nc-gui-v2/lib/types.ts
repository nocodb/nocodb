import type { ComputedRef, ToRefs } from 'vue'

export interface User {
  email: string
}

export interface State {
  token: string | null
  user: User | null
  lang: string
  darkMode: boolean
}

export interface Getters {
  signedIn: ComputedRef<boolean>
}

export interface Actions {
  signOut: () => void
}

export type GlobalState = Getters & Actions & ToRefs<State>
