<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import type { ApiTokenType, RequestParams } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, isEeUI, ref, useApi, useCopy, useNuxtApp } from '#imports'

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

const defaultTokenName = t('labels.untitledToken')

const selectedTokenData = ref<ApiTokenType>({
  description: defaultTokenName,
})

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
const isValidTokenName = ref(false)

const deleteToken = async (token: string): Promise<void> => {
  try {
    await api.orgTokens.delete(token)
    // message.success(t('msg.success.tokenDeleted'))
    await loadTokens()
    if (!tokens.value.length && currentPage.value !== 1) {
      currentPage.value--
      loadTokens(currentPage.value)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:token:delete')
  isModalOpen.value = false
  tokenToCopy.value = ''
  tokenDesc.value = ''
}

const validateTokenName = (tokenName: string | undefined) => {
  if (!tokenName) return false
  return tokenName.length < 255
}

const generateToken = async () => {
  isValidTokenName.value = validateTokenName(selectedTokenData.value.description)

  if (!isValidTokenName.value) return
  try {
    await api.orgTokens.create(selectedTokenData.value)
    showNewTokenModal.value = false
    // Token generated successfully
    // message.success(t('msg.success.tokenGenerated'))
    selectedTokenData.value = {}
    await loadTokens()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    selectedTokenData.value.description = defaultTokenName
    $e('a:api-token:generate')
  }
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

const selectInputOnMount: VNodeRef = (el) =>
  selectedTokenData.value.description === defaultTokenName && (el as HTMLInputElement)?.select()

const errorMessage = computed(() => {
  const tokenLength = selectedTokenData.value.description?.length
  if (!tokenLength) {
    return t('msg.info.tokenNameNotEmpty')
  } else if (tokenLength > 255) {
    return t('msg.info.tokenNameMaxLength')
  }
})

const handleCancel = () => {
  showNewTokenModal.value = false
  isValidTokenName.value = false
}
</script>

<template>
  <div class="h-full pt-2">
    <div class="max-w-202 mx-auto px-4 h-full" data-testid="nc-token-list">
      <div class="py-2 flex gap-4 items-baseline justify-between">
        <h6 class="text-2xl text-left font-bold" data-rec="true">{{ $t('title.apiTokens') }}</h6>
        <NcTooltip :disabled="!(isEeUI && tokens.length)">
          <template #title>{{ $t('labels.tokenLimit') }}</template>
          <NcButton
            :disabled="showNewTokenModal || (isEeUI && tokens.length)"
            class="!rounded-md"
            data-testid="nc-token-create"
            size="middle"
            type="primary"
            tooltip="bottom"
            @click="showNewTokenModal = true"
          >
            <span class="hidden md:block" data-rec="true">
              {{ $t('title.addNewToken') }}
            </span>
            <span class="flex items-center justify-center md:hidden" data-rec="true">
              <component :is="iconMap.plus" />
            </span>
          </NcButton>
        </NcTooltip>
      </div>
      <span data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>
      <div class="mt-5 h-[calc(100%-13rem)]">
        <div class="h-full w-full !overflow-hidden rounded-md">
          <div class="flex w-full pl-5 bg-gray-50 border-1 rounded-t-md">
            <span class="py-3.5 text-gray-500 font-medium text-3.5 w-2/9" data-rec="true">{{ $t('title.tokenName') }}</span>
            <span class="py-3.5 text-gray-500 font-medium text-3.5 w-2/9 text-start" data-rec="true">{{
              $t('title.creator')
            }}</span>
            <span class="py-3.5 text-gray-500 font-medium text-3.5 w-3/9 text-start" data-rec="true">{{
              $t('labels.token')
            }}</span>
            <span class="py-3.5 pl-19 text-gray-500 font-medium text-3.5 w-2/9 text-start" data-rec="true">{{
              $t('labels.actions')
            }}</span>
          </div>
          <div class="nc-scrollbar-md !overflow-y-auto flex flex-col h-[calc(100%-5rem)]">
            <div v-if="showNewTokenModal">
              <div
                class="flex gap-5 px-3 py-2.5 text-gray-500 font-medium text-3.5 w-full nc-token-generate border-b-1 border-l-1 border-r-1"
                :class="{
                  'rounded-b-md': !tokens.length,
                }"
              >
                <div class="flex w-full">
                  <a-input
                    :ref="selectInputOnMount"
                    v-model:value="selectedTokenData.description"
                    :default-value="defaultTokenName"
                    type="text"
                    class="!rounded-lg !py-1"
                    placeholder="Token Name"
                    data-testid="nc-token-input"
                    @press-enter="generateToken"
                  />
                  <span v-if="!isValidTokenName" class="text-red-500 text-xs font-light mt-1.5 ml-1" data-rec="true"
                    >{{ errorMessage }}
                  </span>
                </div>
                <div class="flex gap-2 justify-start">
                  <NcButton v-if="!isLoading" type="secondary" size="small" @click="handleCancel">
                    {{ $t('general.cancel') }}
                  </NcButton>
                  <NcButton
                    type="primary"
                    size="sm"
                    :is-loading="isLoading"
                    data-testid="nc-token-save-btn"
                    @click="generateToken"
                  >
                    {{ $t('general.save') }}
                  </NcButton>
                </div>
              </div>
            </div>
            <div
              v-if="!tokens.length && !showNewTokenModal"
              class="border-l-1 border-r-1 border-b-1 rounded-b-md justify-center flex items-center"
            >
              <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noToken')" />
            </div>

            <div
              v-for="el of tokens"
              :key="el.id"
              data-testid="nc-token-list"
              class="flex pl-5 py-3 justify-between token items-center border-l-1 border-r-1 border-b-1"
            >
              <span class="text-black font-bold text-3.5 text-start w-2/9">
                <GeneralTruncateText placement="top" length="20">
                  {{ el.description }}
                </GeneralTruncateText>
              </span>
              <span class="text-gray-500 font-medium text-3.5 text-start w-2/9">
                <GeneralTruncateText placement="top" length="20">
                  {{ el.created_by }}
                </GeneralTruncateText>
              </span>
              <span class="text-gray-500 font-medium text-3.5 text-start w-3/9">
                <GeneralTruncateText v-if="el.token === selectedToken.id && selectedToken.isShow" placement="top" length="29">
                  {{ el.token }}
                </GeneralTruncateText>
                <span v-else>************************************</span>
              </span>
              <!-- ACTIONS -->
              <div class="flex justify-end items-center gap-3 pr-5 text-gray-500 font-medium text-3.5 w-2/9">
                <NcTooltip placement="top">
                  <template #title>{{ $t('labels.showOrHide') }}</template>
                  <component
                    :is="iconMap.eye"
                    class="nc-toggle-token-visibility hover::cursor-pointer w-h-4 mb-[1.8px]"
                    @click="hideOrShowToken(el.token as string)"
                  />
                </NcTooltip>
                <NcTooltip placement="top" class="h-4">
                  <template #title>{{ $t('general.copy') }}</template>
                  <component
                    :is="iconMap.copy"
                    class="hover::cursor-pointer w-4 h-4 text-gray-600 mt-0.25"
                    @click="copyToken(el.token)"
                  />
                </NcTooltip>
                <NcTooltip placement="top" class="mb-0.5">
                  <template #title>{{ $t('general.delete') }}</template>
                  <component
                    :is="iconMap.delete"
                    data-testid="nc-token-row-action-icon"
                    class="nc-delete-icon hover::cursor-pointer w-4 h-4"
                    @click="triggerDeleteModal(el.token as string, el.description as string)"
                  />
                </NcTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pagination.total > 10" class="flex items-center justify-center mt-5">
        <a-pagination
          v-model:current="currentPage"
          :total="pagination.total"
          show-less-items
          @change="loadTokens(currentPage, currentLimit)"
        />
      </div>
    </div>

    <GeneralDeleteModal
      v-model:visible="isModalOpen"
      :entity-name="$t('labels.token')"
      :on-delete="() => deleteToken(tokenToCopy)"
    >
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

<style>
.token:last-child {
  @apply border-b-1 rounded-b-md;
}
</style>
