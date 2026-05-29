<script lang="ts" setup>
import type { ColumnType, KanbanType, ViewType } from 'nocodb-sdk'
import { NC_VIEW_PASSWORD_PROTECTED_SENTINEL, PlanFeatureTypes, PlanTitles, ViewTypes } from 'nocodb-sdk'

const { view: _view, $api } = useSmartsheetStoreOrThrow()
const { $e } = useNuxtApp()

const { appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const { showEEFeatures, getPlanTitle } = useEeConfig()

const viewStore = useViewsStore()

const { getMetaByKey } = useMetas()

const { isPrivateBase } = storeToRefs(useBase())

const isLocked = inject(IsLockedInj, ref(false))

const { copy } = useCopy()

const isUpdating = ref({
  public: false,
  password: false,
  download: false,
  customUrl: false,
  language: false,
  allowSync: false,
})

const activeView = computed<(ViewType & { meta: object & Record<string, any> }) | undefined>({
  get: () => {
    if (typeof _view.value?.meta === 'string') {
      _view.value.meta = JSON.parse(_view.value.meta)
    }

    return _view.value as ViewType & { meta: object }
  },
  set: (value: ViewType | undefined) => {
    if (typeof _view.value?.meta === 'string') {
      _view.value!.meta = JSON.parse((_view.value.meta as string)!)
    }

    if (typeof value?.meta === 'string') {
      value!.meta = JSON.parse(value.meta as string)
    }

    _view.value = value
  },
})

const restrictedSharing = computed(() => {
  return isPrivateBase.value && activeView.value?.type !== ViewTypes.FORM
})

const isPublicShared = computed(() => {
  // If base is private, then we have to restrict sharing
  if (restrictedSharing.value) return false

  return !!activeView.value?.uuid
})

const isReadOnly = computed(() => {
  return isLocked.value || restrictedSharing.value
})

const url = computed(() => {
  return sharedViewUrl() ?? ''
})

const languages = computed(() => Object.entries(Language).sort() as [keyof typeof Language, Language][])

const languageOptions = computed(() => {
  return languages.value.map(([key, lang]) => ({
    label: Language[key] || lang,
    value: key,
  }))
})

const languageSetLocal = ref(false)

const languageSet = computed(() => {
  return !!activeView.value?.meta?.language || languageSetLocal.value
})

const toggleLanguageSet = async () => {
  languageSetLocal.value = !languageSet.value
  if (!activeView.value) return
  if (isUpdating.value.language) return

  isUpdating.value.language = true
  try {
    if (!languageSetLocal.value) {
      activeView.value = { ...(activeView.value as any), meta: { ...activeView.value.meta, language: null } }
    } else {
      activeView.value = { ...(activeView.value as any), meta: { ...activeView.value.meta, language: 'en' } }
    }

    await updateSharedView()
  } finally {
    isUpdating.value.language = false
  }
}

const passwordProtectedLocal = ref(false)

const passwordProtected = computed(() => {
  return !!activeView.value?.password || passwordProtectedLocal.value
})

/**
 * `true` when the backend has confirmed a password is stored for this view.
 * The actual hash never reaches the frontend — we receive the sentinel
 * `NC_VIEW_PASSWORD_PROTECTED_SENTINEL` instead and render a masked state.
 */
const hasStoredPassword = computed(() => {
  const value = activeView.value?.password
  return typeof value === 'string' && value.length > 0
})

/**
 * `true` when the stored value is a legacy plaintext password (set before
 * the GHSA-mpp2 bcrypt migration and never re-saved). The backend passes
 * these through unmasked so the owner can still read the original value.
 * Once the owner changes it, the password gets bcrypt-hashed and the UI
 * migrates to the masked locked state.
 */
const isLegacyPlaintextPassword = computed(() => {
  const value = activeView.value?.password
  return typeof value === 'string' && value.length > 0 && value !== NC_VIEW_PASSWORD_PROTECTED_SENTINEL
})

// Local buffer for first-time password entry (after toggling the switch on).
// Once the password is saved, the field switches to a "locked" state and
// further edits go through the dedicated change-password modal.
const newPasswordDraft = ref('')

const isChangePasswordModalOpen = ref(false)

const viewTheme = computed({
  get: () => !!activeView.value?.meta.withTheme,
  set: (withTheme) => {
    if (!activeView.value?.meta) return

    activeView.value.meta = {
      ...activeView.value.meta,
      withTheme,
    }
    saveTheme()
  },
})

const togglePasswordProtected = async () => {
  if (!activeView.value) return
  if (isUpdating.value.password) return

  const wasProtected = passwordProtected.value

  isUpdating.value.password = true
  try {
    if (wasProtected) {
      // Turning OFF — clear stored password. Persist first; only flip local
      // state on confirmed success so a backend failure doesn't leave the UI
      // claiming the password was removed when the hash is still stored.
      const prevPassword = (activeView.value as any).password
      const ok = await updateSharedView({ password: null })
      if (!ok) {
        // Restore so the toggle/text reflect the still-stored password.
        activeView.value = { ...(activeView.value as any), password: prevPassword }
        return
      }
      passwordProtectedLocal.value = false
      newPasswordDraft.value = ''
      activeView.value = { ...(activeView.value as any), password: null }
    } else {
      // Turning ON — open the toggle locally; backend stays unchanged until
      // the user actually enters a password. Don't send a password update
      // until then (sentinel handling ensures we never re-save the mask).
      passwordProtectedLocal.value = true
    }
  } finally {
    isUpdating.value.password = false
  }
}

const saveNewPassword = async (newValue: string): Promise<boolean> => {
  if (!activeView.value) return false
  const trimmed = (newValue ?? '').trim()
  if (!trimmed) return false
  if (isUpdating.value.password) return false

  isUpdating.value.password = true
  try {
    const ok = await updateSharedView({ password: trimmed })
    if (!ok) return false
    // Backend echoes the sentinel back on the next read; reflect that locally
    // so the UI immediately switches to the masked/locked state.
    activeView.value = {
      ...(activeView.value as any),
      password: NC_VIEW_PASSWORD_PROTECTED_SENTINEL,
    }
    newPasswordDraft.value = ''
    passwordProtectedLocal.value = false
    return true
  } finally {
    isUpdating.value.password = false
  }
}

const openChangePasswordModal = () => {
  if (isReadOnly.value) return
  isChangePasswordModalOpen.value = true
}

const onPasswordChanged = async (newValue: string) => {
  const ok = await saveNewPassword(newValue)
  // Keep the modal open on failure so the user can retry without losing input.
  if (ok) isChangePasswordModalOpen.value = false
}

const withLanguage = computed({
  get: () => {
    if (!activeView.value?.meta) return false

    if (typeof activeView.value?.meta === 'string') {
      activeView.value.meta = JSON.parse(activeView.value.meta)
    }

    return (activeView.value?.meta as any)?.language
  },
  set: (language) => {
    if (!activeView.value?.meta) return

    if (typeof activeView.value?.meta === 'string') {
      activeView.value.meta = JSON.parse(activeView.value.meta)
    }

    activeView.value.meta = { ...(activeView.value.meta as any), language }
    updateSharedView()
  },
})

const allowCSVDownload = computed({
  get: () => !!(activeView.value?.meta as any)?.allowCSVDownload,
  set: async (allow) => {
    if (!activeView.value?.meta) return

    isUpdating.value.download = true

    try {
      activeView.value.meta = { ...activeView.value.meta, allowCSVDownload: allow }
      await saveAllowCSVDownload()
    } finally {
      isUpdating.value.download = false
    }
  },
})

const surveyMode = computed({
  get: () => !!activeView.value?.meta.surveyMode,
  set: (survey) => {
    if (!activeView.value?.meta) return

    activeView.value.meta = { ...activeView.value.meta, surveyMode: survey }
    saveSurveyMode()
  },
})

const themeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

const themeSetLocal = ref(false)

const themeSet = computed(() => {
  return !!activeView.value?.meta?.defaultTheme || themeSetLocal.value
})

const toggleThemeSet = async () => {
  themeSetLocal.value = !themeSet.value
  if (!activeView.value) return
  if (isUpdating.value.language) return

  isUpdating.value.language = true
  try {
    if (!themeSetLocal.value) {
      activeView.value = { ...(activeView.value as any), meta: { ...activeView.value.meta, defaultTheme: null } }
    } else {
      activeView.value = { ...(activeView.value as any), meta: { ...activeView.value.meta, defaultTheme: 'light' } }
    }

    await updateSharedView()
  } finally {
    isUpdating.value.language = false
  }
}

const defaultTheme = computed({
  get: () => {
    if (!activeView.value?.meta) return null

    if (typeof activeView.value?.meta === 'string') {
      activeView.value.meta = JSON.parse(activeView.value.meta)
    }

    return (activeView.value?.meta as any)?.defaultTheme
  },
  set: (theme) => {
    if (!activeView.value?.meta) return

    if (typeof activeView.value?.meta === 'string') {
      activeView.value.meta = JSON.parse(activeView.value.meta)
    }

    activeView.value.meta = { ...(activeView.value.meta as any), defaultTheme: theme }
    updateSharedView()
  },
})

const formPreFill = computed({
  get: () => ({
    preFillEnabled: parseProp(activeView.value?.meta)?.preFillEnabled ?? false,
    preFilledMode: parseProp(activeView.value?.meta)?.preFilledMode || PreFilledMode.Default,
  }),
  set: (value) => {
    if (!activeView.value?.meta) return

    if (formPreFill.value.preFillEnabled !== value.preFillEnabled) {
      $e(`a:view:share:prefilled-mode-${value.preFillEnabled ? 'enabled' : 'disabled'}`)
    }

    if (formPreFill.value.preFilledMode !== value.preFilledMode) {
      $e(`a:view:share:${value.preFilledMode}-prefilled-mode`)
    }

    activeView.value.meta = {
      ...activeView.value.meta,
      ...value,
    }
    savePreFilledMode()
  },
})

const preFillFormSearchParams = computed(() => {
  return viewStore.preFillFormSearchParams && formPreFill.value.preFillEnabled ? viewStore.preFillFormSearchParams : ''
})

const handleChangeFormPreFill = (value: { preFillEnabled?: boolean; preFilledMode?: PreFilledMode }) => {
  formPreFill.value = {
    ...formPreFill.value,
    ...value,
  }
}

function sharedViewUrl(withPrefill = true) {
  if (!activeView.value) return

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
    case ViewTypes.GANTT:
      viewType = 'gantt'
      break
    default:
      viewType = 'view'
  }

  const baseUrl = `${dashboardUrl.value}/nc/${viewType}/${activeView.value.uuid}${surveyMode.value ? '/survey' : ''}`
  const queryParams = []

  // Add prefill parameters
  if (withPrefill && preFillFormSearchParams.value) {
    queryParams.push(preFillFormSearchParams.value)
  }

  // Add theme parameter if defaultTheme is set
  // Use 'nc-theme' to avoid conflicts with user form fields named 'theme'
  if (defaultTheme.value) {
    queryParams.push(`nc-theme=${defaultTheme.value}`)
  }

  return `${encodeURI(baseUrl)}${queryParams.length > 0 ? `?${queryParams.join('&')}` : ''}`
}

