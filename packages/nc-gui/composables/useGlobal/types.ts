import type { ComputedRef, Ref, ToRefs } from 'vue'
import type { WritableComputedRef } from '@vue/reactivity'
import type { JwtPayload } from 'jwt-decode'
import type { Language, ProjectRole, User } from '~/lib'
import type { useCounter } from '#imports'

export interface FeedbackForm {
  url: string
  createdAt: string
  isHidden: boolean
  lastFormPollDate?: string
}

export interface AppInfo {
  ncSiteUrl: string
  authType: 'jwt' | 'none'
  connectToExternalDB: boolean
  defaultLimit: number
  firstUser: boolean
  githubAuthEnabled: boolean
  googleAuthEnabled: boolean
  ncMin: boolean
  oneClick: boolean
  projectHasAdmin: boolean
  teleEnabled: boolean
  type: string
  version: string
  ee?: boolean
}

export interface StoredState {
  token: string | null
  lang: keyof typeof Language
  darkMode: boolean
  feedbackForm: FeedbackForm
  filterAutoSave: boolean
  previewAs: ProjectRole | null
  includeM2M: boolean
  currentVersion: string | null
  latestRelease: string | null
  hiddenRelease: string | null
}

export type State = ToRefs<Omit<StoredState, 'token'>> & {
  storage: Ref<StoredState>
  user: Ref<User | null>
  token: WritableComputedRef<StoredState['token']>
  jwtPayload: ComputedRef<(JwtPayload & User) | null>
  timestamp: Ref<number>
  runningRequests: ReturnType<typeof useCounter>
  error: Ref<any>
  appInfo: Ref<AppInfo>
}

export interface Getters {
  signedIn: ComputedRef<boolean>
  isLoading: WritableComputedRef<boolean>
}

export interface Actions {
  signOut: () => void
  signIn: (token: string) => void
  refreshToken: () => void
}

export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

export type UseGlobalReturn = Getters & Actions & ReadonlyState
