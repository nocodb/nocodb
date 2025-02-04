import { useStorage } from '@vueuse/core'
import type { JwtPayload } from 'jwt-decode'
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

  const {
    vueApp: { i18n },
  } = useNuxtApp()

  /**
   * Set initial language based on browser settings.
   * If the user has not set a preferred language, we fall back to 'en'.
   * If the user has set a preferred language, we try to find a matching locale in the available locales.
   */
  const preferredLanguage = preferredLanguages.value.reduce<keyof typeof Language>((locale, language) => {
    /** split language to language and code, e.g. en-GB -> [en, GB] */
    const [lang, code] = language.split(/[_-]/)

    /** find all locales that match the language */
    let availableLocales = i18n.global.availableLocales.filter((locale) => locale.startsWith(lang))

    /** If we can match more than one locale, we check if the code of the language matches as well */
    if (availableLocales.length > 1) {
      availableLocales = availableLocales.filter((locale) => locale.endsWith(code))
    }

    /** if there are still multiple locales, pick the first one */
    const availableLocale = availableLocales[0]

    /** if we found a matching locale, return it */
    if (availableLocale) locale = availableLocale as keyof typeof Language

    return locale
  }, 'en' /** fallback locale */)

  /** State */
  const initialState: StoredState = {
    token: null,
    lang: preferredLanguage,
    darkMode: prefersDarkMode,
    filterAutoSave: true,
    previewAs: null,
    includeM2M: false,
    showNull: false,
    currentVersion: null,
    latestRelease: null,
    hiddenRelease: null,
    isMobileMode: null,
    lastOpenedWorkspaceId: null,
    gridViewPageSize: 25,
    leftSidebarSize: {
      old: INITIAL_LEFT_SIDEBAR_WIDTH,
      current: INITIAL_LEFT_SIDEBAR_WIDTH,
    },
    isAddNewRecordGridMode: true,
    syncDataUpvotes: [],
    giftBannerDismissedCount: 0,
  }

  /** saves a reactive state, any change to these values will write/delete to localStorage */
  const storage = useStorage<StoredState>(storageKey, initialState, localStorage, { mergeDefaults: true })

  /** force turn off of dark mode, regardless of previously stored settings */
  storage.value.darkMode = false

  /** current token ref, used by `useJwt` to reactively parse our token payload */
  const token = computed({
    get: () => storage.value.token || '',
    set: (val) => {
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
    samlAuthEnabled: false,
    samlProviderName: null,
    ncMin: false,
    oneClick: false,
    baseHasAdmin: false,
    teleEnabled: true,
    errorReportingEnabled: false,
    auditEnabled: true,
    type: 'nocodb',
    version: '0.0.0',
    ncAttachmentFieldSize: 20,
    ncMaxAttachmentsAllowed: 10,
    isCloud: false,
    automationLogLevel: 'OFF',
    disableEmailAuth: false,
    dashboardPath: '/dashboard',
    inviteOnlySignup: false,
    giftUrl: '',
    isOnPrem: false,
  })

  /** reactive token payload */
  const { payload } = useJwt<JwtPayload & User>(token)

  /** currently running requests */
  const runningRequests = useCounter()

  /** global error */
  const error = ref()

  /** our local user object */
  const user = ref<User | null>(null)

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
  }
}
