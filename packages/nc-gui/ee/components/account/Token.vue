<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import type { ApiTokenType, RequestParams } from 'nocodb-sdk'
import { extractNextDefaultName } from '~/helpers/parsers/parserHelpers'

interface Props {
  createMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  createMode: false,
})

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

const { copy } = useCopy()

const { t } = useI18n()

interface IApiTokenScope {
  id: string
  resource_type: string
  resource_id: string
  permissions?: Record<string, string>
}

interface IApiTokenInfo extends ApiTokenType {
  created_by: string
  token_prefix?: string
  scopes?: IApiTokenScope[]
  expiry?: string
  enabled?: boolean
  last_used_at?: string
  fk_sso_client_id?: string
  title?: string
}

// View mode: 'list' (token list), 'create' (inline create form)
const route = useRoute()
const router = useRouter()

const viewMode = ref<'list' | 'create'>(
  props.createMode || route.path.endsWith('/new') ? 'create' : 'list',
)

const tokens = ref<IApiTokenInfo[]>([])

const allTokens = ref<IApiTokenInfo[]>([])

const selectedToken = reactive({
  isShow: false,
  id: '',
})

const currentPage = ref(1)

const showNewTokenModal = ref(false)

const editingToken = ref<IApiTokenInfo | null>(null)

const currentLimit = ref(10)

const defaultTokenName = t('labels.token')

const selectedTokenData = ref<ApiTokenType>({
  description: defaultTokenName,
})

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})

const isLoadingAllTokens = ref(true)

const isModalOpen = ref(false)

const tokenDesc = ref('')

const tokenToCopy = ref('')

const tokenToDeleteId = ref('')

const isValidTokenName = ref(false)


const setDefaultTokenName = () => {
  selectedTokenData.value.description = extractNextDefaultName(
    [...allTokens.value.map((el) => el?.description || '')],
    defaultTokenName,
  )
  isValidTokenName.value = true
}

const hideOrShowToken = (tokenId: string) => {
  if (selectedToken.isShow && selectedToken.id === tokenId) {
    selectedToken.isShow = false
    selectedToken.id = ''
  } else {
    selectedToken.isShow = true
    selectedToken.id = tokenId
  }
}

