<script setup lang="ts">
import { extractSdkResponseErrorMsg, message, onMounted, useCopy, useDashboard, useI18n, useNuxtApp, useProject } from '#imports'

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

const { dashboardUrl } = $(useDashboard())

const { $api, $e } = useNuxtApp()

let base = $ref<null | ShareBase>(null)

const showEditBaseDropdown = $ref(false)

const { project } = useProject()

const { copy } = useCopy()

const url = $computed(() => (base && base.uuid ? `${dashboardUrl}#/base/${base.uuid}` : null))

const loadBase = async () => {
  try {
    if (!project.value.id) return

    const res = await $api.project.sharedBaseGet(project.value.id)

    base = {
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
    if (!project.value.id) return

    const res = await $api.project.sharedBaseUpdate(project.value.id, {
      roles: role,
    })

    base = res ?? {}
    base!.role = role
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:enable', { role })
}

const disableSharedBase = async () => {
  try {
    if (!project.value.id) return

    await $api.project.sharedBaseDisable(project.value.id)
    base = null
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:disable')
}

const recreate = async () => {
  try {
    if (!project.value.id) return

    const sharedBase = await $api.project.sharedBaseCreate(project.value.id, {
      roles: base?.role || ShareBaseRole.Viewer,
    })

    const newBase = sharedBase || {}

    base = { ...newBase, role: base?.role }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:shared-base:recreate')
}

const copyUrl = async () => {
  if (!url) return

  await copy(url)

  // Copied shareable base url to clipboard!
  message.success(t('msg.success.shareableURLCopied'))

  $e('c:shared-base:copy-url')
}

const navigateToSharedBase = () => {
  if (!url) return

  window.open(url, '_blank')

  $e('c:shared-base:open-url')
}

const generateEmbeddableIframe = () => {
  if (!url) return

  copy(`<iframe
class="nc-embed"
src="${url}?embed"
frameborder="0"
width="100%"
height="700"
style="background: transparent; border: 1px solid #ddd"></iframe>`)

  // Copied embeddable html code!
  message.success(t('msg.success.embeddableHTMLCodeCopied'))

  $e('c:shared-base:copy-embed-frame')
}

onMounted(() => {
  if (!base) {
    loadBase()
  }
})
</script>

<template>
  <div class="flex flex-col w-full" data-testid="nc-share-base-sub-modal">
    <div class="flex flex-row items-center space-x-0.5 pl-2 h-[0.8rem]">
      <MdiOpenInNew />

      <div class="text-xs">{{ $t('activity.shareBase.link') }}</div>
    </div>

    <div v-if="base?.uuid" class="flex flex-row mt-2 bg-red-50 py-4 mx-1 px-2 items-center rounded-sm w-full justify-between">
      <span class="flex text-xs overflow-x-hidden overflow-ellipsis text-gray-700 pl-2 nc-url">{{ url }}</span>

      <div class="flex border-l-1 pt-1 pl-1">
        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('general.reload') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="recreate">
            <template #icon>
              <MdiReload class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>

        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('activity.copyUrl') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="copyUrl">
            <template #icon>
              <MdiContentCopy class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>

        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('activity.openTab') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="navigateToSharedBase">
            <template #icon>
              <MdiOpenInNew class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>

        <a-tooltip placement="bottom">
          <template #title>
            <span>{{ $t('activity.iFrame') }}</span>
          </template>

          <a-button type="text" class="!rounded-md mr-1 -mt-1.5 h-[1rem]" @click="generateEmbeddableIframe">
            <template #icon>
              <MdiXml class="flex mx-auto text-gray-600" />
            </template>
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <!--    Generate publicly shareable readonly base -->
    <div class="flex text-xs text-gray-500 mt-2 justify-start ml-2">{{ $t('msg.info.generatePublicShareableReadonlyBase') }}</div>

    <div class="mt-4 flex flex-row justify-between mx-1">
      <a-dropdown v-model="showEditBaseDropdown" class="flex" overlay-class-name="nc-dropdown-shared-base-toggle">
        <a-button>
          <div class="flex flex-row items-center space-x-2 nc-disable-shared-base">
            <div v-if="base?.uuid">{{ $t('activity.shareBase.enable') }}</div>
            <div v-else>{{ $t('activity.shareBase.disable') }}</div>
            <IcRoundKeyboardArrowDown class="h-[1rem]" />
          </div>
        </a-button>

        <template #overlay>
          <a-menu>
            <a-menu-item>
              <div v-if="base?.uuid" class="py-3" @click="disableSharedBase">{{ $t('activity.shareBase.disable') }}</div>
              <div v-else class="py-3" @click="createShareBase(ShareBaseRole.Viewer)">{{ $t('activity.shareBase.enable') }}</div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <a-select
        v-if="base?.uuid"
        v-model:value="base.role"
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
  </div>
</template>
