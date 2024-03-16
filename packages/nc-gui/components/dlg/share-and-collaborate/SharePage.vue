<script lang="ts" setup>
import type { ColumnType, KanbanType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { PreFilledMode, iconMap, message, storeToRefs, useBase, useMetas } from '#imports'

const { view: _view, $api } = useSmartsheetStoreOrThrow()
const { $e } = useNuxtApp()
const { getBaseUrl, appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const viewStore = useViewsStore()

const { viewsByTable } = storeToRefs(viewStore)

const { showShareModal } = storeToRefs(useShare())

const baseStore = useBase()

const { navigateToProjectPage } = baseStore

const { metas } = useMetas()

const workspaceStore = useWorkspace()

const isLocked = inject(IsLockedInj, ref(false))

const isUpdating = ref({
  public: false,
  password: false,
  download: false,
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

const viewsInTable = computed({
  get: () => {
    if (!activeView.value) return []
    return viewsByTable.value.get(activeView.value?.fk_model_id) || []
  },
  set: (val) => {
    viewsByTable.value.set(activeView.value?.fk_model_id, val)
  },
})

const selectedViewId = ref<string | undefined>(activeView.value?.id)

watch(activeView, (val) => {
  selectedViewId.value = val?.id
})

const selectedView = computed<(ViewType & { meta: object & Record<string, any> }) | undefined>({
  get: () => {
    if (!selectedViewId.value) return
    return viewsInTable.value.find((v) => v.id === selectedViewId.value)
  },
  set: (val) => {
    viewsInTable.value = viewsInTable.value.map((v) => (v.id === selectedViewId.value ? val : v))
  },
})

const isPublicShared = computed(() => {
  return !!selectedView.value?.uuid
})

const url = computed(() => {
  return sharedViewUrl() ?? ''
})

const passwordProtectedLocal = ref(false)

const passwordProtected = computed(() => {
  return !!selectedView.value?.password || passwordProtectedLocal.value
})

const password = computed({
  get: () => (passwordProtected.value ? selectedView.value?.password ?? '' : ''),
  set: async (value) => {
    if (!selectedView.value) return

    selectedView.value = { ...(selectedView.value as any), password: passwordProtected.value ? value : null }

    updateSharedView()
  },
})

const viewTheme = computed({
  get: () => !!selectedView.value?.meta.withTheme,
  set: (withTheme) => {
    if (!selectedView.value?.meta) return

    selectedView.value.meta = {
      ...selectedView.value.meta,
      withTheme,
    }
    saveTheme()
  },
})

const togglePasswordProtected = async () => {
  passwordProtectedLocal.value = !passwordProtected.value
  if (!selectedView.value) return
  if (isUpdating.value.password) return

  isUpdating.value.password = true
  try {
    if (passwordProtected.value) {
      selectedView.value = { ...(selectedView.value as any), password: null }
    } else {
      selectedView.value = { ...(selectedView.value as any), password: '' }
    }

    await updateSharedView()
  } finally {
    isUpdating.value.password = false
  }
}

const withRTL = computed({
  get: () => {
    if (!selectedView.value?.meta) return false

    if (typeof selectedView.value?.meta === 'string') {
      selectedView.value.meta = JSON.parse(selectedView.value.meta)
    }

    return !!(selectedView.value?.meta as any)?.rtl
  },
  set: (rtl) => {
    if (!selectedView.value?.meta) return

    if (typeof selectedView.value?.meta === 'string') {
      selectedView.value.meta = JSON.parse(selectedView.value.meta)
    }

    selectedView.value.meta = { ...(selectedView.value.meta as any), rtl }
    updateSharedView()
  },
})

const allowCSVDownload = computed({
  get: () => !!(selectedView.value?.meta as any)?.allowCSVDownload,
  set: async (allow) => {
    if (!selectedView.value?.meta) return

    isUpdating.value.download = true

    try {
      selectedView.value.meta = { ...selectedView.value.meta, allowCSVDownload: allow }
      await saveAllowCSVDownload()
    } finally {
      isUpdating.value.download = false
    }
  },
})

const surveyMode = computed({
  get: () => !!selectedView.value?.meta.surveyMode,
  set: (survey) => {
    if (!selectedView.value?.meta) return

    selectedView.value.meta = { ...selectedView.value.meta, surveyMode: survey }
    saveSurveyMode()
  },
})

const formPreFill = computed({
  get: () => ({
    preFillEnabled: parseProp(selectedView.value?.meta)?.preFillEnabled ?? false,
    preFilledMode: parseProp(selectedView.value?.meta)?.preFilledMode || PreFilledMode.Default,
  }),
  set: (value) => {
    if (!selectedView.value?.meta) return

    if (formPreFill.value.preFillEnabled !== value.preFillEnabled) {
      $e(`a:view:share:prefilled-mode-${value.preFillEnabled ? 'enabled' : 'disabled'}`)
    }

    if (formPreFill.value.preFilledMode !== value.preFilledMode) {
      $e(`a:view:share:${value.preFilledMode}-prefilled-mode`)
    }

    selectedView.value.meta = {
      ...selectedView.value.meta,
      ...value,
    }
    savePreFilledMode()
  },
})

const handleChangeFormPreFill = (value: { preFillEnabled?: boolean; preFilledMode?: PreFilledMode }) => {
  formPreFill.value = {
    ...formPreFill.value,
    ...value,
  }
}

function sharedViewUrl() {
  if (!selectedView.value) return

  let viewType
  switch (selectedView.value.type) {
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
    default:
      viewType = 'view'
  }

  // get base url for workspace
  const baseUrl = getBaseUrl(workspaceStore.activeWorkspaceId)

  let dashboardUrl1 = dashboardUrl.value
  if (baseUrl) {
    dashboardUrl1 = `${baseUrl}${appInfo.value?.dashboardPath}`
  }

  return encodeURI(
    `${dashboardUrl1}#/nc/${viewType}/${selectedView.value.uuid}${surveyMode.value ? '/survey' : ''}${
      viewStore.preFillFormSearchParams && formPreFill.value.preFillEnabled ? `?${viewStore.preFillFormSearchParams}` : ''
    }`,
  )
}

const toggleViewShare = async () => {
  if (!selectedView.value?.id) return

  if (selectedView.value?.uuid) {
    await $api.dbViewShare.delete(selectedView.value.id)

    selectedView.value = { ...selectedView.value, uuid: undefined, password: undefined }
  } else {
    const response = await $api.dbViewShare.create(selectedView.value.id)
    selectedView.value = { ...selectedView.value, ...(response as any) }

    if (selectedView.value!.type === ViewTypes.KANBAN) {
      // extract grouping column meta
      const groupingFieldColumn = metas.value[selectedView.value!.fk_model_id].columns!.find(
        (col: ColumnType) => col.id === ((selectedView.value.view! as KanbanType).fk_grp_col_id! as string),
      )

      selectedView.value!.meta = { ...selectedView.value!.meta, groupingFieldColumn }

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

async function updateSharedView() {
  try {
    if (!selectedView.value?.meta) return
    const meta = selectedView.value.meta

    await $api.dbViewShare.update(selectedView.value.id!, {
      meta,
      password: selectedView.value.password,
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  return true
}

async function savePreFilledMode() {
  await updateSharedView()
}

const openManageAccess = async () => {
  try {
    await navigateToProjectPage({ page: 'collaborator' })
    showShareModal.value = false
  } catch (e) {
    console.error(e)
    message.error('Failed to open manage access')
  }
}
</script>

<template>
  <div class="flex flex-col !h-80 justify-between">
    <div class="flex flex-col p-3 border-gray-200 border-1 rounded-lg gap-y-2">
      <div class="flex flex-row items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-gray-900 font-medium">{{ $t('activity.enabledPublicViewing') }}</span>

          <NcSelect v-model:value="selectedViewId" class="w-48" size="medium">
            <a-select-option v-for="view in viewsInTable" :key="view.id" :value="view.id">
              <div class="flex items-center w-full justify-between w-full gap-2">
                <GeneralViewIcon :meta="view" class="!text-md mt-0.5" />
                <span class="truncate !w-36 flex-1 capitalize">{{ view.title }}</span>
                <component
                  :is="iconMap.check"
                  v-if="view.id === selectedViewId"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </NcSelect>
        </div>
        <a-switch
          v-e="['c:share:view:enable:toggle']"
          size="small"
          :checked="isPublicShared"
          :disabled="isLocked"
          :loading="isUpdating.public"
          class="share-view-toggle !mt-0.25"
          data-testid="share-view-toggle"
          @change="toggleShare"
        />
      </div>

      <div v-if="isPublicShared" class="space-y-3">
        <GeneralCopyUrl v-model:url="url" class="w-[34.625rem]" />
        <div class="flex items-center gap-3 h-8 justify-between">
          <div class="flex flex-row gap-3 items-center">
            <a-switch
              v-e="['c:share:view:password:toggle']"
              :checked="passwordProtected"
              :loading="isUpdating.password"
              class="share-password-toggle !mt-0.25"
              data-testid="share-password-toggle"
              size="small"
              @change="togglePasswordProtected"
            />
            <div class="flex text-black">{{ $t('activity.restrictAccessWithPassword') }}</div>
          </div>
          <a-input-password
            v-if="passwordProtected"
            v-model:value="password"
            :placeholder="$t('placeholder.password.enter')"
            class="!rounded-lg flex-1 !focus:border-brand-500 !w-72 !focus:ring-0 !focus:shadow-none !border-gray-200 !py-1 !bg-white"
            data-testid="nc-modal-share-view__password"
            size="small"
            type="password"
          />
        </div>

        <div
          v-if="
            selectedView &&
            [ViewTypes.GRID, ViewTypes.KANBAN, ViewTypes.GALLERY, ViewTypes.MAP, ViewTypes.CALENDAR].includes(selectedView.type)
          "
          class="flex flex-row items-center gap-3"
        >
          <a-switch
            v-model:checked="allowCSVDownload"
            v-e="['c:share:view:allow-csv-download:toggle']"
            :loading="isUpdating.download"
            class="public-password-toggle !mt-0.25"
            data-testid="share-download-toggle"
            size="small"
          />
          <div class="flex text-black">{{ $t('activity.allowDownload') }}</div>
        </div>

        <template v-if="selectedView?.type === ViewTypes.FORM">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <a-switch
                v-model:checked="surveyMode"
                v-e="['c:share:view:surver-mode:toggle']"
                data-testid="nc-modal-share-view__surveyMode"
                size="small"
              >
              </a-switch>
              {{ $t('activity.surveyMode') }}
            </div>
            <NcTooltip>
              <template #title>{{ $t('tooltip.surveyFormInfo') }} </template>
              <component :is="iconMap.info" class="text-gray-500" />
            </NcTooltip>
          </div>

          <div v-if="!isEeUI" class="flex flex-row items-center gap-3">
            <a-switch
              v-model:checked="withRTL"
              v-e="['c:share:view:rtl-orientation:toggle']"
              data-testid="nc-modal-share-view__RTL"
              size="small"
            >
            </a-switch>
            <div class="text-black">{{ $t('activity.rtlOrientation') }}</div>
          </div>
          <div class="flex items-center h-8 justify-between">
            <div class="flex items-center gap-3">
              <a-switch
                v-e="['c:share:view:surver-mode:toggle']"
                :checked="formPreFill.preFillEnabled"
                data-testid="nc-modal-share-view__preFill"
                size="small"
                @update:checked="handleChangeFormPreFill({ preFillEnabled: $event as boolean })"
              >
              </a-switch>
              {{ $t('activity.preFilledFields.title') }}

              <NcSelect
                v-if="formPreFill.preFillEnabled"
                v-model:value="formPreFill.preFilledMode"
                class="w-48"
                @change="handleChangeFormPreFill"
              >
                <a-select-option
                  v-for="op of Object.values(PreFilledMode).map((v) => {
                    return { label: $t(`activity.preFilledFields.${v}`), value: v }
                  })"
                  :key="op.value"
                  :value="op.value"
                >
                  <div class="flex items-center w-full justify-between w-full gap-2">
                    <div class="truncate flex-1 capitalize">{{ op.label }}</div>
                    <component
                      :is="iconMap.check"
                      v-if="formPreFill.preFilledMode === op.value"
                      id="nc-selected-item-icon"
                      class="text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </NcSelect>
            </div>
            <NcTooltip>
              <template #title>{{ $t('tooltip.preFillFormInfo') }} </template>
              <component :is="iconMap.info" class="text-gray-500" />
            </NcTooltip>
          </div>
        </template>
      </div>
    </div>

    <div class="flex gap-2 items-end justify-end">
      <NcButton type="secondary" @click="openManageAccess">
        {{ $t('activity.manageAccess') }}
      </NcButton>
      <NcButton type="secondary" @click="showShareModal = false">
        {{ $t('general.finish') }}
      </NcButton>
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
</style>
