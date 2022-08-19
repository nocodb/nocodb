<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { ViewTypes } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { computed, extractSdkResponseErrorMsg, useNuxtApp, useProject, useSmartsheetStoreOrThrow } from '#imports'
import MdiOpenInNewIcon from '~icons/mdi/open-in-new'
import MdiCopyIcon from '~icons/mdi/content-copy'

const { view, $api } = useSmartsheetStoreOrThrow()

const { copy } = useClipboard()

const { $e } = useNuxtApp()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useUIPermission()

const { isSharedBase } = useProject()

let showShareModel = $ref(false)

let passwordProtected = $ref(false)

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
  shared.value = await $api.dbViewShare.create(view.value.id as string)
  // shared.meta = shared.meta && typeof shared.meta === 'string' ? JSON.parse(shared.meta) : shared.meta;
  // // todo: url
  // shareLink = shared;
  // passwordProtect = shared.password !== null;
  // allowCSVDownload = shared.meta.allowCSVDownload;
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

  // todo: get dashboard url
  return `${dashboardUrl?.value}/nc/${viewType}/${shared.value.uuid}`
})

async function saveAllowCSVDownload() {
  try {
    const meta = shared.value.meta && typeof shared.value.meta === 'string' ? JSON.parse(shared.value.meta) : shared.value.meta

    await $api.dbViewShare.update(shared.value.id, {
      meta,
    } as any)
    message.success('Successfully updated')
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
    message.success('Successfully updated')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:view:share:enable-pwd')
}

const copyLink = () => {
  copy(sharedViewUrl?.value as string)
  message.success('Copied to clipboard')
}

watch(
  () => passwordProtected,
  (value) => {
    if (!value) {
      shared.value.password = ''
      saveShareLinkPassword()
    }
  },
)

onMounted(() => {
  if (shared.value?.password?.length) passwordProtected = true
})
</script>

<template>
  <div>
    <a-button
      v-if="isUIAllowed('share-view') && !isSharedBase"
      v-t="['c:view:share']"
      outlined
      class="nc-btn-share-view nc-toolbar-btn"
    >
      <div class="flex items-center gap-1" @click="genShareLink">
        <MdiOpenInNewIcon />
        <!-- Share View -->
        <span class="!text-sm font-weight-medium"> {{ $t('activity.shareView') }}</span>
      </div>
    </a-button>

    <!-- This view is shared via a private link -->
    <a-modal
      v-model:visible="showShareModel"
      size="small"
      :title="$t('msg.info.privateLink')"
      :footer="null"
      width="min(100vw,640px)"
    >
      <div class="share-link-box nc-share-link-box bg-primary-50">
        <div class="flex-1 h-min text-xs">{{ sharedViewUrl }}</div>
        <!--        <v-spacer /> -->
        <a v-t="['c:view:share:open-url']" :href="sharedViewUrl" target="_blank">
          <MdiOpenInNewIcon class="text-sm text-gray-500 mt-2" />
        </a>
        <MdiCopyIcon class="text-gray-500 text-sm cursor-pointer" @click="copyLink" />
      </div>

      <a-collapse ghost>
        <a-collapse-panel key="1" header="More Options">
          <div class="mb-2">
            <a-checkbox v-model:checked="passwordProtected" class="!text-xs">{{ $t('msg.info.beforeEnablePwd') }} </a-checkbox>
            <div v-if="passwordProtected" class="flex gap-2 mt-2 mb-4">
              <a-input
                v-model:value="shared.password"
                size="small"
                class="!text-xs max-w-[250px]"
                type="password"
                :placeholder="$t('placeholder.password.enter')"
              />
              <a-button size="small" class="!text-xs" @click="saveShareLinkPassword"
                >{{ $t('placeholder.password.save') }}
              </a-button>
            </div>
          </div>
          <div>
            <a-checkbox v-if="shared && shared.type === ViewTypes.GRID" v-model:checked="allowCSVDownload" class="!text-xs"
              >Allow Download
            </a-checkbox>
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