const loadAllTokens = async (limit = pagination.total) => {
  try {
    const response: any = await api.orgTokens.list({
      query: {
        limit,
      },
    } as RequestParams)
    if (!response) return

    allTokens.value = response.list as IApiTokenInfo[]
    setDefaultTokenName()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const updateAllTokens = (type: 'delete' | 'add', token: IApiTokenInfo) => {
  switch (type) {
    case 'add': {
      allTokens.value = [...allTokens.value, token]
      break
    }
    case 'delete': {
      allTokens.value = [...allTokens.value.filter((t) => t.token !== token.token && t.id !== token.id)]
      break
    }
  }
  setDefaultTokenName()
}

const loadTokens = async (page = currentPage.value, limit = currentLimit.value, hideShowNewToken = false) => {
  currentPage.value = page
  try {
    const response: any = await api.orgTokens.list({
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
      },
    } as RequestParams)
    if (!response) {
      isLoadingAllTokens.value = false
      return
    }

    pagination.total = response.pageInfo.totalRows ?? 0
    pagination.pageSize = 10

    tokens.value = response.list as IApiTokenInfo[]

    if (hideShowNewToken) {
      showNewTokenModal.value = false
      selectedTokenData.value = {}
    }

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

const deleteToken = async (token: string): Promise<void> => {
  try {
    const tokenInfo = allTokens.value.find((t) => t.token === token || t.id === token)
    const id = tokenInfo?.id

    if (id) {
      try {
        await api.request({
          path: `/api/v3/meta/tokens/${id}`,
          method: 'DELETE',
        })
      } catch {
        await api.orgTokens.delete(id)
      }
    }

    updateAllTokens('delete', { token, id } as IApiTokenInfo)

    const newTotal = pagination.total - 1
    if (currentPage.value > 1 && (currentPage.value - 1) * currentLimit.value >= newTotal) {
      currentPage.value--
    }

    await loadTokens(currentPage.value)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:token:delete')
  isModalOpen.value = false
  tokenToCopy.value = ''
  tokenToDeleteId.value = ''
  tokenDesc.value = ''
}

const validateTokenName = (tokenName: string | undefined) => {
  if (!tokenName) return false
  return tokenName.length < 255
}

const generateToken = async () => {
  const isValid = validateTokenName(selectedTokenData.value.description)
  isValidTokenName.value = isValid

  if (!isValid) return
  try {
    const token = await api.orgTokens.create(selectedTokenData.value)

    await loadTokens(currentPage.value, currentLimit.value, true)

    updateAllTokens('add', token as IApiTokenInfo)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    $e('a:api-token:generate')
  }
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

const triggerDeleteModal = (tokenToDelete: string, tokenDescription: string, tokenId?: string) => {
  tokenToCopy.value = tokenToDelete
  tokenToDeleteId.value = tokenId || ''
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

const isExpired = (token: IApiTokenInfo) => {
  if (!token.expiry) return false
  return new Date(token.expiry) < new Date()
}

const isFineGrained = (token: IApiTokenInfo) => {
  return !!(token.scopes?.length) || !!token.expiry || !!token.token_prefix
}

const openCreateForm = () => {
  editingToken.value = null
  navigateTo('/account/tokens/new')
}

const onTokenCreated = () => {
  loadTokens()
  loadAllTokens(pagination.total + 1)
}

const onTokenSaved = () => {
  editingToken.value = null
  viewMode.value = 'list'
  loadTokens()
  if (route.path.endsWith('/new')) {
    navigateTo('/account/tokens')
  }
}

const onCreateCancel = () => {
  editingToken.value = null
  viewMode.value = 'list'
  if (route.path.endsWith('/new')) {
    navigateTo('/account/tokens')
  }
}

const openEditToken = async (token: IApiTokenInfo) => {
  try {
    // Fetch full token list from V3 to get scopes/permissions
    const response: any = await api.request({
      path: '/api/v3/meta/tokens',
      method: 'GET',
    })
    // V1 returns integer IDs, V3 may return string — compare loosely
    const detail = response?.list?.find((t: any) => String(t.id) === String(token.id))
    editingToken.value = detail ? { ...token, ...detail } : token
  } catch {
    editingToken.value = token
  }
  viewMode.value = 'create'
  // Update URL without triggering router navigation (which would re-mount the component)
  window.history.replaceState({}, '', '/account/tokens/new')
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
          {{ viewMode === 'list' ? $t('title.tokens') : editingToken ? $t('general.edit') + ' ' + $t('labels.token') : $t('title.createNewToken') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <!-- ============ CREATE / EDIT FORM (inline, replaces list) ============ -->
      <div v-if="viewMode === 'create'" class="max-w-202 mx-auto w-full">
        <AccountTokenCreateWizard
          :key="editingToken?.id || 'new'"
          :edit-token="editingToken"
          @created="onTokenCreated"
          @saved="onTokenSaved"
          @cancel="onCreateCancel"
        />
      </div>

      <!-- ============ TOKEN LIST ============ -->
      <div v-else class="max-w-202 mx-auto h-full w-full" data-testid="nc-token-list">
        <div class="flex gap-4 items-baseline justify-between">
          <h6 class="text-xl text-left font-bold my-0 text-nc-content-gray" data-rec="true">{{ $t('title.apiTokens') }}</h6>
          <NcButton
            :disabled="showNewTokenModal"
            class="!rounded-md"
            data-testid="nc-token-create"
            size="middle"
            type="primary"
            tooltip="bottom"
            @click="openCreateForm"
          >
            <span class="hidden md:block" data-rec="true">
              {{ $t('title.createNewToken') }}
            </span>
            <span class="flex items-center justify-center md:hidden" data-rec="true">
              <component :is="iconMap.plus" />
            </span>
          </NcButton>
        </div>
        <span data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>
        <div
          v-if="!isLoadingAllTokens && (tokens.length || showNewTokenModal)"
          class="mt-6 h-full max-h-[calc(100%-80px)]"
          :class="{
            'max-h-[calc(100%-120px)]': pagination.total > 10,
            'max-h-[calc(100%-80px)]': pagination.total <= 10,
          }"
        >
          <div class="h-full w-full overflow-y-auto rounded-md">
            <div class="flex w-full pl-5 bg-nc-bg-gray-extralight border-1 rounded-t-md">
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-2/8" data-rec="true">{{
                $t('title.tokenName')
              }}</span>
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-3/8 text-start" data-rec="true">{{
                $t('title.creator')
              }}</span>
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-2/8 text-start" data-rec="true">{{
                $t('labels.expiresOn')
              }}</span>
              <span class="py-3.5 pr-5 text-nc-content-gray-muted font-medium text-3.5 w-1/8 text-end" data-rec="true">{{
                $t('labels.actions')
              }}</span>
            </div>
            <div class="nc-scrollbar-md !overflow-y-auto flex flex-col h-[calc(100%-52px)]">
              <div v-if="showNewTokenModal">
                <div
                  class="flex gap-5 px-3 py-2.5 text-nc-content-gray-muted font-medium text-3.5 w-full nc-token-generate border-b-1 border-l-1 border-r-1"
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
                      :disabled="isLoading"
                      @press-enter="generateToken"
                      @input="isValidTokenName = validateTokenName(selectedTokenData.description)"
                    />
                    <span
                      v-if="!isValidTokenName"
                      class="text-nc-content-red-medium text-xs font-light mt-1.5 ml-1"
                      data-rec="true"
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
                      :loading="isLoading"
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
                <div class="flex items-center gap-1.5 w-2/8 min-w-0">
                  <NcTooltip class="truncate text-nc-content-gray-extreme font-bold text-3.5" show-on-truncate-only>
                    <template #title>{{ el.description || el.title }}</template>
                    {{ el.description || el.title }}
                  </NcTooltip>
                  <NcBadge
                    v-if="isExpired(el)"
                    :border="false"
                    color="red"
                    class="!text-[10px] !leading-[14px] !h-[18px] font-semibold flex-none"
                  >
                    {{ $t('labels.expired') }}
                  </NcBadge>
                  <NcTooltip v-if="el.fk_sso_client_id" placement="top">
                    <template #title>{{ $t('msg.ssoTokenTooltip') }}</template>
                    <NcBadge color="orange" class="!text-[10px] !leading-[14px] !h-[18px] font-semibold flex-none"> SSO </NcBadge>
                  </NcTooltip>
                </div>
                <div class="flex items-center gap-3 w-3/8">
                  <GeneralUserIcon :user="{ email: el.created_by }" size="medium" />
                  <div class="flex flex-col min-w-0">
                    <span class="text-nc-content-gray-extreme font-medium text-3.5 truncate">
                      {{ el.created_by?.split('@')[0] || '' }}
                    </span>
                    <span class="text-nc-content-gray-muted text-xs truncate">
                      {{ el.created_by }}
                    </span>
                  </div>
                </div>
                <span class="text-nc-content-gray-muted font-medium text-3.5 text-start w-2/8">
                  {{ el.expiry ? new Date(el.expiry).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : $t('labels.noExpiration') }}
                </span>
                <!-- ACTIONS -->
                <div class="flex justify-end items-center gap-3 pr-5 text-nc-content-gray-muted font-medium text-3.5 w-1/8">
                  <NcTooltip v-if="isFineGrained(el)" placement="top">
                    <template #title>{{ $t('general.edit') }}</template>
                    <component
                      :is="iconMap.edit"
                      class="hover::cursor-pointer w-4 h-4 text-nc-content-gray-subtle2"
                      data-testid="nc-token-row-edit-icon"
                      @click="openEditToken(el)"
                    />
                  </NcTooltip>
                  <NcTooltip v-if="el.token" placement="top">
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
                      @click="triggerDeleteModal(el.token as string || el.id as string, (el.description || el.title) as string, el.id)"
                    />
                  </NcTooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else-if="!isLoadingAllTokens && !tokens.length && !showNewTokenModal"
          class="max-w-[40rem] border px-3 py-6 flex flex-col items-center justify-center gap-6 text-center"
        >
          <img src="~assets/img/placeholder/api-tokens.png" class="!w-[22rem] flex-none" />

          <div class="text-2xl text-nc-content-gray font-bold">{{ $t('placeholder.noTokenCreated') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('placeholder.noTokenCreatedLabel') }}
          </div>
          <NcButton
            class="!rounded-lg !py-3 !h-10"
            data-testid="nc-token-create"
            type="primary"
            @click="openCreateForm"
          >
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
        :on-delete="() => deleteToken(tokenToDeleteId || tokenToCopy)"
      >
        <template #entity-preview>
          <span>
            <div
              class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle mb-4"
            >
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
  </div>
</template>

<style>
.token:last-child {
  @apply border-b-1 rounded-b-md;
}
</style>
