<script setup lang="ts">
import type { ApiTokenType } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import { useClipboard } from '@vueuse/core'
import KebabIcon from '~icons/ic/baseline-more-vert'
import MdiPlusIcon from '~icons/mdi/plus'
import CloseIcon from '~icons/material-symbols/close-rounded'
import ReloadIcon from '~icons/mdi/reload'
import VisibilityOpenIcon from '~icons/material-symbols/visibility'
import VisibilityCloseIcon from '~icons/material-symbols/visibility-off'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'
import MdiContentCopyIcon from '~icons/mdi/content-copy'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

const toast = useToast()

interface ApiToken extends ApiTokenType {
  show?: boolean
}

const { $api, $e } = useNuxtApp()
const { project } = $(useProject())
const { copy } = useClipboard()

let tokensInfo = $ref<ApiToken[] | undefined>([])
let showNewTokenModal = $ref(false)
let showDeleteTokenModal = $ref(false)
let selectedTokenData = $ref<ApiToken>({})

const loadApiTokens = async () => {
  if (!project?.id) return

  tokensInfo = await $api.apiToken.list(project.id)
}

const openNewTokenModal = () => {
  showNewTokenModal = true
  $e('c:api-token:generate')
}

const copyToken = (token: string | undefined) => {
  if (!token) return

  copy(token)
  toast.info('Copied to clipboard')

  $e('c:api-token:copy')
}

const generateToken = async () => {
  try {
    if (!project?.id) return

    await $api.apiToken.create(project.id, selectedTokenData)
    showNewTokenModal = false
    toast.success('Token generated successfully')
    selectedTokenData = {}
    await loadApiTokens()
  } catch (e: any) {
    console.error(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:api-token:generate')
}

const deleteToken = async () => {
  try {
    if (!project?.id || !selectedTokenData.token) return

    await $api.apiToken.delete(project.id, selectedTokenData.token)

    toast.success('Token deleted successfully')
    await loadApiTokens()
    showDeleteTokenModal = false
  } catch (e: any) {
    console.error(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:api-token:delete')
}

const openDeleteModal = (item: ApiToken) => {
  selectedTokenData = item
  showDeleteTokenModal = true
}

onMounted(() => {
  loadApiTokens()
})
</script>

<template>
  <a-modal v-model:visible="showNewTokenModal" :closable="false" width="28rem" centered :footer="null">
    <div class="relative flex flex-col h-full">
      <a-button type="text" class="!absolute top-0 right-0 rounded-md -mt-2 -mr-3" @click="showNewTokenModal = false">
        <template #icon>
          <CloseIcon class="flex mx-auto" />
        </template>
      </a-button>
      <div class="flex flex-row justify-center w-full -mt-1">
        <a-typography-title :level="5">Generate Token</a-typography-title>
      </div>
      <div class="flex flex-col mt-3 justify-center space-y-6">
        <a-input v-model:value="selectedTokenData.description" placeholder="Description" />
        <div class="flex flex-row justify-center">
          <a-button type="primary" @click="generateToken"> Generate </a-button>
        </div>
      </div>
    </div>
  </a-modal>
  <a-modal v-model:visible="showDeleteTokenModal" :closable="false" width="28rem" centered :footer="null">
    <div class="flex flex-col h-full">
      <div class="flex flex-row justify-center mt-2 text-center w-full text-base">This action will remove this API Token</div>
      <div class="flex mt-6 justify-center space-x-2">
        <a-button @click="showDeleteTokenModal = false"> Cancel </a-button>
        <a-button type="primary" danger @click="deleteToken()"> Confirm </a-button>
      </div>
    </div>
  </a-modal>
  <div class="flex flex-col px-10 mt-6">
    <div class="flex flex-row justify-end">
      <div class="flex flex-row space-x-1">
        <a-button size="middle" type="text" @click="loadApiTokens()">
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <ReloadIcon class="text-gray-500" />
            <div class="text-gray-500">Reload</div>
          </div>
        </a-button>
        <a-button size="middle" @click="openNewTokenModal">
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <MdiPlusIcon />
            <div>Add New Token</div>
          </div>
        </a-button>
      </div>
    </div>
    <div v-if="tokensInfo" class="w-full flex flex-col mt-2 px-1">
      <div class="flex flex-row border-b-1 text-gray-600 text-xs pb-2 pt-2">
        <div class="flex w-4/10 pl-2">Description</div>
        <div class="flex w-4/10 justify-center">Token</div>
        <div class="flex w-2/10 justify-end pr-2">Actions</div>
      </div>
      <div v-for="(item, index) in tokensInfo" :key="index" class="flex flex-col">
        <div class="flex flex-row border-b-1 items-center px-2 py-2">
          <div class="flex flex-row w-4/10 flex-wrap overflow-ellipsis">
            {{ item.description }}
          </div>
          <div class="flex w-4/10 justify-center flex-wrap overflow-ellipsis">
            <span v-if="item.show">{{ item.token }}</span>
            <span v-else>****************************************</span>
          </div>
          <div class="flex flex-row w-2/10 justify-end">
            <a-tooltip placement="bottom">
              <template #title>
                <span v-if="item.show">Hide API token </span>
                <span v-else>Show API token </span>
              </template>
              <a-button type="text" class="!rounded-md" @click="item.show = !item.show">
                <template #icon>
                  <VisibilityCloseIcon v-if="item.show" class="flex mx-auto h-[1.1rem]" />
                  <VisibilityOpenIcon v-else class="flex mx-auto h-[1rem]" />
                </template>
              </a-button>
            </a-tooltip>
            <a-tooltip placement="bottom">
              <template #title> Copy token to clipboard </template>
              <a-button type="text" class="!rounded-md" @click="copyToken(item.token)">
                <template #icon>
                  <MdiContentCopyIcon class="flex mx-auto h-[1rem]" />
                </template>
              </a-button>
            </a-tooltip>

            <a-dropdown :trigger="['click']" class="flex" placement="bottomRight">
              <div class="flex flex-row items-center">
                <a-button type="text" class="!px-0">
                  <div class="flex flex-row items-center h-[1.2rem]">
                    <KebabIcon />
                  </div>
                </a-button>
              </div>
              <template #overlay>
                <a-menu>
                  <a-menu-item>
                    <div class="flex flex-row items-center py-1 h-[1rem]" @click="openDeleteModal(item)">
                      <MdiDeleteOutlineIcon class="flex" />
                      <div class="text-xs pl-2">Remove API Token</div>
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
