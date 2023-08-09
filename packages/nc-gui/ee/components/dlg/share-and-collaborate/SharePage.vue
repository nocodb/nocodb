<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import tinycolor from 'tinycolor2'

interface Emits {
  (event: 'close'): void
}

const emits = defineEmits<Emits>()

const { view: _view, $api } = useSmartsheetStoreOrThrow()
const { $e } = useNuxtApp()

const { project } = storeToRefs(useProject())
const { isProjectPublic } = storeToRefs(useShare())
const { openedPage, nestedPublicParentPage, nestedPagesOfProjects } = storeToRefs(useDocStore())
const { updatePage, nestedUrl } = useDocStore()

const { dashboardUrl } = useDashboard()

const isUpdating = ref({
  public: false,
  password: false,
  download: false,
})

const page = computed(() => openedPage.value ?? nestedPagesOfProjects.value[project.value.id!]?.[0])
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
  if (project.value?.type === NcProjectType.DOCS) {
    return nestedUrl({ projectId: project.value.id!, id: page.value!.id!, completeUrl: true, publicUrl: true }) ?? ''
  } else {
    return sharedViewUrl() ?? ''
  }
})

const passwordProtected = computed(() => {
  return !!(activeView.value?.password !== undefined && activeView.value?.password !== null)
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

  return encodeURI(`${dashboardUrl?.value}#/nc/${viewType}/${activeView.value.uuid}`)
}

const isNestedParent = computed(() => nestedPublicParentPage.value?.id === page.value!.id)

const togglePagePublishedState = async () => {
  let pageUpdates
  if (page.value!.is_published) {
    pageUpdates = {
      is_published: false,
    }
  } else {
    pageUpdates = {
      is_published: true,
    }
  }

  await updatePage({
    pageId: page.value!.id!,
    page: pageUpdates,
    projectId: project.value.id!,
  })
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
      const { groupingFieldColumn } = useKanbanViewStoreOrThrow()
      activeView.value!.meta = { ...activeView.value!.meta, groupingFieldColumn: groupingFieldColumn.value }
      await updateSharedView()
    }
  }
}

const toggleShare = async () => {
  if (isUpdating.value.public) return

  isUpdating.value.public = true
  try {
    if (project.value?.type === NcProjectType.DOCS) {
      return await togglePagePublishedState()
    } else {
      return await toggleViewShare()
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.public = false
  }
}

const openParentPageLink = async () => {
  await navigateTo(
    nestedUrl({
      projectId: project.value.id!,
      id: nestedPublicParentPage.value!.id!,
    }),
  )
  emits('close')
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
  if (project.value.type === NcProjectType.DASHBOARD) {
    return isProjectPublic.value || !!page.value?.is_published
  } else {
    return !!activeView.value?.uuid
  }
})

const isPublicShareDisabled = computed(() => {
  if (project.value.type === NcProjectType.DASHBOARD) {
    return isProjectPublic.value || (page.value.is_published && !isNestedParent)
  } else {
    return false
  }
})
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-gray-100 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="flex" :style="{ fontWeight: 500 }">Enable public viewing</div>
        <a-switch
          data-testid="share-view-toggle"
          :checked="isPublicShared"
          :loading="isUpdating.public"
          class="share-view-toggle !mt-0.25"
          :disabled="isPublicShareDisabled"
          @click="toggleShare"
        />
      </div>
      <template v-if="project.type === NcProjectType.DOCS">
        <div v-if="isProjectPublic" class="flex text-xs items-center">
          Shared through project
          <span class="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-md capitalize">{{ project.title }}</span>
        </div>
        <div v-else-if="page.is_published && !isNestedParent" class="flex text-xs">
          Shared through page
          <span
            class="text-blue-600 underline pl-1 cursor-pointer mr-1"
            :data-testid="`docs-share-page-parent-share-${nestedPublicParentPage?.title}`"
            @click="openParentPageLink"
          >
            {{ nestedPublicParentPage?.title }}</span
          >
        </div>
      </template>
      <template v-if="isPublicShared">
        <div class="mt-0.5 border-t-1 border-gray-75 pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>
        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-gray-50 rounded-md">
          <div class="flex flex-row justify-between">
            <div class="flex text-black">Restrict access with password</div>
            <a-switch
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
            <div class="flex text-black">Allow Download</div>
            <a-switch
              v-model:checked="allowCSVDownload"
              data-testid="share-download-toggle"
              :loading="isUpdating.download"
              class="public-password-toggle !mt-0.25"
            />
          </div>

          <div v-if="activeView?.type === ViewTypes.FORM" class="flex flex-row justify-between">
            <!-- use RTL orientation in form - todo: i18n -->
            <div class="text-black">Survey Mode</div>
            <a-switch v-model:checked="surveyMode" data-testid="nc-modal-share-view__surveyMode">
              <!-- todo i18n -->
            </a-switch>
          </div>
          <div v-if="activeView?.type === ViewTypes.FORM" class="flex flex-row justify-between">
            <!-- use RTL orientation in form - todo: i18n -->
            <div class="text-black">RTL Orientation</div>
            <a-switch v-model:checked="withRTL" data-testid="nc-modal-share-view__RTL">
              <!-- todo i18n -->
            </a-switch>
          </div>
          <div v-if="activeView?.type === ViewTypes.FORM" class="flex flex-col justify-between gap-y-1 bg-gray-50 rounded-md">
            <!-- todo: i18n -->
            <div class="flex flex-row justify-between">
              <div class="text-black">Use Theme</div>
              <a-switch
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
                  :colors="projectThemeColors"
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
