<script setup lang="ts">
import {
  extractSdkResponseErrorMsg,
  iconMap,
  message,
  onMounted,
  storeToRefs,
  useBase,
  useCopy,
  useDashboard,
  useI18n,
  useNuxtApp,
} from '#imports'

interface ShareBase {
  uuid?: string
  url?: string
  role?: string
}

enum ShareBaseRole {
  Editor = 'editor',
  Viewer = 'viewer',
}

const { t } = useI18n()

const { dashboardUrl } = useDashboard()

const { $api, $e } = useNuxtApp()

const sharedBase = ref<null | ShareBase>(null)

const showEditBaseDropdown = ref(false)

const { base } = storeToRefs(useBase())

const { copy } = useCopy()

const url = computed(() =>
  sharedBase.value && sharedBase.value.uuid ? `${dashboardUrl.value}#/base/${sharedBase.value.uuid}` : null,
)

const loadBase = async () => {
  try {
    if (!base.value.id) return

    const res = await $api.base.sharedBaseGet(base.value.id)

    sharedBase.value = {
      uuid: res.uuid,
      url: res.url,
      role: res.roles,
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const createShareBase = async (role = ShareBaseRole.Viewer) => {
  try {
    if (!base.value.id) return

    const res = await $api.base.sharedBaseUpdate(base.value.id, {
      roles: role,
    })

    sharedBase.value = res ?? {}
    sharedBase.value!.role = role
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:enable', { role })
}

const disableSharedBase = async () => {
  try {
    if (!base.value.id) return

    await $api.base.sharedBaseDisable(base.value.id)
    sharedBase.value = null
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:disable')
}

const recreate = async () => {
  try {
    if (!base.value.id) return

    const createdShareBase = await $api.base.sharedBaseCreate(base.value.id, {
      roles: sharedBase.value?.role || ShareBaseRole.Viewer,
    })

    const newBase = createdShareBase || {}

    sharedBase.value = { ...newBase, role: sharedBase.value?.role }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:recreate')
}

const copyUrl = async () => {
  if (!url.value) return
  try {
    await copy(url.value)

    // Copied shareable base url to clipboard!
    message.success(t('msg.success.shareableURLCopied'))
  } catch (e: any) {
    message.error(e.message)
  }

  $e('c:shared-base:copy-url')
}

const navigateToSharedBase = () => {
  if (!url.value) return

  window.open(url.value, '_blank')

  $e('c:shared-base:open-url')
}

const generateEmbeddableIframe = async () => {
  if (!url.value) return
  try {
    await copy(`<iframe
class="nc-embed"
src="${url.value}?embed"
frameborder="0"
width="100%"
height="700"
style="background: transparent; border: 1px solid #ddd"></iframe>`)

    // Copied embeddable html code!
    message.success(t('msg.success.embeddableHTMLCodeCopied'))
  } catch (e: any) {
    message.error(e.message)
  }
  $e('c:shared-base:copy-embed-frame')
}

onMounted(() => {
  if (!sharedBase.value) {
    loadBase()
  }
})
</script>

<template>
  <div class="flex flex-col gap-2 w-full" data-testid="nc-share-base-sub-modal">
    <!--    Generate publicly shareable readonly source -->
    <div class="flex text-xs text-gray-500 justify-start ml-1">{{ $t('msg.info.generatePublicShareableReadonlyBase') }}</div>

    <div class="flex flex-row justify-between mx-1">
      <a-dropdown v-model="showEditBaseDropdown" class="flex" overlay-class-name="nc-dropdown-shared-base-toggle">
        <a-button>
          <div class="flex flex-row rounded-md items-center space-x-2 nc-disable-shared-base">
            <div v-if="sharedBase?.uuid">{{ $t('activity.shareBase.enable') }}</div>
            <div v-else>{{ $t('activity.shareBase.disable') }}</div>
            <IcRoundKeyboardArrowDown class="h-[1rem]" />
          </div>
        </a-button>

        <template #overlay>
          <a-menu>
            <a-menu-item>
              <div v-if="sharedBase?.uuid" class="py-3" @click="disableSharedBase">{{ $t('activity.shareBase.disable') }}</div>
              <div v-else class="py-3" @click="createShareBase(ShareBaseRole.Viewer)">{{ $t('activity.shareBase.enable') }}</div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <a-select
        v-if="sharedBase?.uuid"
        v-model:value="sharedBase.role"
        class="flex nc-shared-base-role"
        dropdown-class-name="nc-dropdown-share-base-role"
      >
        <template #suffixIcon>
          <div class="flex flex-row">
            <IcRoundKeyboardArrowDown class="text-black -mt-0.5 h-[1rem]" />
          </div>
        </template>

        <a-select-option
          v-for="(role, index) in [ShareBaseRole.Editor, ShareBaseRole.Viewer]"
          :key="index"
          :value="role"
          dropdown-class-name="capitalize"
          @click="createShareBase(role)"
        >
          <div class="w-full px-2 capitalize">
            {{ role }}
          </div>
        </a-select-option>
      </a-select>
    </div>
    <div
      v-if="sharedBase?.uuid"
      class="flex flex-row mt-2 bg-red-50 py-4 mx-1 px-2 items-center rounded-sm w-full justify-between"
    >
      <span class="flex text-xs overflow-x-hidden overflow-ellipsis text-gray-700 pl-2 nc-url">{{ url }}</span>

      <div class="flex border-l-1 pt-1 pl-1">
        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('general.reload') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="recreate">
            <template #icon>
              <component :is="iconMap.reload" class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>

        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('activity.copyUrl') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="copyUrl">
            <template #icon>
              <component :is="iconMap.copy" class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>

        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('activity.openTab') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="navigateToSharedBase">
            <template #icon>
              <component :is="iconMap.share" class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>

        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('activity.iFrame') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="generateEmbeddableIframe">
            <template #icon>
              <component :is="iconMap.xml" class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>
      </div>
    </div>
  </div>
</template>