const toggleViewShare = async () => {
  if (!activeView.value?.id) return

  if (activeView.value?.uuid) {
    // Get meta using base_id from activeView
    const meta = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)
    await $api.internal.postOperation(
      meta!.fk_workspace_id!,
      meta!.base_id!,
      {
        operation: 'shareViewDelete',
        viewId: activeView.value.id,
      },
      {},
    )

    activeView.value = { ...activeView.value, uuid: undefined, password: undefined }
  } else {
    // Get meta using base_id from activeView
    const meta = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)
    const response = await $api.internal.postOperation(
      meta!.fk_workspace_id!,
      meta!.base_id!,
      {
        operation: 'shareView',
        viewId: activeView.value.id,
      },
      {},
    )
    activeView.value = { ...activeView.value, ...(response as any) }

    if (activeView.value!.type === ViewTypes.KANBAN) {
      // extract grouping column meta
      const groupingFieldColumn = getMetaByKey(viewStore.activeView!.base_id, viewStore.activeView!.fk_model_id)?.columns!.find(
        (col: ColumnType) => col.id === ((viewStore.activeView!.view! as KanbanType).fk_grp_col_id! as string),
      )

      activeView.value!.meta = { ...activeView.value!.meta, groupingFieldColumn }

      await updateSharedView()
    }
  }
}

