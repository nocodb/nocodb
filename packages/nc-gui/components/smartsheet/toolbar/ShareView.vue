<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
import { isString } from '@vueuse/core'
import {
  computed,
  extractSdkResponseErrorMsg,
  message,
  ref,
  useCopy,
  useDashboard,
  useI18n,
  useNuxtApp,
  useProject,
  useSmartsheetStoreOrThrow,
  useTheme,
  useUIPermission,
  watch,
} from '#imports'
import type { ThemeConfig } from '~/lib'

interface SharedViewMeta extends Record<string, any> {
  surveyMode?: boolean
  theme?: Partial<ThemeConfig>
  allowCSVDownload?: boolean
}

interface SharedView {
  uuid?: string
  id: string
  password?: string
  type?: ViewTypes
  meta: SharedViewMeta
}

const { theme } = useTheme()

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
  get: () => !!shared.value.meta.theme,
  set: (hasTheme) => {
    shared.value.meta = { ...shared.value.meta, theme: hasTheme ? { ...theme.value } : undefined }
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
    default:
      viewType = 'view'
  }

  return `${dashboardUrl?.value}#/nc/${viewType}/${shared.value.uuid}`
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
      <div class="share-link-box nc-share-link-box !bg-primary !bg-opacity-5 ring-1 ring-accent ring-opacity-100">
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
            <a-checkbox v-if="shared.type === ViewTypes.FORM" v-model:checked="surveyMode" class="!text-xs">
              Use Survey Mode
            </a-checkbox>
          </div>

          <div>
            <!-- todo: i18n -->
            <a-checkbox v-model:checked="viewTheme" class="!text-xs"> Use Theme </a-checkbox>
          </div>

          <div>
            <!-- Password Protection -->
            <a-checkbox v-model:checked="passwordProtected" class="!text-xs">{{ $t('msg.info.beforeEnablePwd') }} </a-checkbox>

            <div v-if="passwordProtected" class="ml-6 flex gap-2 mt-2 mb-4">
              <a-input
                v-model:value="shared.password"
                size="small"
                class="!text-xs max-w-[250px]"
                type="password"
                :placeholder="$t('placeholder.password.enter')"
              />

              <a-button size="small" class="!text-xs" @click="saveShareLinkPassword">
                {{ $t('placeholder.password.save') }}
              </a-button>
            </div>
          </div>

          <div>
            <!-- Allow Download -->
            <a-checkbox v-if="shared && shared.type === ViewTypes.GRID" v-model:checked="allowCSVDownload" class="!text-xs">
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
