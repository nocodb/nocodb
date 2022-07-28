import type { ComputedRef, ToRefs } from 'vue'
import type { Role } from './enums'

export interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: Roles
}

export interface FeedbackForm {
  url: string
  createdAt: string
  isHidden: boolean
  lastFormPollDate?: string
}

export interface StoredState {
  token: string | null
  user: User | null
  lang: string
  darkMode: boolean
  feedbackForm: FeedbackForm
}

export interface State extends StoredState {
  sidebarOpen: boolean
}

export interface Getters {
  signedIn: ComputedRef<boolean>
}

export interface Actions {
  signOut: () => void
  signIn: (token: string) => void
}

export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

export type GlobalState = Getters & Actions & ToRefs<ReadonlyState>

export type Roles = Record<Role, boolean>
