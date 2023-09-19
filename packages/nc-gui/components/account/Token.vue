<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import type { ApiTokenType, RequestParams, UserType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, ref, useApi, useCopy, useNuxtApp } from '#imports'

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

const { copy } = useCopy()

const { t } = useI18n()

const tokens = ref<ApiTokenType[]>([])

const currentPage = ref(1)

const showNewTokenModal = ref(false)

const currentLimit = ref(10)

const selectedTokenData = ref<ApiTokenType>({})

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})
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

    tokens.value = response.list as ApiTokenType[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

loadTokens()

const isModalOpen = ref(false)
const tokenDesc = ref('')
const tokenToCopy = ref('')

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

const descriptionInput: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull pt-2">
    <div class="max-w-[900px] mx-auto p-4" data-testid="nc-token-list">
      <div class="py-2 flex gap-4 items-center justify-between">
        <h6 class="text-2xl my-4 text-left font-bold">API Tokens</h6>
        <NcButton
          class="!rounded-md"
          data-testid="nc-token-create"
          size="middle"
          type="primary"
          @click="showNewTokenModal = true"
        >
          {{ $t('title.addNewToken') }}
        </NcButton>
      </div>
      <span>Create personal API tokens to use in automation or external apps.</span>
      <table class="w-full mt-5 border-1 rounded-md">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-3.5 text-gray-500 font-medium text-3.5">Token name</th>
            <th class="px-3 py-3.5 text-gray-500 font-medium text-3.5">Creator</th>
            <th class="px-3 py-3.5 text-gray-500 font-medium text-3.5">Token</th>
            <th class="px-3 py-3.5 text-gray-500 font-medium text-3.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="showNewTokenModal">
            <td class="px-3 py-3.5 text-gray-500 font-medium text-3.5 text-center" colspan="3">
              <div class="p-5 ml-4">
                <a-input
                  :ref="descriptionInput"
                  v-model:value="selectedTokenData.description"
                  type="text"
                  class="!rounded-lg !py-2"
                  placeholder="Token Name"
                  data-testid="nc-token-modal-description"
                />
              </div>
            </td>
            <td class="text-gray-500 font-medium text-3.5 text-center">
              <div class="flex gap-2 justify-center">
                <NcButton v-if="!isLoading" type="secondary" size="sm" @click="showNewTokenModal = false"> Cancel </NcButton>
                <NcButton type="primary" size="sm" :is-loading="isLoading" @click="generateToken"> Save </NcButton>
              </div>
            </td>
          </tr>
          <tr v-for="el of tokens" :key="el.id">
            <td class="px-3 py-3.5 text-gray-500 font-medium text-3.5 text-center">{{ el.description }}</td>
            <td class="px-3 py-3.5 text-gray-500 font-medium text-3.5 text-center">{{ el.fk_user_id }}</td>
            <td class="px-3 py-3.5 text-gray-500 font-medium text-3.5 text-center">{{ el.token }}</td>
            <td class="px-3 py-3.5 text-gray-500 font-medium text-3.5 text-center">Tljghdfjghdfj</td>
          </tr>
        </tbody>
      </table>
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

<style scoped>
:deep(
    .ant-table-thead
      > tr
      > th:not(:last-child):not(.ant-table-selection-column):not(.ant-table-row-expand-icon-cell):not([colspan]):before
  ) {
  @apply h-0 h-0;
}
:deep(.ant-table-thead > tr > th) {
  @apply bg-gray-50 text-gray-500;
}
:deep(.ant-table-container) {
  @apply rounded-md;
}
</style>
