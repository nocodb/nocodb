import type { ColumnType, KanbanType, ViewType } from 'nocodb-sdk'
import { NC_VIEW_PASSWORD_PROTECTED_SENTINEL, ViewTypes } from 'nocodb-sdk'

export type ShareViewPopoverScreen = 'main' | 'link-settings' | 'regenerate-confirm' | 'disable-confirm' | 'change-password'

const [useProvideShareViewPopover, useShareViewPopover] = useInjectionState(() => {
  const { $api } = useSmartsheetStoreOrThrow()
  const { $e } = useNuxtApp()
  const { dashboardUrl } = useDashboard()
  const { getMetaByKey } = useMetas()
  const { isPrivateBase } = storeToRefs(useBase())
  const viewStore = useViewsStore()
  const { activeView } = storeToRefs(viewStore)

  const isLocked = inject(IsLockedInj, ref(false))

  const screen = ref<ShareViewPopoverScreen>('main')
  const direction = ref<'forward' | 'backward'>('forward')

  function goTo(target: ShareViewPopoverScreen) {
    direction.value = 'forward'
    screen.value = target
  }

  function goBack() {
    direction.value = 'backward'
    // Navigate up one level — sub-confirmation screens hang off link-settings,
    // link-settings hangs off main.
    if (screen.value === 'regenerate-confirm' || screen.value === 'disable-confirm' || screen.value === 'change-password') {
      screen.value = 'link-settings'
    } else {
      screen.value = 'main'
    }
  }

  const isUpdating = ref({
    public: false,
    password: false,
    download: false,
    customUrl: false,
    language: false,
    theme: false,
    regenerate: false,
  })

  const restrictedSharing = computed(() => {
    return isPrivateBase.value && activeView.value?.type !== ViewTypes.FORM
  })

  const isPublicShared = computed(() => {
    if (restrictedSharing.value) return false
    return !!activeView.value?.uuid
  })

  const isReadOnly = computed(() => isLocked.value || restrictedSharing.value)

  const isFormView = computed(() => activeView.value?.type === ViewTypes.FORM)

  const hasDownloadOption = computed(() => {
    if (!activeView.value) return false
    return [ViewTypes.GRID, ViewTypes.KANBAN, ViewTypes.GALLERY, ViewTypes.MAP, ViewTypes.CALENDAR].includes(
      activeView.value.type,
    )
  })

  const viewMeta = computed<Record<string, any>>(() => {
    const meta = (activeView.value as ViewType | undefined)?.meta
    if (!meta) return {}
    if (typeof meta === 'string') {
      try {
        return JSON.parse(meta)
      } catch {
        return {}
      }
    }
    return meta as Record<string, any>
  })

  const hasStoredPassword = computed(() => {
    const value = activeView.value?.password
    return typeof value === 'string' && value.length > 0
  })

  const isLegacyPlaintextPassword = computed(() => {
    const value = activeView.value?.password
    return typeof value === 'string' && value.length > 0 && value !== NC_VIEW_PASSWORD_PROTECTED_SENTINEL
  })

  const passwordProtectedLocal = ref(false)

  const passwordProtected = computed(() => {
    return !!activeView.value?.password || passwordProtectedLocal.value
  })

  const newPasswordDraft = ref('')

  const surveyMode = computed({
    get: () => !!viewMeta.value?.surveyMode,
    set: async (survey) => {
      await patchMeta({ surveyMode: survey })
      $e(`a:view:share:${survey ? 'enable' : 'disable'}-survey-mode`)
    },
  })

  const allowCSVDownload = computed({
    get: () => !!viewMeta.value?.allowCSVDownload,
    set: async (allow) => {
      isUpdating.value.download = true
      try {
        await patchMeta({ allowCSVDownload: allow })
        $e(`a:view:share:${allow ? 'enable' : 'disable'}-csv-download`)
      } finally {
        isUpdating.value.download = false
      }
    },
  })

  const languageSetLocal = ref(false)

  const languageSet = computed(() => {
    return !!viewMeta.value?.language || languageSetLocal.value
  })

  const withLanguage = computed({
    get: () => viewMeta.value?.language,
    set: async (language) => {
      await patchMeta({ language })
    },
  })

  const themeSetLocal = ref(false)

  const themeSet = computed(() => {
    return !!viewMeta.value?.defaultTheme || themeSetLocal.value
  })

  const defaultTheme = computed({
    get: () => viewMeta.value?.defaultTheme ?? null,
    set: async (theme) => {
      await patchMeta({ defaultTheme: theme })
    },
  })

  const formPreFill = computed({
    get: () => ({
      preFillEnabled: viewMeta.value?.preFillEnabled ?? false,
      preFilledMode: viewMeta.value?.preFilledMode || PreFilledMode.Default,
    }),
    set: async (value) => {
      const prev = formPreFill.value
      if (prev.preFillEnabled !== value.preFillEnabled) {
        $e(`a:view:share:prefilled-mode-${value.preFillEnabled ? 'enabled' : 'disabled'}`)
      }
      if (prev.preFilledMode !== value.preFilledMode) {
        $e(`a:view:share:${value.preFilledMode}-prefilled-mode`)
      }
      await patchMeta(value)
    },
  })

  const preFillFormSearchParams = computed(() => {
    return viewStore.preFillFormSearchParams && formPreFill.value.preFillEnabled ? viewStore.preFillFormSearchParams : ''
  })

  function sharedViewUrl(withPrefill = true) {
    if (!activeView.value?.uuid) return ''

    let viewType
    switch (activeView.value.type) {
      case ViewTypes.FORM:
        viewType = 'form'
        break
      case ViewTypes.KANBAN:
        viewType = 'kanban'
        break
      case ViewTypes.GALLERY:
        viewType = 'gallery'
        break
      case ViewTypes.MAP:
        viewType = 'map'
        break
      case ViewTypes.CALENDAR:
        viewType = 'calendar'
        break
      case ViewTypes.LIST:
        viewType = 'list'
        break
      case ViewTypes.TIMELINE:
        viewType = 'timeline'
        break
      default:
        viewType = 'view'
    }

    const baseUrl = `${dashboardUrl.value}/nc/${viewType}/${activeView.value.uuid}${surveyMode.value ? '/survey' : ''}`
    const queryParams = []

    if (withPrefill && preFillFormSearchParams.value) {
      queryParams.push(preFillFormSearchParams.value)
    }

    if (defaultTheme.value) {
      queryParams.push(`nc-theme=${defaultTheme.value}`)
    }

    return `${encodeURI(baseUrl)}${queryParams.length > 0 ? `?${queryParams.join('&')}` : ''}`
  }

  const url = computed(() => sharedViewUrl())

  /**
   * Merge new meta keys into the view's existing meta and persist via the
   * view store. Keeps the local cache consistent automatically — no manual
   * activeView mutation needed.
   */
  async function patchMeta(patch: Record<string, any>) {
    if (!activeView.value?.id) return false
    try {
      const merged = { ...viewMeta.value, ...patch }
      await viewStore.updateView(activeView.value.id, { meta: merged })
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    }
  }

  async function persistPassword(password: string | null) {
    if (!activeView.value?.id) return false
    try {
      // Use shareViewUpdate (not viewUpdate) — the latter validates against
      // ViewUpdateReqType and rejects `password: null`, while shareViewUpdate's
      // SharedViewReqType accepts null to clear the password.
      const metaInfo = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)
      const res = await $api.internal.postOperation(
        metaInfo!.fk_workspace_id!,
        metaInfo!.base_id!,
        {
          operation: 'shareViewUpdate',
          viewId: activeView.value.id,
        },
        { password },
      )
      // Update the in-memory view so the UI reflects the new state immediately.
      // Direct mutation works because the underlying view object is reactive.
      if (activeView.value) {
        const echoed = (res as any)?.password ?? (password === null ? null : NC_VIEW_PASSWORD_PROTECTED_SENTINEL)
        ;(activeView.value as any).password = echoed
      }
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    }
  }

  async function persistCustomUrl(custUrl: string | null) {
    if (!activeView.value?.id) return false
    if (isUpdating.value.customUrl) return false

    isUpdating.value.customUrl = true
    try {
      const metaInfo = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)
      const res = await $api.internal.postOperation(
        metaInfo!.fk_workspace_id!,
        metaInfo!.base_id!,
        {
          operation: 'shareViewUpdate',
          viewId: activeView.value.id,
        },
        { custom_url_path: custUrl ?? null },
      )
      if (res?.fk_custom_url_id !== undefined) {
        await viewStore.updateView(activeView.value.id, { fk_custom_url_id: res.fk_custom_url_id })
      }
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    } finally {
      isUpdating.value.customUrl = false
    }
  }

  async function toggleViewShare() {
    if (!activeView.value?.id) return

    const metaInfo = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)

    if (activeView.value.uuid) {
      await $api.internal.postOperation(
        metaInfo!.fk_workspace_id!,
        metaInfo!.base_id!,
        {
          operation: 'shareViewDelete',
          viewId: activeView.value.id,
        },
        {},
      )
      await viewStore.updateView(activeView.value.id, { uuid: undefined, password: undefined } as Partial<ViewType>)
    } else {
      const response = await $api.internal.postOperation(
        metaInfo!.fk_workspace_id!,
        metaInfo!.base_id!,
        {
          operation: 'shareView',
          viewId: activeView.value.id,
        },
        {},
      )

      // For Kanban, the backend needs the grouping column meta to render the public view.
      if (activeView.value.type === ViewTypes.KANBAN) {
        const groupingFieldColumn = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)?.columns!.find(
          (col: ColumnType) => col.id === ((activeView.value!.view! as KanbanType).fk_grp_col_id! as string),
        )
        await viewStore.updateView(activeView.value.id, {
          uuid: (response as any).uuid,
          meta: { ...viewMeta.value, groupingFieldColumn },
        })
      } else {
        await viewStore.updateView(activeView.value.id, { uuid: (response as any).uuid })
      }
    }
  }

  async function toggleShare() {
    if (isUpdating.value.public) return
    isUpdating.value.public = true
    try {
      return await toggleViewShare()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isUpdating.value.public = false
    }
  }

  async function disableLink() {
    if (!isPublicShared.value) return
    await toggleShare()
    // After disable the link-settings screen no longer applies — return to main.
    direction.value = 'backward'
    screen.value = 'main'
  }

  async function regenerateLink(): Promise<boolean> {
    if (!activeView.value?.id || !isPublicShared.value) return false
    if (isUpdating.value.regenerate) return false

    isUpdating.value.regenerate = true
    try {
      const metaInfo = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)
      const response = await $api.internal.postOperation(
        metaInfo!.fk_workspace_id!,
        metaInfo!.base_id!,
        {
          operation: 'shareViewRegenerate',
          viewId: activeView.value.id,
        },
        {},
      )
      const newUuid = (response as any)?.uuid
      if (newUuid) {
        await viewStore.updateView(activeView.value.id, { uuid: newUuid })
      }
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    } finally {
      isUpdating.value.regenerate = false
    }
  }

  async function togglePasswordProtected() {
    if (!activeView.value) return
    if (isUpdating.value.password) return

    const wasProtected = passwordProtected.value

    isUpdating.value.password = true
    try {
      if (wasProtected) {
        const ok = await persistPassword(null)
        if (!ok) return
        passwordProtectedLocal.value = false
        newPasswordDraft.value = ''
      } else {
        // Turning ON — open the toggle locally; backend stays unchanged until the user
        // actually enters a password.
        passwordProtectedLocal.value = true
      }
    } finally {
      isUpdating.value.password = false
    }
  }

  async function saveNewPassword(newValue: string): Promise<boolean> {
    if (!activeView.value) return false
    const trimmed = (newValue ?? '').trim()
    if (!trimmed) return false
    if (isUpdating.value.password) return false

    isUpdating.value.password = true
    try {
      const ok = await persistPassword(trimmed)
      if (!ok) return false
      newPasswordDraft.value = ''
      passwordProtectedLocal.value = false
      return true
    } finally {
      isUpdating.value.password = false
    }
  }

  function openChangePasswordModal() {
    if (isReadOnly.value) return
    goTo('change-password')
  }

  async function onPasswordChanged(newValue: string) {
    const ok = await saveNewPassword(newValue)
    if (ok) goBack()
  }

  async function toggleLanguageSet() {
    languageSetLocal.value = !languageSet.value
    if (!activeView.value) return
    if (isUpdating.value.language) return

    isUpdating.value.language = true
    try {
      await patchMeta({ language: languageSetLocal.value ? 'en' : null })
    } finally {
      isUpdating.value.language = false
    }
  }

  async function toggleThemeSet() {
    themeSetLocal.value = !themeSet.value
    if (!activeView.value) return
    if (isUpdating.value.theme) return

    isUpdating.value.theme = true
    try {
      await patchMeta({ defaultTheme: themeSetLocal.value ? 'light' : null })
    } finally {
      isUpdating.value.theme = false
    }
  }

  function handleChangeFormPreFill(value: { preFillEnabled?: boolean; preFilledMode?: PreFilledMode }) {
    formPreFill.value = { ...formPreFill.value, ...value }
  }

  return {
    screen,
    direction,
    goTo,
    goBack,
    isUpdating,
    activeView,
    restrictedSharing,
    isPublicShared,
    isReadOnly,
    isLocked,
    isFormView,
    hasDownloadOption,
    hasStoredPassword,
    isLegacyPlaintextPassword,
    passwordProtected,
    newPasswordDraft,
    surveyMode,
    allowCSVDownload,
    languageSet,
    withLanguage,
    themeSet,
    defaultTheme,
    formPreFill,
    preFillFormSearchParams,
    url,
    sharedViewUrl,
    persistCustomUrl,
    toggleShare,
    disableLink,
    regenerateLink,
    togglePasswordProtected,
    saveNewPassword,
    openChangePasswordModal,
    onPasswordChanged,
    toggleLanguageSet,
    toggleThemeSet,
    handleChangeFormPreFill,
  }
})

export { useProvideShareViewPopover, useShareViewPopover }
