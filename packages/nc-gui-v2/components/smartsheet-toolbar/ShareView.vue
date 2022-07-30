<script lang="ts" setup>
import { useClipboard } from '@vueuse/core'
import { ViewTypes } from 'nocodb-sdk'
import { computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useNuxtApp } from '#app'
import { useSmartsheetStoreOrThrow } from '~/composables/useSmartsheetStore'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import MdiOpenInNewIcon from '~icons/mdi/open-in-new'
import MdiCopyIcon from '~icons/mdi/content-copy'

const { isUIAllowed } = useUIPermission()
const { view, $api } = useSmartsheetStoreOrThrow()

const { copy } = useClipboard()
const toast = useToast()
const { $e } = useNuxtApp()
const { dashboardUrl } = useDashboard()

let showShareModel = $ref(false)
const passwordProtected = $ref(false)
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

    // todo: update swagger
    await $api.dbViewShare.update(shared.value.id, {
      meta,
    } as any)
    toast.success('Successfully updated')
  } catch (e) {
    toast.error(await extractSdkResponseErrorMsg(e))
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
    toast.success('Successfully updated')
  } catch (e) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:view:share:enable-pwd')
}

const copyLink = () => {
  copy(sharedViewUrl?.value as string)
  toast.info('Copied to clipboard')
}
</script>

<template>
  <div>
    <a-button v-t="['c:view:share']" outlined class="nc-btn-share-view nc-toolbar-btn" size="small">
      <div class="flex align-center gap-1" @click="genShareLink">
        <MdiOpenInNewIcon class="text-grey" />
        <!-- Share View -->
        {{ $t('activity.shareView') }}
      </div>
    </a-button>

    <!-- This view is shared via a private link -->
    <a-modal v-model:visible="showShareModel" size="small" :title="$t('msg.info.privateLink')" :footer="null">
      <div class="share-link-box nc-share-link-box bg-primary-50">
        <div class="flex-1 h-min">{{ sharedViewUrl }}</div>
        <!--        <v-spacer /> -->
        <a v-t="['c:view:share:open-url']" :href="sharedViewUrl" target="_blank">
          <MdiOpenInNewIcon class="text-sm text-gray-500 mt-1" />
        </a>
        <MdiCopyIcon class="text-gray-500 text-sm cursor-pointer" @click="copyLink" />
      </div>

      <a-collapse ghost>
        <a-collapse-panel key="1" header="More Options">
          <div class="mb-2">
            <a-checkbox v-model:checked="passwordProtected" class="text-xs">{{ $t('msg.info.beforeEnablePwd') }} </a-checkbox>
            <!--           todo: add password toggle -->
            <div v-if="passwordProtected" class="flex gap-2 mt-2 mb-4">
              <a-input
                v-model:value="shared.password"
                size="small"
                class="max-w-[250px]"
                type="password"
                :placeholder="$t('placeholder.password.enter')"
              />
              <a-button size="small" class="!text-xs" @click="saveShareLinkPassword"
                >{{ $t('placeholder.password.save') }}
              </a-button>
            </div>
          </div>
          <div>
            <a-checkbox v-if="shared && shared.type === ViewTypes.GRID" v-model:checked="allowCSVDownload" class="text-xs"
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
  @apply flex p-2 w-full items-center align-center gap-1 bg-gray-100 rounded;
}
</style>
