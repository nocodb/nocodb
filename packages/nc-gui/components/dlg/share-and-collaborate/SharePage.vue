<script lang="ts" setup>
import type { ColumnType, KanbanType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { useMetas } from '#imports'

const { view: _view, $api } = useSmartsheetStoreOrThrow()
const { $e } = useNuxtApp()
const { getBaseUrl, appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const viewStore = useViewsStore()

const { metas } = useMetas()

const workspaceStore = useWorkspace()

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

const url = computed(() => {
  return sharedViewUrl() ?? ''
})

const passwordProtectedLocal = ref(false)

const passwordProtected = computed(() => {
  return !!activeView.value?.password || passwordProtectedLocal.value
})

const password = computed({
  get: () => (passwordProtected.value ? activeView.value?.password ?? '' : ''),
  set: async (value) => {
    if (!activeView.value) return

    activeView.value = { ...(activeView.value as any), password: passwordProtected.value ? value : null }

    updateSharedView()
  },
})

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
  passwordProtectedLocal.value = !passwordProtected.value
  if (!activeView.value) return
  if (isUpdating.value.password) return

  isUpdating.value.password = true
  try {
    if (passwordProtected.value) {
      activeView.value = { ...(activeView.value as any), password: null }
    } else {
      activeView.value = { ...(activeView.value as any), password: '' }
    }

    await updateSharedView()
  } finally {
    isUpdating.value.password = false
  }
}

const withRTL = computed({
  get: () => {
    if (!activeView.value?.meta) return false

    if (typeof activeView.value?.meta === 'string') {
      activeView.value.meta = JSON.parse(activeView.value.meta)
    }

    return !!(activeView.value?.meta as any)?.rtl
  },
  set: (rtl) => {
    if (!activeView.value?.meta) return

    if (typeof activeView.value?.meta === 'string') {
      activeView.value.meta = JSON.parse(activeView.value.meta)
    }

    activeView.value.meta = { ...(activeView.value.meta as any), rtl }
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

function sharedViewUrl() {
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
    default:
      viewType = 'view'
  }

  // get base url for workspace
  const baseUrl = getBaseUrl(workspaceStore.activeWorkspaceId)

  let dashboardUrl1 = dashboardUrl.value
  if (baseUrl) {
    dashboardUrl1 = `${baseUrl}${appInfo.value?.dashboardPath}`
  }

  return encodeURI(`${dashboardUrl1}#/nc/${viewType}/${activeView.value.uuid}`)
}

const toggleViewShare = async () => {
  if (!activeView.value?.id) return

  if (activeView.value?.uuid) {
    await $api.dbViewShare.delete(activeView.value.id)

    activeView.value = { ...activeView.value, uuid: undefined, password: undefined }
  } else {
    const response = await $api.dbViewShare.create(activeView.value.id)
    activeView.value = { ...activeView.value, ...(response as any) }

    if (activeView.value!.type === ViewTypes.KANBAN) {
      // extract grouping column meta
      const groupingFieldColumn = metas.value[viewStore.activeView!.fk_model_id].columns!.find(
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
    if (!activeView.value?.meta) return
    const meta = activeView.value.meta

    await $api.dbViewShare.update(activeView.value.id!, {
      meta,
      password: activeView.value.password,
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  return true
}

function onChangeTheme(color: string) {
  if (!activeView.value?.meta) return

  const tcolor = tinycolor(color)

  if (tcolor.isValid()) {
    const complement = tcolor.complement()
    activeView.value.meta.theme = {
      primaryColor: color,
      accentColor: complement.toHex8String(),
    }

    saveTheme()
  }
}

const isPublicShared = computed(() => {
  return !!activeView.value?.uuid
})

const isPublicShareDisabled = computed(() => {
  return false
})
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="flex" :style="{ fontWeight: 500 }">{{ $t('activity.enabledPublicViewing') }}</div>
        <a-switch
          v-e="['c:share:view:enable:toggle']"
          data-testid="share-view-toggle"
          :checked="isPublicShared"
          :loading="isUpdating.public"
          class="share-view-toggle !mt-0.25"
          :disabled="isPublicShareDisabled"
          @click="toggleShare"
        />
      </div>
      <template v-if="isPublicShared">
        <div class="mt-0.5 border-t-1 border-gray-100 pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>
        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-gray-50 rounded-md">
          <div class="flex flex-row justify-between">
            <div class="flex text-black">{{ $t('activity.restrictAccessWithPassword') }}</div>
            <a-switch
              v-e="['c:share:view:password:toggle']"
              data-testid="share-password-toggle"
              :checked="passwordProtected"
              :loading="isUpdating.password"
              class="share-password-toggle !mt-0.25"
              @click="togglePasswordProtected"
            />
          </div>
          <Transition name="layout" mode="out-in">
            <div v-if="passwordProtected" class="flex gap-2 mt-2 w-2/3">
              <a-input-password
                v-model:value="password"
                data-testid="nc-modal-share-view__password"
                class="!rounded-lg !py-1 !bg-white"
                size="small"
                type="password"
                :placeholder="$t('placeholder.password.enter')"
              />
            </div>
          </Transition>
        </div>
        <div class="flex flex-col justify-between gap-y-3 mt-1 py-2 px-3 bg-gray-50 rounded-md">
          <div
            v-if="
              activeView &&
              (activeView.type === ViewTypes.GRID ||
                activeView.type === ViewTypes.KANBAN ||
                activeView.type === ViewTypes.GALLERY ||
                activeView.type === ViewTypes.MAP)
            "
            class="flex flex-row justify-between"
          >
            <div class="flex text-black">{{ $t('activity.allowDownload') }}</div>
            <a-switch
              v-model:checked="allowCSVDownload"
              v-e="['c:share:view:allow-csv-download:toggle']"
              data-testid="share-download-toggle"
              :loading="isUpdating.download"
              class="public-password-toggle !mt-0.25"
            />
          </div>

          <div v-if="activeView?.type === ViewTypes.FORM" class="flex flex-row justify-between">
            <div class="text-black">{{ $t('activity.surveyMode') }}</div>
            <a-switch
              v-model:checked="surveyMode"
              v-e="['c:share:view:surver-mode:toggle']"
              data-testid="nc-modal-share-view__surveyMode"
            >
            </a-switch>
          </div>
          <div v-if="activeView?.type === ViewTypes.FORM && isEeUI" class="flex flex-row justify-between">
            <div class="text-black">{{ $t('activity.rtlOrientation') }}</div>
            <a-switch
              v-model:checked="withRTL"
              v-e="['c:share:view:rtl-orientation:toggle']"
              data-testid="nc-modal-share-view__RTL"
            >
            </a-switch>
          </div>
          <div v-if="activeView?.type === ViewTypes.FORM" class="flex flex-col justify-between gap-y-1 bg-gray-50 rounded-md">
            <div class="flex flex-row justify-between">
              <div class="text-black">{{ $t('activity.useTheme') }}</div>
              <a-switch
                v-e="['c:share:view:theme:toggle']"
                data-testid="share-theme-toggle"
                :checked="viewTheme"
                :loading="isUpdating.password"
                class="share-theme-toggle !mt-0.25"
                @click="viewTheme = !viewTheme"
              />
            </div>

            <Transition name="layout" mode="out-in">
              <div v-if="viewTheme" class="flex -ml-1">
                <LazyGeneralColorPicker
                  data-testid="nc-modal-share-view__theme-picker"
                  class="!p-0 !bg-inherit"
                  :model-value="activeView?.meta?.theme?.primaryColor"
                  :colors="baseThemeColors"
                  :row-size="9"
                  :advanced="false"
                  @input="onChangeTheme"
                />
              </div>
            </Transition>
          </div>
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
</style>
