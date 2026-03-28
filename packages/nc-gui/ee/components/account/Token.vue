<script lang="ts" setup>
import type { ApiTokenType, RequestParams } from 'nocodb-sdk'

const { api } = useApi()
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

// View mode: 'list' (token list), 'create' (inline create/edit form)
const route = useRoute()

const viewMode = ref<'list' | 'create'>(
  route.path.endsWith('/new') ? 'create' : 'list',
)

const tokens = ref<IApiTokenInfo[]>([])
const allTokens = ref<IApiTokenInfo[]>([])
const editingToken = ref<IApiTokenInfo | null>(null)

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
const tokenToDeleteId = ref('')

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

const deleteToken = async (token: string): Promise<void> => {
  try {
    const tokenInfo = allTokens.value.find((t) => t.token === token || t.id === token)
    const id = tokenInfo?.id

    if (id) {
      // Try V3 API first (supports fine-grained tokens), fall back to V1 for legacy tokens
      try {
        await api.request({ path: `/api/v3/meta/tokens/${id}`, method: 'DELETE' })
      } catch {
        await api.orgTokens.delete(id)
      }
    }

    allTokens.value = allTokens.value.filter((t) => t.token !== token && t.id !== token)

    const newTotal = pagination.total - 1
    if (currentPage.value > 1 && (currentPage.value - 1) * currentLimit.value >= newTotal) {
      currentPage.value--
    }

    await loadTokens(currentPage.value)
    $e('a:api-token:delete')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  isModalOpen.value = false
  tokenToCopy.value = ''
  tokenToDeleteId.value = ''
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

const triggerDeleteModal = (tokenToDelete: string, tokenDescription: string, tokenId?: string) => {
  tokenToCopy.value = tokenToDelete
  tokenToDeleteId.value = tokenId || ''
  tokenDesc.value = tokenDescription
  isModalOpen.value = true
}

const toggleEnabled = async (token: IApiTokenInfo) => {
  if (!isFineGrained(token)) return

  try {
    const newEnabled = !token.enabled
    await api.request({
      path: `/api/v3/meta/tokens/${token.id}`,
      method: 'PATCH',
      body: { enabled: newEnabled },
    })
    await loadTokens()
    $e('a:api-token:toggle-enabled', { enabled: newEnabled })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const isExpired = (token: IApiTokenInfo) => {
  if (!token.expiry) return false
  return new Date(token.expiry) < new Date()
}

const isFineGrained = (token: IApiTokenInfo) => {
  return !!(token.scopes?.length) || !!token.expiry || !!token.token_prefix
}

const formatExpiryDate = (expiry: string) => {
  return new Date(expiry).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

// -- Navigation --

const openCreateForm = () => {
  editingToken.value = null
  navigateTo('/account/tokens/new')
}

const onTokenCreated = () => {
  loadTokens()
  loadAllTokens(pagination.total + 1)
}

/**
 * Sync URL and view mode back to the token list.
 * Uses navigateTo for /new route (real page), history.replaceState for edit
 * (which used replaceState to avoid re-mounting and losing editingToken state).
 */
const returnToList = () => {
  editingToken.value = null
  viewMode.value = 'list'
  if (route.path.endsWith('/new')) {
    navigateTo('/account/tokens')
  } else {
    window.history.replaceState({}, '', '/account/tokens')
  }
}

const onTokenSaved = () => {
  loadTokens()
  returnToList()
}

const onCreateCancel = () => {
  returnToList()
}

const openEditToken = async (token: IApiTokenInfo) => {
  try {
    // Fetch full token detail from V3 API (includes scopes + permissions)
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
  // Update URL without router navigation to preserve editingToken ref across render
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
            v-e="['c:api-token:create:open']"
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

        <!-- Token table -->
        <div
          v-if="!isLoadingAllTokens && tokens.length"
          class="mt-6 h-full"
          :class="{
            'max-h-[calc(100%-120px)]': pagination.total > 10,
            'max-h-[calc(100%-80px)]': pagination.total <= 10,
          }"
        >
          <div class="h-full w-full overflow-y-auto rounded-md">
            <!-- Header -->
            <div class="flex w-full pl-5 bg-nc-bg-gray-extralight border-1 rounded-t-md">
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-16 flex-none" data-rec="true">
                {{ $t('general.active') }}
              </span>
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 flex-1" data-rec="true">
                {{ $t('title.tokenName') }}
              </span>
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-3/8 text-start" data-rec="true">
                {{ $t('title.creator') }}
              </span>
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-2/8 text-start" data-rec="true">
                {{ $t('labels.expiresOn') }}
              </span>
              <span class="py-3.5 text-nc-content-gray-muted font-medium text-3.5 w-20 flex-none text-center" data-rec="true">
                {{ $t('labels.actions') }}
              </span>
            </div>

            <!-- Rows -->
            <div class="nc-scrollbar-md !overflow-y-auto flex flex-col h-[calc(100%-52px)]">
              <div
                v-if="!tokens.length"
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
                <!-- Active toggle (fine-grained tokens only) -->
                <div class="w-16 flex-none flex items-center">
                  <a-switch
                    v-if="isFineGrained(el)"
                    v-e="['c:api-token:toggle-enabled', { enabled: el.enabled !== false }]"
                    :checked="el.enabled !== false"
                    size="small"
                    data-testid="nc-token-toggle-enabled"
                    @change="toggleEnabled(el)"
                  />
                </div>

                <!-- Token name + badges -->
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
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

                <!-- Creator -->
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

                <!-- Expires on -->
                <span class="text-nc-content-gray-muted font-medium text-3.5 text-start w-2/8">
                  {{ el.expiry ? formatExpiryDate(el.expiry) : $t('labels.noExpiration') }}
                </span>

                <!-- Actions -->
                <div class="flex justify-center items-center gap-3 text-nc-content-gray-muted font-medium text-3.5 w-20 flex-none">
                  <NcTooltip v-if="isFineGrained(el)" placement="top">
                    <template #title>{{ $t('general.edit') }}</template>
                    <component
                      :is="iconMap.edit"
                      v-e="['c:api-token:edit:open']"
                      class="cursor-pointer w-4 h-4 text-nc-content-gray-subtle2"
                      data-testid="nc-token-row-edit-icon"
                      @click="openEditToken(el)"
                    />
                  </NcTooltip>
                  <NcTooltip v-if="el.token" placement="top">
                    <template #title>{{ $t('general.copy') }}</template>
                    <component
                      :is="iconMap.copy"
                      class="cursor-pointer w-4 h-4 text-nc-content-gray-subtle2"
                      @click="copyToken(el.token)"
                    />
                  </NcTooltip>
                  <NcTooltip placement="top">
                    <template #title>{{ $t('general.delete') }}</template>
                    <component
                      :is="iconMap.delete"
                      v-e="['c:api-token:delete:open']"
                      data-testid="nc-token-row-action-icon"
                      class="nc-delete-icon cursor-pointer w-4 h-4 hover:text-nc-content-red-medium"
                      @click="triggerDeleteModal(el.token as string || el.id as string, (el.description || el.title) as string, el.id)"
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
          <NcButton
            v-e="['c:api-token:create:open']"
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
