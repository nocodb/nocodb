import { useStorage } from '@vueuse/core'
import type { JwtPayload } from 'jwt-decode'
import { MapProvider, NC_DEFAULT_ORG_ID } from 'nocodb-sdk'
import type { AppInfo, State, StoredState } from './types'
import { INITIAL_LEFT_SIDEBAR_WIDTH } from '~/lib/constants'

export function useGlobalState(storageKey = 'nocodb-gui-v2'): State {
  /** get the preferred languages of a user, according to browser settings */
  const preferredLanguages = usePreferredLanguages()
  /** todo: reimplement; get the preferred dark mode setting, according to browser settings */
  //   const prefersDarkMode = $(usePreferredDark())
  const prefersDarkMode = false

  /** reactive timestamp to check token expiry against */
  const timestamp = useTimestamp({ immediate: true, interval: 100 })

  const router = useRouter()

  const isSharedBaseOrErdOrView = computed(() => isSharedBaseOrErdOrViewRoute(router.currentRoute.value))

  /**
   * Set initial language based on browser settings.
   * If the user has not set a preferred language, we fall back to 'en'.
   * If the user has set a preferred language, we try to find a matching supported locale.
   *
   * Note: we match against the full list of supported locales (`Language` enum)
   * instead of `i18n.global.availableLocales`, because locale messages are loaded
   * lazily — at this point only `en` is usually loaded, so matching against
   * `availableLocales` would always fall back to `en`.
   */
  const supportedLocales = Object.keys(Language) as (keyof typeof Language)[]
  const languageAliases = LanguageAlias as Record<string, keyof typeof Language>

  const matchPreferredLocale = (language: string): keyof typeof Language | undefined => {
    /** split language to language and code, e.g. en-GB -> [en, GB], zh-CN -> [zh, CN] */
    const [lang, code] = language.split(/[_-]/)

    /** 1. alias match, e.g. zh-CN/zh_CN -> zh-Hans, zh-TW/zh_TW -> zh-Hant */
    const aliasKey = language.replace(/-/g, '_')
    if (languageAliases[aliasKey]) return languageAliases[aliasKey]

    /** 2. exact (case-insensitive) match against a supported locale, e.g. zh-Hans */
    const exact = supportedLocales.find((l) => l.toLowerCase() === language.toLowerCase())
    if (exact) return exact

    /** 3. match by language part; if multiple, try to narrow down by region code */
    let matches = supportedLocales.filter((l) => l.toLowerCase().startsWith(lang.toLowerCase()))
    if (matches.length > 1 && code) {
      const withCode = matches.filter((l) => l.toLowerCase().endsWith(code.toLowerCase()))
      if (withCode.length) matches = withCode
    }

    return matches[0]
  }

  const preferredLanguage = preferredLanguages.value.reduce<keyof typeof Language>((locale, language) => {
    /** keep the first (highest priority) match from the browser's language list */
    if (locale !== 'en') return locale

    return matchPreferredLocale(language) ?? locale
  }, 'en' /** fallback locale */)

  const { width } = useWindowSize()
  const isViewPortMobile = () => {
    return width.value < NC_BREAKPOINTS.sm
  }

  /** State */
  const initialState: StoredState = {
    token: null,
    lang: preferredLanguage,
    darkMode: prefersDarkMode,
    filterAutoSave: true,
    includeM2M: false,
    showNull: false,
    currentVersion: null,
    latestRelease: null,
    hiddenRelease: null,
    isMobileMode: null,
    activeBreakpoint: null,
    lastOpenedWorkspaceId: null,
    gridViewPageSize: 25,
    leftSidebarSize: {
      old: INITIAL_LEFT_SIDEBAR_WIDTH,
      current: INITIAL_LEFT_SIDEBAR_WIDTH,
    },
    isAddNewRecordGridMode: true,
    syncDataUpvotes: [],
    giftBannerDismissedCount: 0,
    isLeftSidebarOpen: !isViewPortMobile(),
    lastUsedAuthMethod: null,
  }

  /** saves a reactive state, any change to these values will write/delete to localStorage */
  const storage = useStorage<StoredState>(storageKey, initialState, localStorage, { mergeDefaults: true })

  /** force turn off of dark mode, regardless of previously stored settings */
  storage.value.darkMode = false

  /** current token ref, used by `useJwt` to reactively parse our token payload */
  /**
   * Token management behavior (read/write rules):
   *
   * Issue:
   * - When opening a Shared Base, ERD, or Shared View in a new tab,
   *   the main application’s auth token from `localStorage` gets reused.
   * - This incorrectly treats the user as authenticated, even though
   *   shared resources must always behave as "guest/readonly" access.
   *
   * Fix:
   * - When we detect that current route is a Shared Base / ERD / Shared View,
   *   we completely avoid reading from or writing to localStorage.
   * - This ensures:
   *    ✅ Shared views always open as guest users
   *    ✅ Real login session in main app remains unaffected
   *    ✅ No accidental privilege escalation when opening links in new tab
   *
   * Result:
   * - Main app uses persistent auth from localStorage
   * - Shared resources use a temporary, isolated token only in memory
   */
  const token = computed({
    get: () => (isSharedBaseOrErdOrView.value ? '' : storage.value.token || ''),
    set: (val) => {
      if (isSharedBaseOrErdOrView.value) return

      storage.value.token = val
    },
  })

  const config = useRuntimeConfig()

  const appInfo = ref<AppInfo>({
    ncSiteUrl: config.public.ncBackendUrl || BASE_FALLBACK_URL,
    authType: 'jwt',
    connectToExternalDB: false,
    defaultLimit: 0,
    firstUser: true,
    githubAuthEnabled: false,
    googleAuthEnabled: false,
    oidcAuthEnabled: false,
    oidcProviderName: null,
    openReplayKey: null,
    samlAuthEnabled: false,
    samlProviderName: null,
    ncMin: false,
    oneClick: false,
    baseHasAdmin: false,
    teleEnabled: true,
    errorReportingEnabled: false,
    auditEnabled: true,
    undoRedoEnabled: true,
    docsRealtimeEnabled: true,
    type: 'nocodb',
    version: '0.0.0',
    ncAttachmentFieldSize: 20,
    ncMaxAttachmentsAllowed: 10,
    ncMaxTextLength: 100000,
    ncDataImportFileSize: 100 * 1024 * 1024,
    ncGridMaxSelectionLimit: 1000,
    isCloud: false,
    automationLogLevel: 'OFF',
    disableEmailAuth: false,
    dashboardPath: '/',
    inviteOnlySignup: false,
    allowEmailSigninWithSso: false,
    giftUrl: '',
    isOnPrem: false,
    isPostgres: false,
    isAirgapped: false,
    managedGatewayEnabled: true,
    seatLimit: null,
    isTrial: false,
    isTrialExpired: false,
    licenseExpiryTime: 0,
    defaultWorkspaceId: null,
    disableGroupByAggregation: false,
    mapProvider: MapProvider.OPENSTREETMAP,
    defaultOrgId: NC_DEFAULT_ORG_ID,
  })

  /** reactive token payload */
  const { payload } = useJwt<JwtPayload & User>(token)

  /** currently running requests */
  const runningRequests = useCounter()

  /** global error */
  const error = ref()

  /** our local user object */
  const user = ref<User | null>(null)

  /** tracks appInfo API call status: 'idle' → 'loading' → 'loaded' | 'error' */
  const appInfoStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')

  return {
    ...toRefs(storage.value),
    storage,
    token,
    jwtPayload: payload,
    timestamp,
    runningRequests,
    error,
    user,
    appInfo,
    appInfoStatus,
  }
}
