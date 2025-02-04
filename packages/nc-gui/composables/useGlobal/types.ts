import type { ComputedRef, Ref, ToRefs } from 'vue'
import type { WritableComputedRef } from '@vue/reactivity'
import type { JwtPayload } from 'jwt-decode'
import type { ProjectRoles } from 'nocodb-sdk'
import type { AxiosInstance } from 'axios'
import type { NcProjectType } from '#imports'
export interface AppInfo {
  ncSiteUrl: string
  authType: 'jwt' | 'none'
  connectToExternalDB: boolean
  defaultLimit: number
  defaultGroupByLimit: {
    limitGroup: number
    limitRecord: number
  }
  firstUser: boolean
  githubAuthEnabled: boolean
  googleAuthEnabled: boolean
  oidcAuthEnabled: boolean
  oidcProviderName: string | null
  ncMin: boolean
  oneClick: boolean
  baseHasAdmin: boolean
  teleEnabled: boolean
  errorReportingEnabled: boolean
  auditEnabled: boolean
  type: string
  version: string
  ee?: boolean
  ncAttachmentFieldSize: number
  ncMaxAttachmentsAllowed: number
  isCloud: boolean
  automationLogLevel: 'OFF' | 'ERROR' | 'ALL'
  baseHostName?: string
  disableEmailAuth: boolean
  mainSubDomain?: string
  dashboardPath: string
  inviteOnlySignup: boolean
  samlAuthEnabled: boolean
  samlProviderName: string | null
  giftUrl: string
  feedEnabled: boolean
  sentryDSN: string
  isOnPrem: boolean
}

export interface StoredState {
  token: string | null
  lang: keyof typeof Language
  darkMode: boolean
  filterAutoSave: boolean
  previewAs: ProjectRoles | null
  includeM2M: boolean
  showNull: boolean
  currentVersion: string | null
  latestRelease: string | null
  hiddenRelease: string | null
  isMobileMode: boolean | null
  lastOpenedWorkspaceId: string | null
  gridViewPageSize: number
  leftSidebarSize: {
    old: number
    current: number
  }
  isAddNewRecordGridMode: boolean
  syncDataUpvotes: string[]
  giftBannerDismissedCount: number
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

export interface SignOutParams {
  redirectToSignin?: boolean
  signinUrl?: string
  skipRedirect?: boolean
  skipApiCall?: boolean
}

export interface Actions {
  signOut: (signOutParams?: SignOutParams) => Promise<void>
  signIn: (token: string, keepProps?: boolean) => void
  refreshToken: (params: {
    axiosInstance?: AxiosInstance
    skipLogout?: boolean
    cognitoOnly?: boolean
  }) => Promise<string | null | void>
  loadAppInfo: () => void
  setIsMobileMode: (isMobileMode: boolean) => void
  navigateToProject: (params: { workspaceId?: string; baseId?: string; type?: NcProjectType; query?: any }) => void
  ncNavigateTo: (params: {
    workspaceId?: string
    baseId?: string
    type?: NcProjectType
    query?: any
    tableId?: string
    viewId?: string
  }) => void
  getBaseUrl: (workspaceId: string) => string | undefined
  getMainUrl: (workspaceId: string) => string | undefined
  setGridViewPageSize: (pageSize: number) => void
  setLeftSidebarSize: (params: { old?: number; current?: number }) => void
  setAddNewRecordGridMode: (isGridMode: boolean) => void
  updateSyncDataUpvotes: (upvotes: string[]) => void
}

export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

export type UseGlobalReturn = Getters & Actions & ReadonlyState
