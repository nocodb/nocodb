<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
import { isString } from '@vueuse/core'
import tinycolor from 'tinycolor2'
import {
  computed,
  extractSdkResponseErrorMsg,
  message,
  projectThemeColors,
  ref,
  useCopy,
  useDashboard,
  useDebounceFn,
  useI18n,
  useNuxtApp,
  useProject,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  watch,
} from '#imports'
import type { SharedView } from '~/lib'

const { t } = useI18n()

const { view, $api } = useSmartsheetStoreOrThrow()

const { copy } = useCopy()

const { $e } = useNuxtApp()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useUIPermission()

const { isSharedBase } = useProject()

let showShareModel = $ref(false)

const passwordProtected = ref(false)

const shared = ref<SharedView>({ id: '', meta: {}, password: undefined })

const withRTL = computed({
  get: () => !!shared.value.meta.rtl,
  set: (rtl) => {
    shared.value.meta = { ...shared.value.meta, rtl }
    updateSharedViewMeta()
  },
})

const transitionDuration = computed({
  get: () => shared.value.meta.transitionDuration || 250,
  set: (duration) => {
    shared.value.meta = { ...shared.value.meta, transitionDuration: duration > 5000 ? 5000 : duration }
  },
})

const allowCSVDownload = computed({
  get: () => !!shared.value.meta.allowCSVDownload,
  set: (allow) => {
    shared.value.meta = { ...shared.value.meta, allowCSVDownload: allow }
    saveAllowCSVDownload()
  },
})

const surveyMode = computed({
  get: () => !!shared.value.meta.surveyMode,
  set: (survey) => {
    shared.value.meta = { ...shared.value.meta, surveyMode: survey }
    saveSurveyMode()
  },
})

const viewTheme = computed({
  get: () => !!shared.value.meta.withTheme,
  set: (withTheme) => {
    shared.value.meta = {
      ...shared.value.meta,
      withTheme,
    }
    saveTheme()
  },
})

const genShareLink = async () => {
  if (!view.value?.id) return

  const response = (await $api.dbViewShare.create(view.value.id)) as SharedView
  const meta = isString(response.meta) ? JSON.parse(response.meta) : response.meta

  shared.value = { ...response, meta }

  passwordProtected.value = !!shared.value.password && shared.value.password !== ''

  showShareModel = true
}

const sharedViewUrl = computed(() => {
  if (!shared.value) return

  let viewType
  switch (shared.value.type) {
    case ViewTypes.FORM:
      viewType = 'form'
      break
    case ViewTypes.KANBAN:
      viewType = 'kanban'
      break
    case ViewTypes.GALLERY:
      viewType = 'gallery'
      break
    default:
      viewType = 'view'
  }

  return encodeURI(`${dashboardUrl?.value}#/nc/${viewType}/${shared.value.uuid}`)
})

async function saveAllowCSVDownload() {
  await updateSharedViewMeta()
  $e(`a:view:share:${allowCSVDownload.value ? 'enable' : 'disable'}-csv-download`)
}

async function saveSurveyMode() {
  await updateSharedViewMeta()
  $e(`a:view:share:${surveyMode.value ? 'enable' : 'disable'}-survey-mode`)
}

async function saveTheme() {
  await updateSharedViewMeta()
  $e(`a:view:share:${viewTheme.value ? 'enable' : 'disable'}-theme`)
}

const saveTransitionDuration = useDebounceFn(updateSharedViewMeta, 1000, { maxWait: 2000 })

