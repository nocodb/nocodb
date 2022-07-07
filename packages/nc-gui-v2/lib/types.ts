import type { ComputedRef, ToRefs } from 'vue'

export interface State {
  token?: string
  user?: {
    email?: string
  }
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
