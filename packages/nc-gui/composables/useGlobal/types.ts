import type { ComputedRef, Ref, ToRefs } from 'vue'
import type { WritableComputedRef } from '@vue/reactivity'
import type { JwtPayload } from 'jwt-decode'
import type { AxiosInstance } from 'axios'
import type { MapProvider } from 'nocodb-sdk'
import type { NcBreakpoint } from '~/lib/constants'

export interface AppInfo {
  ncSiteUrl: string
  authType: 'jwt' | 'none'
  allowLocalUrl: boolean
  connectToExternalDB: boolean
  defaultLimit: number
  defaultGroupByLimit: {
    limitGroup: number
    limitRecord: number
  }
  firstUser: boolean
  env: string
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
  ncMaxTextLength: number
  isCloud: boolean
  automationLogLevel: 'OFF' | 'ERROR' | 'ALL'
  baseHostName?: string
  disableEmailAuth: boolean
  mainSubDomain?: string
  dashboardPath: string
  inviteOnlySignup: boolean
  restrictWorkspaceCreation: boolean
  samlAuthEnabled: boolean
  samlProviderName: string | null
  giftUrl: string
  feedEnabled: boolean
  sentryDSN: string
  isOnPrem: boolean
  isPostgres: boolean
  isAirgapped: boolean
  onPremPlan: Record<string, any> | null
  seatLimit: number | null
  isTrial: boolean
  isTrialExpired: boolean
  licenseExpiryTime: number
  defaultWorkspaceId: string | null
  stripePublishableKey?: string
  marketingRootUrl?: string
  templatesRootUrl?: string
  openReplayKey?: string | null
  disableSupportChat: boolean
  disableOnboardingFlow: boolean
  iframeWhitelistDomains?: Array<string>
  disableGroupByAggregation?: boolean
  sendRecordMaxRecipients?: number
  mapProvider?: MapProvider
  defaultOrgId?: string
}

export interface StoredState {
  token: string | null
  lang: keyof typeof Language
  darkMode: boolean
  filterAutoSave: boolean
  includeM2M: boolean
  showNull: boolean
  currentVersion: string | null
  latestRelease: string | null
  hiddenRelease: string | null
  isMobileMode: boolean | null
  activeBreakpoint: NcBreakpoint | null
  lastOpenedWorkspaceId: string | null
  gridViewPageSize: number
  leftSidebarSize: {
    old: number
    current: number
  }
  isAddNewRecordGridMode: boolean
  syncDataUpvotes: string[]
  giftBannerDismissedCount: number
  isLeftSidebarOpen: boolean
  lastUsedAuthMethod: 'google' | 'oidc' | 'sso' | 'email' | null
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
  appInfoStatus: Ref<'idle' | 'loading' | 'loaded' | 'error'>
}

export interface Getters {
  signedIn: ComputedRef<boolean>
  isSsoUser: ComputedRef<boolean>
  isLoading: WritableComputedRef<boolean>
  getResponsiveValue: <T>(mobile: T, desktop: T) => T
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
  setActiveBreakpoint: (breakpoint: NcBreakpoint) => void
  navigateToProject: (params: { workspaceId?: string; baseId?: string; query?: any }) => void
  /**
   * params `tableTitle, viewTitle, scriptTitle ,dashboardTitle,workflowTitle` will be used for readable url slug
   */
  ncNavigateTo: (params: {
    workspaceId?: string
    baseId?: string
    query?: any
    tableId?: string
    tableTitle?: string
    viewId?: string
    viewTitle?: string
    scriptId?: string
    scriptTitle?: string
    dashboardId?: string
    dashboardTitle?: string
    workflowId?: string
    workflowTitle?: string
    replace?: boolean
    newTab?: boolean
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