async function updateSharedViewMeta() {
  try {
    const meta = shared.value.meta && isString(shared.value.meta) ? JSON.parse(shared.value.meta) : shared.value.meta

    await $api.dbViewShare.update(shared.value.id, {
      meta,
    })

    message.success(t('msg.success.updated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  return true
}

const saveShareLinkPassword = async () => {
  try {
    await $api.dbViewShare.update(shared.value.id, {
      password: shared.value.password,
    })
    // Successfully updated
    message.success(t('msg.success.updated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:view:share:enable-pwd')
}

function onChangeTheme(color: string) {
  const tcolor = tinycolor(color)

  if (tcolor.isValid()) {
    const complement = tcolor.complement()
    shared.value.meta.theme = {
      primaryColor: color,
      accentColor: complement.toHex8String(),
    }

    saveTheme()
  }
}

const copyLink = async () => {
  if (sharedViewUrl.value) {
    await copy(sharedViewUrl.value)

    // Copied to clipboard
    message.success(t('msg.info.copiedToClipboard'))
  }
}

watch(passwordProtected, (value) => {
  if (!value) {
    shared.value.password = ''
    saveShareLinkPassword()
  }
})
</script>

<template>
  <div>
    <a-button
      v-if="isUIAllowed('share-view') && !isSharedBase"
      v-e="['c:view:share']"
      outlined
      class="nc-btn-share-view nc-toolbar-btn"
      @click="genShareLink"
    >
      <div class="flex items-center gap-1">
        <MdiOpenInNew />
        <!-- Share View -->
        <span class="!text-sm font-weight-normal"> {{ $t('activity.shareView') }}</span>
      </div>
    </a-button>

    <!-- This view is shared via a private link -->
    <a-modal
      v-model:visible="showShareModel"
      size="small"
      :title="$t('msg.info.privateLink')"
      :footer="null"
      width="min(100vw,720px)"
      wrap-class-name="nc-modal-share-view"
    >
      <div
        data-testid="nc-modal-share-view__link"
        class="share-link-box !bg-primary !bg-opacity-5 ring-1 ring-accent ring-opacity-100"
      >
        <div class="flex-1 h-min text-xs">{{ sharedViewUrl }}</div>

        <a v-e="['c:view:share:open-url']" :href="sharedViewUrl" target="_blank">
          <MdiOpenInNew class="text-sm text-gray-500 mt-2" />
        </a>

        <MdiContentCopy v-e="['c:view:share:copy-url']" class="text-gray-500 text-sm cursor-pointer" @click="copyLink" />
      </div>

      <div class="px-1 mt-2 flex flex-col gap-3">
        <!-- todo: i18n -->
        <div class="text-gray-500 border-b-1">Options</div>

        <div class="px-1 flex flex-col gap-2">
          <div>
            <!-- Survey Mode; todo: i18n -->
            <a-checkbox
              v-if="shared.type === ViewTypes.FORM"
              v-model:checked="surveyMode"
              data-testid="nc-modal-share-view__survey-mode"
              class="!text-sm"
            >
              Use Survey Mode
            </a-checkbox>

            <Transition name="layout" mode="out-in">
              <div v-if="surveyMode" class="flex flex-col justify-center pl-6">
                <a-form-item class="!my-1" :has-feedback="false" name="transitionDuration">
                  <template #label>
                    <div class="text-xs">Transition duration (in MS)</div>
                  </template>
                  <a-input
                    v-model:value="transitionDuration"
                    data-testid="nc-form-signin__email"
                    size="small"
                    class="!w-32"
                    type="number"
                    @change="saveTransitionDuration"
                  />
                </a-form-item>
              </div>
            </Transition>
          </div>

          <div>
            <!-- todo: i18n -->
            <a-checkbox
              v-if="shared.type === ViewTypes.FORM"
              v-model:checked="viewTheme"
              data-testid="nc-modal-share-view__with-theme"
              class="!text-sm"
            >
              Use Theme
            </a-checkbox>

            <Transition name="layout" mode="out-in">
              <div v-if="viewTheme" class="flex pl-6">
                <LazyGeneralColorPicker
                  data-testid="nc-modal-share-view__theme-picker"
                  class="!p-0"
                  :model-value="shared.meta.theme?.primaryColor"
                  :colors="projectThemeColors"
                  :row-size="9"
                  :advanced="false"
                  @input="onChangeTheme"
                />
              </div>
            </Transition>
          </div>

          <div>
            <!-- use RTL orientation in form - todo: i18n -->
            <a-checkbox
              v-if="shared.type === ViewTypes.FORM"
              v-model:checked="withRTL"
              data-testid="nc-modal-share-view__locale"
              class="!text-sm"
            >
              <!-- todo i18n -->
              RTL Orientation
            </a-checkbox>
          </div>

          <div>
            <!-- Password Protection -->
            <a-checkbox
              v-model:checked="passwordProtected"
              data-testid="nc-modal-share-view__with-password"
              class="!text-sm !my-1"
            >
              {{ $t('msg.info.beforeEnablePwd') }}
            </a-checkbox>

            <Transition name="layout" mode="out-in">
              <div v-if="passwordProtected" class="pl-6 flex gap-2 mt-2 mb-4">
                <a-input
                  v-model:value="shared.password"
                  data-testid="nc-modal-share-view__password"
                  size="small"
                  class="!text-xs max-w-[250px]"
                  type="password"
                  :placeholder="$t('placeholder.password.enter')"
                />

                <a-button
                  data-testid="nc-modal-share-view__save-password"
                  size="small"
                  class="!text-xs"
                  @click="saveShareLinkPassword"
                >
                  {{ $t('placeholder.password.save') }}
                </a-button>
              </div>
            </Transition>
          </div>

          <div>
            <!-- Allow Download -->
            <a-checkbox
              v-if="
                shared &&
                (shared.type === ViewTypes.GRID || shared.type === ViewTypes.KANBAN || shared.type === ViewTypes.GALLERY)
              "
              v-model:checked="allowCSVDownload"
              data-testid="nc-modal-share-view__with-csv-download"
              class="!text-sm"
            >
              {{ $t('labels.downloadAllowed') }}
            </a-checkbox>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.share-link-box {
  @apply flex p-2 w-full items-center items-center gap-1 bg-gray-100 rounded;
}

:deep(.ant-collapse-header) {
  @apply !text-xs;
}
</style>