const toggleShare = async () => {
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

const allowSync = computed(() => !!(activeView.value as any)?.allow_sync)

const toggleAllowSync = async () => {
  if (!activeView.value?.id) return
  if (isUpdating.value.allowSync) return

  const next = !allowSync.value
  isUpdating.value.allowSync = true
  try {
    await viewStore.updateView(activeView.value.id, { allow_sync: next } as any)
    $e(`a:view:share:${next ? 'enable' : 'disable'}-allow-sync`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.allowSync = false
  }
}

async function saveAllowCSVDownload() {
  isUpdating.value.download = true
  try {
    await updateSharedView()
    $e(`a:view:share:${allowCSVDownload.value ? 'enable' : 'disable'}-csv-download`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  isUpdating.value.download = false
}

async function saveSurveyMode() {
  await updateSharedView()
  $e(`a:view:share:${surveyMode.value ? 'enable' : 'disable'}-survey-mode`)
}

async function saveTheme() {
  await updateSharedView()
  $e(`a:view:share:${viewTheme.value ? 'enable' : 'disable'}-theme`)
}

async function updateSharedView(arg?: { password?: string | null; custUrl?: string | null }) {
  if (!activeView.value?.meta) return false
  const meta = activeView.value.meta

  const custUrl = arg?.custUrl

  try {
    // Get meta using base_id from activeView
    const metaInfo = getMetaByKey(activeView.value.base_id, activeView.value.fk_model_id)
    const res = await $api.internal.postOperation(
      metaInfo!.fk_workspace_id!,
      metaInfo!.base_id!,
      {
        operation: 'shareViewUpdate',
        viewId: activeView.value.id!,
      },
      {
        meta,
        ...(arg?.password !== undefined ? { password: arg.password } : {}),
        ...(custUrl !== undefined ? { custom_url_path: custUrl ?? null } : {}),
      },
    )

    if (custUrl !== undefined) {
      activeView.value.fk_custom_url_id = res.fk_custom_url_id
    }
    return true
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    return false
  }
}

async function savePreFilledMode() {
  await updateSharedView()
}

const copyCustomUrl = async (custUrl = '') => {
  return await copy(
    `${appInfo.value.ncSiteUrl}/p/${encodeURIComponent(custUrl)}${
      preFillFormSearchParams.value && activeView.value?.type === ViewTypes.FORM ? `?${preFillFormSearchParams.value}` : ''
    }`,
  )
}
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-nc-border-gray-medium border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="text-nc-content-gray-emphasis font-medium">
          {{ $t('activity.enabledPublicViewing') }}
        </div>
        <a-switch
          v-if="!restrictedSharing"
          v-e="['c:share:view:enable:toggle']"
          :checked="isPublicShared"
          :disabled="isLocked"
          :loading="isUpdating.public"
          class="share-view-toggle !mt-0.25"
          data-testid="share-view-toggle"
          @click="toggleShare"
        />
        <div v-else class="text-nc-content-gray-muted">{{ $t('labels.sharingRestricted') }}</div>
      </div>
      <template v-if="isPublicShared">
        <div class="mt-0.5 border-t-1 border-nc-border-gray-light pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>

        <DlgShareAndCollaborateCustomUrl
          v-if="activeView && showEEFeatures"
          :id="activeView.fk_custom_url_id"
          :backend-url="appInfo.ncSiteUrl"
          :copy-custom-url="copyCustomUrl"
          :search-query="preFillFormSearchParams && activeView?.type === ViewTypes.FORM ? `?${preFillFormSearchParams}` : ''"
          :disabled="isReadOnly"
          @update-custom-url="(custUrl) => updateSharedView({ custUrl })"
        />
        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="flex text-nc-content-gray-extreme">
              {{ $t('activity.restrictAccessWithPassword') }}
            </div>
            <a-switch
              v-e="['c:share:view:password:toggle']"
              :checked="passwordProtected"
              :loading="isUpdating.password"
              class="share-password-toggle !mt-0.25"
              data-testid="share-password-toggle"
              size="small"
              :disabled="isReadOnly"
              @click="togglePasswordProtected"
            />
          </div>
          <Transition mode="out-in" name="layout">
            <div v-if="passwordProtected" class="flex flex-col gap-2 mt-2">
              <!-- Legacy plaintext password (pre-bcrypt migration) — show as-is so the owner can still read it -->
              <div v-if="isLegacyPlaintextPassword" class="flex items-center gap-2">
                <a-input-password
                  :value="activeView?.password"
                  class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
                  data-testid="nc-share-view-password-legacy"
                  size="small"
                  readonly
                  autocomplete="off"
                  name="nc-share-view-password-legacy"
                />
                <NcButton
                  v-e="['c:share:view:password:change-open']"
                  :disabled="isReadOnly"
                  data-testid="nc-share-view-password-change-btn"
                  size="small"
                  type="secondary"
                  @click="openChangePasswordModal"
                >
                  {{ $t('labels.changePassword') }}
                </NcButton>
              </div>
              <!-- Stored password (bcrypt-hashed): show masked locked state + dedicated change action -->
              <div v-else-if="hasStoredPassword" class="flex items-center gap-2">
                <div
                  class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium"
                  data-testid="nc-share-view-password-locked"
                >
                  <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle !w-3.5 !h-3.5" />
                  <span class="text-nc-content-gray-subtle text-bodySm tracking-widest">••••••••</span>
                </div>
                <NcButton
                  v-e="['c:share:view:password:change-open']"
                  :disabled="isReadOnly"
                  data-testid="nc-share-view-password-change-btn"
                  size="small"
                  type="secondary"
                  @click="openChangePasswordModal"
                >
                  {{ $t('labels.changePassword') }}
                </NcButton>
              </div>
              <!-- First-time entry: inline input + explicit Save button -->
              <div v-else class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <a-input-password
                    v-model:value="newPasswordDraft"
                    :placeholder="$t('placeholder.password.enter')"
                    class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
                    data-testid="nc-modal-share-view__password"
                    size="small"
                    type="password"
                    autocomplete="new-password"
                    name="nc-share-view-password-new"
                    :readonly="isReadOnly"
                    @press-enter="saveNewPassword(newPasswordDraft)"
                  />
                  <NcButton
                    v-e="['c:share:view:password:save-new']"
                    :disabled="!newPasswordDraft.trim() || isReadOnly"
                    :loading="isUpdating.password"
                    data-testid="nc-share-view-password-save-btn"
                    size="small"
                    type="primary"
                    @click="saveNewPassword(newPasswordDraft)"
                  >
                    {{ $t('general.save') }}
                  </NcButton>
                </div>
                <span class="text-bodySm text-nc-content-gray-subtle leading-snug">
                  {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
                </span>
              </div>
            </div>
          </Transition>
        </div>

        <DlgShareAndCollaborateChangeViewPassword
          v-if="isChangePasswordModalOpen && activeView"
          v-model:visible="isChangePasswordModalOpen"
          :loading="isUpdating.password"
          @save="onPasswordChanged"
        />
        <div
          v-if="
            activeView &&
            [ViewTypes.GRID, ViewTypes.KANBAN, ViewTypes.GALLERY, ViewTypes.MAP, ViewTypes.CALENDAR].includes(activeView.type)
          "
          class="flex flex-col justify-between gap-y-3 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md"
        >
          <div class="flex flex-row items-center justify-between">
            <div class="flex text-nc-content-gray-extreme">{{ $t('activity.allowDownload') }}</div>
            <a-switch
              v-model:checked="allowCSVDownload"
              v-e="['c:share:view:allow-csv-download:toggle']"
              :loading="isUpdating.download"
              class="public-password-toggle !mt-0.25"
              data-testid="share-download-toggle"
              size="small"
              :disabled="isReadOnly"
            />
          </div>
        </div>

        <div
          v-if="showEEFeatures && activeView?.type === ViewTypes.GRID"
          class="flex flex-col justify-between gap-y-3 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md"
        >
          <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_TABLE_SYNC">
            <template #default="{ click }">
              <div class="flex flex-row items-center justify-between">
                <div class="text-nc-content-gray-extreme flex items-center space-x-1">
                  <div>{{ $t('activity.allowSync') }}</div>
                  <LazyPaymentUpgradeBadge
                    :feature="PlanFeatureTypes.FEATURE_TABLE_SYNC"
                    :content="
                      $t('upgrade.upgradeToUseTableSyncSubtitle', {
                        plan: getPlanTitle(PlanTitles.BUSINESS),
                      })
                    "
                  />
                  <NcTooltip class="flex items-center">
                    <template #title>{{ $t('tooltip.allowSyncDescription') }}</template>
                    <GeneralIcon icon="info" class="flex-none text-gray-400 cursor-pointer" />
                  </NcTooltip>
                </div>
                <a-switch
                  v-e="['c:share:view:allow-sync:toggle']"
                  :checked="allowSync"
                  :loading="isUpdating.allowSync"
                  class="share-allow-sync-toggle !mt-0.25"
                  data-testid="share-allow-sync-toggle"
                  size="small"
                  :disabled="isReadOnly"
                  @click="
                    (value) => {
                      if (value && click(PlanFeatureTypes.FEATURE_TABLE_SYNC)) return

                      toggleAllowSync()
                    }
                  "
                />
              </div>
            </template>
          </PaymentUpgradeBadgeProvider>
        </div>

        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="flex text-nc-content-gray-extreme">
              {{ $t('labels.language') }}
            </div>
            <a-switch
              v-e="['c:share:view:language:toggle']"
              :checked="languageSet"
              :loading="isUpdating.language"
              class="share-language-toggle !mt-0.25"
              data-testid="share-language-toggle"
              size="small"
              :disabled="isReadOnly"
              @click="toggleLanguageSet"
            />
          </div>
          <Transition mode="out-in" name="layout">
            <div v-if="languageSet" class="flex gap-2 mt-2 w-2/3">
              <NcSelect
                v-model:value="withLanguage"
                data-testid="nc-modal-share-view__Language"
                :options="languageOptions"
                class="nc-modal-share-view-language-select w-full nc-select-shadow"
                :disabled="isReadOnly"
              />
            </div>
          </Transition>
        </div>

        <div
          v-if="activeView?.type === ViewTypes.FORM"
          class="flex flex-col justify-between gap-y-3 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md"
        >
          <div class="flex flex-row items-center justify-between">
            <div class="text-nc-content-gray-extreme flex items-center space-x-1">
              <div>
                {{ $t('activity.surveyMode') }}
              </div>
              <NcTooltip class="flex items-center">
                <template #title> {{ $t('tooltip.surveyFormInfo') }}</template>
                <GeneralIcon icon="info" class="flex-none text-gray-400 cursor-pointer"></GeneralIcon>
              </NcTooltip>
            </div>
            <a-switch
              v-model:checked="surveyMode"
              v-e="['c:share:view:surver-mode:toggle']"
              data-testid="nc-modal-share-view__surveyMode"
              size="small"
            >
            </a-switch>
          </div>
        </div>

        <div
          v-if="activeView?.type === ViewTypes.FORM"
          class="flex flex-col justify-between gap-y-3 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md"
        >
          <div class="flex flex-row items-center justify-between">
            <div class="text-nc-content-gray-extreme flex items-center space-x-1">
              <div>Default Theme</div>
              <NcTooltip class="flex items-center">
                <template #title
                  >Set the default theme (light or dark) for this shared form. Adds ?nc-theme=light or ?nc-theme=dark to the
                  URL.</template
                >
                <GeneralIcon icon="info" class="flex-none text-gray-400 cursor-pointer"></GeneralIcon>
              </NcTooltip>
            </div>
            <a-switch
              v-e="['c:share:view:theme:toggle']"
              :checked="themeSet"
              :loading="isUpdating.language"
              data-testid="nc-modal-share-view__themeToggle"
              size="small"
              :disabled="isReadOnly"
              @click="toggleThemeSet"
            />
          </div>
          <Transition mode="out-in" name="layout">
            <div v-if="themeSet" class="flex gap-2 mt-2 w-2/3">
              <NcSelect
                v-model:value="defaultTheme"
                data-testid="nc-modal-share-view__themeSelect"
                :options="themeOptions"
                class="nc-modal-share-view-theme-select w-full nc-select-shadow"
                :disabled="isReadOnly"
              />
            </div>
          </Transition>
        </div>

        <div
          v-if="activeView?.type === ViewTypes.FORM"
          class="nc-pre-filled-mode-wrapper flex flex-col justify-between gap-y-3 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md"
        >
          <div class="flex flex-row items-center justify-between">
            <div class="text-nc-content-gray-extreme flex items-center space-x-1">
              <div>
                {{ $t('activity.preFilledFields.title') }}
              </div>

              <NcTooltip class="flex items-center">
                <template #title>
                  <div class="text-center">
                    {{ $t('tooltip.preFillFormInfo') }}
                  </div>
                </template>
                <GeneralIcon icon="info" class="flex-none text-gray-400 cursor-pointer"></GeneralIcon>
              </NcTooltip>
            </div>
            <a-switch
              v-e="['c:share:view:surver-mode:toggle']"
              :checked="formPreFill.preFillEnabled"
              data-testid="nc-modal-share-view__preFill"
              size="small"
              @update:checked="handleChangeFormPreFill({ preFillEnabled: $event as boolean })"
            >
            </a-switch>
          </div>

          <a-radio-group
            v-if="formPreFill.preFillEnabled"
            :value="formPreFill.preFilledMode"
            class="nc-modal-share-view-preFillMode"
            data-testid="nc-modal-share-view__preFillMode"
            @update:value="handleChangeFormPreFill({ preFilledMode: $event })"
          >
            <a-radio v-for="mode of Object.values(PreFilledMode)" :key="mode" :value="mode">
              <div class="flex-1">{{ $t(`activity.preFilledFields.${mode}`) }}</div>
            </a-radio>
          </a-radio-group>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
.docs-share-public-toggle {
  height: 1.25rem !important;
  min-width: 2.4rem !important;
  width: 2.4rem !important;
  line-height: 1rem;

  .ant-switch-handle {
    height: 1rem !important;
    min-width: 1rem !important;
    line-height: 0.8rem !important;
  }
  .ant-switch-inner {
    height: 1rem !important;
    min-width: 1rem !important;
    line-height: 1rem !important;
  }
}

.nc-modal-share-view-preFillMode {
  @apply flex flex-col;

  .ant-radio-wrapper {
    @apply !m-0 !flex !items-center w-full px-2 py-1 rounded-lg hover:bg-nc-bg-gray-light;
    .ant-radio {
      @apply !top-0;
    }
    .ant-radio + span {
      @apply !flex !pl-4;
    }
  }
}

.nc-modal-share-view-language-select.ant-select,
.nc-modal-share-view-theme-select.ant-select {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>
