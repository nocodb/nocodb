<script lang="ts" setup>
import type { ApiTokenType, RequestParams } from 'nocodb-sdk'

const { api } = useApi()
const { $e } = useNuxtApp()
const { copy } = useCopy()
const { t } = useI18n()

const route = useRoute()

interface IApiTokenInfo extends ApiTokenType {
  created_by: string
}

const viewMode = ref<'list' | 'create'>(route.path.replace(/\/$/, '').endsWith('/new') ? 'create' : 'list')

const tokens = ref<IApiTokenInfo[]>([])
const allTokens = ref<IApiTokenInfo[]>([])

const selectedToken = reactive({
  isShow: false,
  id: '',
})

const currentPage = ref(1)
const currentLimit = ref(10)

const pagination = reactive({
  total: 0,
  pageSize: 10,
})

const isLoadingAllTokens = ref(true)
const isModalOpen = ref(false)
const tokenDesc = ref('')
const tokenToCopy = ref('')

const loadAllTokens = async (limit = pagination.total) => {
  try {
    const response: any = await api.orgTokens.list({
      query: { limit },
    } as RequestParams)
    if (!response) return
    allTokens.value = response.list as IApiTokenInfo[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const loadTokens = async (page = currentPage.value, limit = currentLimit.value) => {
  currentPage.value = page
  try {
    const response: any = await api.orgTokens.list({
      query: {
        limit,
        offset: (page - 1) * limit,
      },
    } as RequestParams)
    if (!response) {
      isLoadingAllTokens.value = false
      return
    }

    pagination.total = response.pageInfo.totalRows ?? 0
    pagination.pageSize = 10
    tokens.value = response.list as IApiTokenInfo[]

    if (!allTokens.value.length) {
      await loadAllTokens(pagination.total)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    if (isLoadingAllTokens.value) {
      isLoadingAllTokens.value = false
    }
  }
}

loadTokens()

const hideOrShowToken = (tokenId: string) => {
  if (selectedToken.isShow && selectedToken.id === tokenId) {
    selectedToken.isShow = false
    selectedToken.id = ''
  } else {
    selectedToken.isShow = true
    selectedToken.id = tokenId
  }
}

const deleteToken = async (token: string): Promise<void> => {
  try {
    const tokenInfo = allTokens.value.find((t) => t.token === token)
    const id = tokenInfo?.id
    if (id) {
      await api.orgTokens.delete(id)
    }

    allTokens.value = allTokens.value.filter((t) => t.token !== token)

    const newTotal = pagination.total - 1
    if (currentPage.value > 1 && (currentPage.value - 1) * currentLimit.value >= newTotal) {
      currentPage.value--
    }

    await loadTokens(currentPage.value)
    $e('a:account:token:delete')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  isModalOpen.value = false
  tokenToCopy.value = ''
  tokenDesc.value = ''
}

const copyToken = async (token: string | undefined) => {
  if (!token) return
  try {
    await copy(token)
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

// -- Navigation --

const openCreateForm = () => {
  navigateTo('/account/tokens/new')
}

const onTokenCreated = () => {
  loadTokens()
  loadAllTokens(pagination.total + 1)
}

const returnToList = () => {
  viewMode.value = 'list'
  navigateTo('/account/tokens')
}

const onCreateCancel = () => {
  returnToList()
}
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncKey2" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ viewMode === 'list' ? $t('title.tokens') : $t('title.createNewToken') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <!-- ============ CREATE FORM ============ -->
      <div v-if="viewMode === 'create'" class="max-w-202 mx-auto w-full">
        <AccountTokenCreateWizard @created="onTokenCreated" @cancel="onCreateCancel" />
      </div>

      <!-- ============ TOKEN LIST ============ -->
      <div v-else class="max-w-202 mx-auto h-full w-full" data-testid="nc-token-list">
        <div class="flex gap-4 items-baseline justify-between">
          <h6 class="text-xl text-left font-bold my-0 text-nc-content-gray" data-rec="true">{{ $t('title.apiTokens') }}</h6>
          <NcButton
            class="!rounded-md"
            data-testid="nc-token-create"
            size="middle"
            type="primary"
            tooltip="bottom"
            @click="openCreateForm"
          >
            <span class="hidden md:block" data-rec="true">
              {{ $t('title.addNewToken') }}
            </span>
            <span class="flex items-center justify-center md:hidden" data-rec="true">
              <component :is="iconMap.plus" />
            </span>
          </NcButton>
        </div>
        <span data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>

        <div
          v-if="!isLoadingAllTokens && tokens.length"
          class="mt-6 h-full max-h-[calc(100%-80px)]"
          :class="{
            'max-h-[calc(100%-120px)]': pagination.total > 10,
            'max-h-[calc(100%-80px)]': pagination.total <= 10,
          }"
        >
          <div class="h-full w-full overflow-y-auto rounded-md">
            <div class="flex w-full pl-5 bg-nc-bg-gray-extralight border-1 rounded-t-md">
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-2/9" data-rec="true">{{
                $t('title.tokenName')
              }}</span>
              <span class="py-3.5 pl-2 text-nc-content-gray-muted font-medium text-3.5 w-2/9 text-start" data-rec="true">{{
                $t('title.creator')
              }}</span>
              <span class="py-3.5 pl-2 text-nc-content-gray-muted font-medium text-3.5 w-3/9 text-start" data-rec="true">{{
                $t('labels.token')
              }}</span>
              <span
                class="py-3.5 pl-5 lg:pl-19 text-nc-content-gray-muted font-medium text-3.5 w-2/9 text-start"
                data-rec="true"
                >{{ $t('labels.actions') }}</span
              >
            </div>
            <div class="nc-scrollbar-md !overflow-y-auto flex flex-col h-[calc(100%-52px)]">
              <div
                v-for="el of tokens"
                :key="el.id"
                data-testid="nc-token-row"
                class="flex pl-5 py-3 justify-between token items-center border-l-1 border-r-1 border-b-1"
              >
                <span class="text-nc-content-gray-extreme font-bold text-3.5 text-start w-2/9">
                  <div class="flex items-center gap-2">
                    <NcTooltip class="truncate" show-on-truncate-only>
                      <template #title>
                        {{ el.description }}
                      </template>
                      {{ el.description }}
                    </NcTooltip>
                    <NcTooltip v-if="el.fk_sso_client_id" placement="top">
                      <template #title>{{ $t('msg.ssoTokenTooltip') }}</template>
                      <NcBadge color="orange" class="!text-xs !py-0.5 !px-1.5 mr-4"> SSO </NcBadge>
                    </NcTooltip>
                  </div>
                </span>
                <span class="pl-2 text-nc-content-gray-muted font-medium text-3.5 text-start w-2/9">
                  <NcTooltip class="truncate" show-on-truncate-only>
                    <template #title>
                      {{ el.created_by }}
                    </template>
                    {{ el.created_by }}
                  </NcTooltip>
                </span>
                <span class="pl-2 text-nc-content-gray-muted font-medium text-3.5 text-start w-3/9 truncate">
                  <NcTooltip v-if="el.token === selectedToken.id && selectedToken.isShow" class="truncate" show-on-truncate-only>
                    <template #title>
                      {{ el.token }}
                    </template>
                    {{ el.token }}
                  </NcTooltip>
                  <span v-else>************************************</span>
                </span>
                <div class="flex justify-end items-center gap-3 pr-5 text-nc-content-gray-muted font-medium text-3.5 w-2/9">
                  <NcTooltip placement="top">
                    <template #title>{{ $t('labels.showOrHide') }}</template>
                    <component
                      :is="iconMap.eye"
                      class="nc-toggle-token-visibility hover::cursor-pointer w-h-4 mb-[1.8px]"
                      @click="hideOrShowToken(el.token as string)"
                    />
                  </NcTooltip>
                  <NcTooltip placement="top">
                    <template #title>{{ $t('general.copy') }}</template>
                    <component
                      :is="iconMap.copy"
                      class="hover::cursor-pointer w-4 h-4 text-nc-content-gray-subtle2"
                      @click="copyToken(el.token)"
                    />
                  </NcTooltip>
                  <NcTooltip placement="top">
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

        <!-- Empty state -->
        <div
          v-else-if="!isLoadingAllTokens && !tokens.length"
          class="max-w-[40rem] border px-3 py-6 flex flex-col items-center justify-center gap-6 text-center"
        >
          <img src="~assets/img/placeholder/api-tokens.png" class="!w-[22rem] flex-none" />
          <div class="text-2xl text-nc-content-gray font-bold">{{ $t('placeholder.noTokenCreated') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('placeholder.noTokenCreatedLabel') }}
          </div>
          <NcButton class="!rounded-lg !py-3 !h-10" data-testid="nc-token-create" type="primary" @click="openCreateForm">
            <span class="hidden md:block" data-rec="true">
              {{ $t('title.createNewToken') }}
            </span>
            <span class="flex items-center justify-center md:hidden" data-rec="true">
              <component :is="iconMap.plus" />
            </span>
          </NcButton>
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
            <div
              class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle mb-4"
            >
              <GeneralIcon icon="key" class="nc-view-icon" />
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
  </div>
</template>

<style>
.token:last-child {
  @apply border-b-1 rounded-b-md;
}
</style>
