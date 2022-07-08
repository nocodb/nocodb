import type { ComputedRef, ToRefs } from 'vue'

export interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: string[]
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
  signIn: (token: string) => void
}

export type GlobalState = Getters & Actions & ToRefs<State>
