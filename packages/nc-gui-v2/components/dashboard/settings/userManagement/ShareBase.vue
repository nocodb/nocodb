<script setup lang="ts">
import { useToast } from 'vue-toastification'
import OpenInNewIcon from '~icons/mdi/open-in-new'
import { dashboardUrl } from '~/utils/urlUtils'

import MdiReload from '~icons/mdi/reload'
import DownIcon from '~icons/ic/round-keyboard-arrow-down'
import ContentCopyIcon from '~icons/mdi/content-copy'
import MdiXmlIcon from '~icons/mdi/xml'
import { copyTextToClipboard } from '~/utils/miscUtils'
const toast = useToast()

interface ShareBase {
  uuid?: string
  url?: string
  role?: string
}

enum Role {
  Owner = 'owner',
  Editor = 'editor',
  User = 'user',
  Guest = 'guest',
  Viewer = 'viewer',
}

const { $api, $e } = useNuxtApp()
let base = $ref<null | ShareBase>(null)
const showEditBaseDropdown = $ref(false)
const { project } = useProject()

const url = $computed(() => (base && base.uuid ? `${dashboardUrl()}#/nc/base/${base.uuid}` : null))

const loadBase = async () => {
  try {
    if (!project.value.id) return

    const res = await $api.project.sharedBaseGet(project.value.id)
    base = {
      uuid: res.uuid,
      url: res.url,
      role: res.roles,
    }
  } catch (e) {
    console.error(e)
    toast.error('Something went wrong')
  }
}

const createShareBase = async (role = Role.Viewer) => {
  try {
    if (!project.value.id) return

    const res = await $api.project.sharedBaseUpdate(project.value.id, {
      roles: role,
    })

    base = res || {}
    base.role = role
  } catch (e) {
    console.error(e)
    toast.error('Something went wrong')
  }
  $e('a:shared-base:enable', { role })
}

const disableSharedBase = async () => {
  try {
    if (!project.value.id) return

    await $api.project.sharedBaseDisable(project.value.id)
    base = {}
  } catch (e) {
    toast.error(e.message)
  }

  $e('a:shared-base:disable')
}

const recreate = async () => {
  try {
    if (!project.value.id) return

    const sharedBase = await $api.project.sharedBaseCreate(project.value.id, {
      roles: base?.role || 'viewer',
    })
    const newBase = sharedBase || {}
    base = { ...newBase, role: base?.role }
  } catch (e) {
    toast.error(e.message)
  }

  $e('a:shared-base:recreate')
}

const copyUrl = async () => {
  if (!url) return

  copyTextToClipboard(url)
  toast.success('Copied shareable base url to clipboard!')

  $e('c:shared-base:copy-url')
}

const navigateToSharedBase = () => {
  if (!url) return

  window.open(url, '_blank')

  $e('c:shared-base:open-url')
}

const generateEmbeddableIframe = () => {
  if (!url) return

  copyTextToClipboard(`<iframe
class="nc-embed"
src="${url}?embed"
frameborder="0"
width="100%"
height="700"
style="background: transparent; border: 1px solid #ddd"></iframe>`)
  toast.success('Copied embeddable html code!')

  $e('c:shared-base:copy-embed-frame')
}

onMounted(() => {
  if (!base) {
    loadBase()
  }
})
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-row items-center space-x-0.5 pl-1.5">
      <OpenInNewIcon height="0.8rem" class="text-gray-500" />
      <div class="text-gray-500 text-xs">Shared Base Link</div>
    </div>
    <div v-if="base?.uuid" class="flex flex-row mt-2 bg-red-50 py-4 mx-1 px-2 items-center rounded-sm">
      <span class="text-xs overflow-x-hidden overflow-ellipsis text-gray-700">{{ url }}</span>
      <a-divider class="flex" type="vertical" />

      <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="recreate">
        <template #icon>
          <MdiReload height="1rem" class="flex mx-auto text-gray-600" />
        </template>
      </a-button>

      <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="copyUrl">
        <template #icon>
          <ContentCopyIcon height="1rem" class="flex mx-auto text-gray-600" />
        </template>
      </a-button>

      <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="navigateToSharedBase">
        <template #icon>
          <OpenInNewIcon height="1rem" class="flex mx-auto text-gray-600" />
        </template>
      </a-button>
      <a-button type="text" class="!rounded-md mr-1 -mt-1.5" @click="generateEmbeddableIframe">
        <template #icon>
          <MdiXmlIcon height="1rem" class="flex mx-auto text-gray-600" />
        </template>
      </a-button>
    </div>
    <div class="flex text-xs text-gray-400 mt-2 justify-start ml-2">
      This link can be used to signup by anyone under this project
    </div>
    <div class="mt-4 flex flex-row justify-between mx-1">
      <a-dropdown v-model="showEditBaseDropdown" class="flex">
        <a-button>
          <div class="flex flex-row items-center space-x-2">
            <div v-if="base?.uuid">Anyone with the link</div>
            <div v-else>Disable shared base</div>
            <DownIcon height="1rem" />
          </div>
        </a-button>

        <template #overlay>
          <a-menu>
            <a-menu-item>
              <div v-if="base?.uuid" @click="disableSharedBase">Disable shared base</div>

              <div v-else @click="createShareBase(Role.Viewer)">Anyone with the link</div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <a-select v-if="base?.uuid" v-model:value="base.role" class="flex">
        <a-select-option
          v-for="(role, index) in [Role.Editor, Role.Viewer]"
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

<style scoped></style>
