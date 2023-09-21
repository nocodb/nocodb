<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import type { ApiTokenType, RequestParams } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, ref, useApi, useCopy, useNuxtApp } from '#imports'

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

const { copy } = useCopy()

const { t } = useI18n()

interface IApiTokenInfo extends ApiTokenType {
  created_by: string
}

const tokens = ref<IApiTokenInfo[]>([])

const selectedToken = reactive({
  isShow: false,
  id: '',
})

const currentPage = ref(1)

const showNewTokenModal = ref(false)

const currentLimit = ref(10)

const selectedTokenData = ref<ApiTokenType>({})

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})

const hideOrShowToken = (tokenId: string) => {
  if (selectedToken.isShow && selectedToken.id === tokenId) {
    selectedToken.isShow = false
    selectedToken.id = ''
  } else {
    selectedToken.isShow = true
    selectedToken.id = tokenId
  }
}

const loadTokens = async (page = currentPage.value, limit = currentLimit.value) => {
  currentPage.value = page
  try {
    const response: any = await api.orgTokens.list({
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
      },
    } as RequestParams)
    if (!response) return

    pagination.total = response.pageInfo.totalRows ?? 0
    pagination.pageSize = 10

    tokens.value = response.list as IApiTokenInfo[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadTokens()

const isModalOpen = ref(false)
const tokenDesc = ref('')
const tokenToCopy = ref('')
const isTextEmpty = ref(false)

const deleteToken = async (token: string): Promise<void> => {
  try {
    await api.orgTokens.delete(token)
    // message.success(t('msg.success.tokenDeleted'))
    await loadTokens()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:token:delete')
  isModalOpen.value = false
  tokenToCopy.value = ''
  tokenDesc.value = ''
}

const generateToken = async () => {
  if (!selectedTokenData.value.description?.length) {
    isTextEmpty.value = true
  } else {
    isTextEmpty.value = false
  }
  if (isTextEmpty.value) return
  try {
    await api.orgTokens.create(selectedTokenData.value)
    showNewTokenModal.value = false
    // Token generated successfully
    // message.success(t('msg.success.tokenGenerated'))
    selectedTokenData.value = {}
    await loadTokens()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:api-token:generate')
}

const copyToken = async (token: string | undefined) => {
  if (!token) return

  try {
    await copy(token)
    // Copied to clipboard
    message.info(t('msg.info.copiedToClipboard'))

    $e('c:api-token:copy')
  } catch (e: any) {
    message.error(e.message)
  }
}

const triggerDeleteModal = (tokenToDelete: string, tokenDescription: string) => {
  tokenToCopy.value = tokenToDelete
  tokenDesc.value = tokenDescription
  isModalOpen.value = true
}

const descriptionInput: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull pt-2">
    <div class="max-w-[810px] mx-auto p-4" data-testid="nc-token-list">
      <div class="py-2 flex gap-4 items-center justify-between">
        <h6 class="text-2xl my-4 text-left font-bold">API Tokens</h6>
        <NcButton
          class="!rounded-md"
          data-testid="nc-token-create"
          size="middle"
          type="primary"
          @click="showNewTokenModal = true"
        >
          <span class="hidden md:block">
            {{ $t('title.addNewToken') }}
          </span>
          <span class="flex items-center justify-center md:hidden">
            <component :is="iconMap.plus" />
          </span>
        </NcButton>
      </div>
      <span>Create personal API tokens to use in automation or external apps.</span>
      <div class="w-[780px] mt-5 border-1 rounded-md">
        <div class="flex w-full pl-5 bg-gray-50 border-b-1">
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-2/9">Token name</span>
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-2/9 text-start">Creator</span>
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-3/9 text-start">Token</span>
          <span class="py-3.5 text-gray-500 font-medium text-3.5 w-2/9 text-center">Actions</span>
        </div>
        <main>
          <div
            v-if="showNewTokenModal"
            class="flex gap-5 px-3 py-3.5 text-gray-500 font-medium text-3.5 w-full nc-token-generate"
          >
            <div class="flex flex-col w-full">
              <a-input
                :ref="descriptionInput"
                v-model:value="selectedTokenData.description"
                type="text"
                class="!rounded-lg !py-2"
                placeholder="Token Name"
                data-testid="nc-token-input"
              />
              <span v-if="isTextEmpty" class="text-red-500 text-xs font-light mt-1.5 ml-1">token name should not be empty</span>
            </div>
            <div class="flex gap-2 justify-start">
              <NcButton
                v-if="!isLoading"
                type="secondary"
                size="small"
                @click="
                  () => {
                    showNewTokenModal = false
                    isTextEmpty = false
                  }
                "
              >
                Cancel
              </NcButton>
              <NcButton type="primary" size="sm" :is-loading="isLoading" data-testid="nc-token-save-btn" @click="generateToken">
                Save
              </NcButton>
            </div>
          </div>
          <div v-if="!tokens.length">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="`${$t('general.no')} ${$t('labels.token')}`" />
          </div>

          <div v-for="el of tokens" :key="el.id" data-testid="nc-token-list" class="flex border-b-1 pl-5 py-3 justify-between">
            <span class="text-gray-500 font-medium text-3.5 text-start w-2/9">
              <GeneralTruncateText placement="top" length="25">
                {{ el.description }}
              </GeneralTruncateText>
            </span>
            <span class="text-gray-500 font-medium text-3.5 text-start w-2/9">
              <GeneralTruncateText placement="top" length="20">
                {{ el.created_by }}
              </GeneralTruncateText>
            </span>
            <span class="text-gray-500 font-medium text-3.5 text-start w-3/9">
              <GeneralTruncateText v-if="el.token === selectedToken.id && selectedToken.isShow" placement="top" length="28">
                {{ el.token }}
              </GeneralTruncateText>
              <span v-else>**********************************</span>
            </span>
            <!-- ACTIONS -->
            <span class="text-gray-500 font-medium text-3.5 text-start w-2/9">
              <div class="flex justify-center gap-3">
                <component
                  :is="iconMap.eyeSlash"
                  v-if="el.token === selectedToken.id && selectedToken.isShow"
                  class="hover::cursor-pointer"
                  @click="hideOrShowToken(el.token as string)"
                />
                <component
                  :is="iconMap.eye"
                  v-else
                  class="nc-toggle-token-visibility hover::cursor-pointer"
                  @click="hideOrShowToken(el.token as string)"
                />
                <component :is="iconMap.copy" class="hover::cursor-pointer" @click="copyToken(el.token)" />
                <component
                  :is="iconMap.delete"
                  data-testid="nc-token-row-action-icon"
                  class="nc-delete-icon hover::cursor-pointer"
                  @click="triggerDeleteModal(el.token as string, el.description as string)"
                />
              </div>
            </span>
          </div>
        </main>
      </div>
      <div v-if="pagination.total > 10" class="flex items-center justify-center mt-4">
        <a-pagination
          v-model:current="currentPage"
          :total="pagination.total"
          show-less-items
          @change="loadTokens(currentPage, currentLimit)"
        />
      </div>
    </div>

    <GeneralDeleteModal v-model:visible="isModalOpen" entity-name="Token" :on-delete="() => deleteToken(tokenToCopy)">
      <template #entity-preview>
        <span>
          <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
            <GeneralIcon icon="key" class="nc-view-icon"></GeneralIcon>
            <div
              class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            >
              {{ tokenDesc }}
            </div>
          </div>
        </span>
      </template>
    </GeneralDeleteModal>
  </div>
</template>
