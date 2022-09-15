<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
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
  useUIPermission,
  watch,
} from '#imports'

const { t } = useI18n()

const { view, $api } = useSmartsheetStoreOrThrow()

const { copy } = useCopy()

const { $e } = useNuxtApp()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useUIPermission()

const { isSharedBase } = useProject()

let showShareModel = $ref(false)

const passwordProtected = ref(false)

const surveyMode = ref(false)

const shared = ref()

const allowCSVDownload = computed({
  get() {
    return !!(shared.value?.meta && typeof shared.value.meta === 'string' ? JSON.parse(shared.value.meta) : shared.value.meta)
      ?.allowCSVDownload
  },
  set(allow) {
    shared.value.meta = { allowCSVDownload: allow }
    saveAllowCSVDownload()
  },
})

const genShareLink = async () => {
  if (!view.value?.id) return

  shared.value = await $api.dbViewShare.create(view.value.id)
  shared.value.meta =
    shared.value.meta && typeof shared.value.meta === 'string' ? JSON.parse(shared.value.meta) : shared.value.meta

  passwordProtected.value = shared.value.password !== null && shared.value.password !== ''

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

  return `${dashboardUrl?.value}#/nc/${viewType}/${shared.value.uuid}${surveyMode.value ? '/survey' : ''}`
})

async function saveAllowCSVDownload() {
  try {
    const meta = shared.value.meta && typeof shared.value.meta === 'string' ? JSON.parse(shared.value.meta) : shared.value.meta
    await $api.dbViewShare.update(shared.value.id, {
      meta,
    })
    // Successfully updated
    message.success(t('msg.success.updated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  if (allowCSVDownload?.value) {
    $e('a:view:share:enable-csv-download')
  } else {
    $e('a:view:share:disable-csv-download')
  }
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

const copyLink = () => {
  if (sharedViewUrl.value) {
    copy(sharedViewUrl.value)

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
    >
      <div class="flex items-center gap-1" @click="genShareLink">
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
      width="min(100vw,640px)"
      wrap-class-name="nc-modal-share-view"
    >
      <div class="share-link-box nc-share-link-box bg-primary-50">
        <div class="flex-1 h-min text-xs">{{ sharedViewUrl }}</div>

        <a v-e="['c:view:share:open-url']" :href="sharedViewUrl" target="_blank">
          <MdiOpenInNew class="text-sm text-gray-500 mt-2" />
        </a>

        <MdiContentCopy v-e="['c:view:share:copy-url']" class="text-gray-500 text-sm cursor-pointer" @click="copyLink" />
      </div>

      <a-collapse ghost>
        <a-collapse-panel key="1" :header="$t('general.showOptions')">
          <div class="flex flex-col gap-2">
            <div>
              <!-- Survey Mode; todo: i18n -->
              <a-checkbox v-if="shared.type === ViewTypes.FORM" v-model:checked="surveyMode" class="!text-xs">
                Use Survey Mode
              </a-checkbox>
            </div>

            <div>
              <!-- Password Protection -->
              <a-checkbox v-model:checked="passwordProtected" class="!text-xs">{{ $t('msg.info.beforeEnablePwd') }} </a-checkbox>
              <div v-if="passwordProtected" class="flex gap-2 mt-2 mb-4">
                <a-input
                  v-model:value="shared.password"
                  size="small"
                  class="!text-xs max-w-[250px]"
                  type="password"
                  :placeholder="$t('placeholder.password.enter')"/>


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
        </a-collapse-panel>
      </a-collapse>
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
