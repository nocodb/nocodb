<script lang="ts" setup>
import type { RequestParams } from 'nocodb-sdk'

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

interface IApiTokenInfo {
  id?: string
  description?: string
  title?: string
  token?: string
  token_prefix?: string
  scopes?: IApiTokenScope[]
  expiry?: string
  enabled?: boolean
  last_used_at?: string
  created_by?: string
  created_at?: string
  fk_sso_client_id?: string
}

const tokens = ref<IApiTokenInfo[]>([])
const allTokens = ref<IApiTokenInfo[]>([])

const currentPage = ref(1)
const currentLimit = ref(10)
const showWizard = ref(false)
const isLoadingAllTokens = ref(true)
const isModalOpen = ref(false)
const tokenToDeleteId = ref('')
const tokenToDeleteDesc = ref('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
})

const loadV3Tokens = async (): Promise<IApiTokenInfo[]> => {
  try {
    const response: any = await api.request({
      path: '/api/v3/meta/tokens',
      method: 'GET',
    })
    return (response?.list || []) as IApiTokenInfo[]
  } catch {
    // V3 not available — fall back to V1
    return []
  }
}

const loadAllTokens = async (limit = pagination.total) => {
  try {
    const v3List = await loadV3Tokens()
    if (v3List.length) {
      allTokens.value = v3List
      return
    }
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
    // Use V3 API to get fine-grained metadata (scopes, permissions, token_prefix)
    const v3List = await loadV3Tokens()
    if (v3List.length || page === 1) {
      // V3 returns all tokens (no pagination yet) — apply client-side pagination
      const allItems = v3List
      pagination.total = allItems.length
      const start = (page - 1) * limit
      tokens.value = allItems.slice(start, start + limit)

      if (!allTokens.value.length) {
        allTokens.value = allItems
      }
      return
    }

    // Fallback to V1
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
    tokens.value = response.list as IApiTokenInfo[]

    if (!allTokens.value.length) {
      await loadAllTokens(pagination.total)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoadingAllTokens.value = false
  }
}

loadTokens()

const deleteToken = async () => {
  try {
    // Use V3 API for deletion (handles scope cleanup)
    await api.request({
      path: `/api/v3/meta/tokens/${tokenToDeleteId.value}`,
      method: 'DELETE',
    })
    await loadTokens()
    allTokens.value = allTokens.value.filter((t) => t.id !== tokenToDeleteId.value)

    if (!tokens.value.length && currentPage.value !== 1) {
      currentPage.value--
      loadTokens(currentPage.value)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:account:token:delete')
  isModalOpen.value = false
  tokenToDeleteId.value = ''
  tokenToDeleteDesc.value = ''
}

const triggerDeleteModal = (token: IApiTokenInfo) => {
  tokenToDeleteId.value = token.id || ''
  tokenToDeleteDesc.value = token.description || token.title || ''
  isModalOpen.value = true
}

const copyToken = async (token: string | undefined) => {
  if (!token) return
  try {
    await copy(token)
    message.info(t('msg.info.copiedToClipboard'))
  } catch (e: any) {
    message.error(e.message)
  }
}

const toggleEnabled = async (token: IApiTokenInfo) => {
  try {
    await api.request({
      path: `/api/v3/meta/tokens/${token.id}`,
      method: 'PATCH',
      body: { enabled: !token.enabled },
    })
    await loadTokens()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const onWizardCreated = () => {
  // Don't close modal — let user see the token in the result step.
  // Modal closes when user clicks "Done" (which emits 'cancel').
  loadTokens()
  loadAllTokens(pagination.total + 1)
}

const getScopeSummary = (token: IApiTokenInfo) => {
  if (!token.scopes?.length) return 'Org'
  const count = token.scopes.length
  const types = [...new Set(token.scopes.map((s) => s.resource_type))]
  if (types.length === 1 && types[0] === 'base') {
    return count === 1 ? '1 base' : `${count} bases`
  }
  return `${count} resources`
}

const getScopeBadgeColor = (token: IApiTokenInfo) => {
  if (!token.scopes?.length) return 'default'
  const types = [...new Set(token.scopes.map((s) => s.resource_type))]
  if (types.includes('workspace')) return 'purple'
  return 'blue'
}

const getPermissionsSummary = (token: IApiTokenInfo) => {
  // Check permissions from first scope
  const perms = token.scopes?.[0]?.permissions
  if (!perms) return 'Full access'

  const parts: string[] = []
  for (const [key, value] of Object.entries(perms)) {
    if (value === 'none') continue
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    const level = value === 'write' ? 'RW' : 'R'
    parts.push(`${label}: ${level}`)
  }

  if (!parts.length) return 'No permissions'
  if (parts.length <= 2) return parts.join(', ')
  return `${parts.slice(0, 2).join(', ')}, +${parts.length - 2} more`
}

const getExpiryDisplay = (token: IApiTokenInfo) => {
  if (!token.expiry) return '-'
  const date = new Date(token.expiry)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days}d`
}

const getExpiryColor = (token: IApiTokenInfo) => {
  if (!token.expiry) return ''
  const date = new Date(token.expiry)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return 'text-red-600'
  if (days < 7) return 'text-red-500'
  if (days < 30) return 'text-yellow-600'
  return 'text-nc-content-gray-muted'
}

const getRelativeTime = (dateStr: string | undefined) => {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

const isFineGrained = (token: IApiTokenInfo) => {
  return !!(token.scopes?.length) || !!token.expiry || !!token.token_prefix
}
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncKey2" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">{{ $t('title.tokens') }}</span>
      </template>
    </NcPageHeader>

    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="max-w-250 mx-auto h-full w-full" data-testid="nc-token-list">
        <div class="flex gap-4 items-baseline justify-between">
          <h6 class="text-xl text-left font-bold my-0 text-nc-content-gray" data-rec="true">{{ $t('title.apiTokens') }}</h6>
          <NcButton
            class="!rounded-md"
            data-testid="nc-token-create"
            size="middle"
            type="primary"
            @click="showWizard = true"
          >
            <span data-rec="true">{{ $t('title.addNewToken') }}</span>
          </NcButton>
        </div>
        <span data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>

        <!-- Token List -->
        <div v-if="!isLoadingAllTokens && tokens.length" class="mt-6">
          <div class="rounded-md border overflow-hidden">
            <!-- Header -->
            <div class="flex w-full bg-nc-bg-gray-extralight border-b px-4">
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[18%]">Name</span>
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[10%]">Scope</span>
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[22%]">Permissions</span>
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[10%]">Expires</span>
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[12%]">Last Used</span>
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[13%]">Token</span>
              <span class="py-3 text-nc-content-gray-muted font-medium text-xs w-[15%] text-right">Actions</span>
            </div>

            <!-- Rows -->
            <div
              v-for="el in tokens"
              :key="el.id"
              class="flex items-center w-full px-4 py-2.5 border-b last:border-b-0 hover:bg-nc-bg-gray-extralight/30"
              data-testid="nc-token-row"
            >
              <!-- Name -->
              <div class="w-[18%] flex items-center gap-2">
                <span class="text-sm font-medium text-nc-content-gray-extreme truncate">{{ el.title || el.description }}</span>
                <NcTooltip v-if="el.fk_sso_client_id" placement="top">
                  <template #title>SSO-generated token</template>
                  <NcBadge color="orange" class="!text-[10px] !py-0 !px-1">SSO</NcBadge>
                </NcTooltip>
              </div>

              <!-- Scope -->
              <div class="w-[10%]" data-testid="nc-token-scope">
                <NcBadge :color="getScopeBadgeColor(el)" class="!text-[10px]">
                  {{ getScopeSummary(el) }}
                </NcBadge>
              </div>

              <!-- Permissions -->
              <div class="w-[22%]" data-testid="nc-token-permissions">
                <span class="text-xs text-nc-content-gray-muted truncate">
                  {{ getPermissionsSummary(el) }}
                </span>
              </div>

              <!-- Expires -->
              <div class="w-[10%]" data-testid="nc-token-expiry">
                <span class="text-xs" :class="getExpiryColor(el)">
                  {{ getExpiryDisplay(el) }}
                </span>
              </div>

              <!-- Last Used -->
              <div class="w-[12%]">
                <span class="text-xs text-nc-content-gray-muted">
                  {{ getRelativeTime(el.last_used_at) }}
                </span>
              </div>

              <!-- Token prefix -->
              <div class="w-[13%]">
                <span v-if="el.token_prefix" class="text-xs text-nc-content-gray-muted font-mono">
                  {{ el.token_prefix }}...
                </span>
                <span v-else-if="el.token" class="text-xs text-nc-content-gray-muted font-mono">
                  {{ el.token?.substring(0, 12) }}...
                </span>
                <span v-else class="text-xs text-nc-content-gray-muted">-</span>
              </div>

              <!-- Actions -->
              <div class="w-[15%] flex items-center justify-end gap-2">
                <NcTooltip v-if="isFineGrained(el)" placement="top">
                  <template #title>{{ el.enabled === false ? 'Enable' : 'Disable' }}</template>
                  <a-switch
                    :checked="el.enabled !== false"
                    size="small"
                    data-testid="nc-token-toggle-enabled"
                    @change="toggleEnabled(el)"
                  />
                </NcTooltip>
                <NcTooltip v-if="el.token" placement="top">
                  <template #title>Copy token</template>
                  <component
                    :is="iconMap.copy"
                    class="cursor-pointer w-4 h-4 text-nc-content-gray-subtle2 hover:text-nc-content-gray"
                    @click="copyToken(el.token)"
                  />
                </NcTooltip>
                <NcTooltip placement="top">
                  <template #title>Delete</template>
                  <component
                    :is="iconMap.delete"
                    class="cursor-pointer w-4 h-4 text-nc-content-gray-subtle2 hover:text-red-500"
                    data-testid="nc-token-row-action-icon"
                    @click="triggerDeleteModal(el)"
                  />
                </NcTooltip>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!isLoadingAllTokens && !tokens.length"
          class="max-w-[40rem] border px-3 py-6 flex flex-col items-center justify-center gap-6 text-center mt-6"
        >
          <img src="~assets/img/placeholder/api-tokens.png" class="!w-[22rem] flex-none" />
          <div class="text-2xl text-nc-content-gray font-bold">{{ $t('placeholder.noTokenCreated') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">{{ $t('placeholder.noTokenCreatedLabel') }}</div>
          <NcButton class="!rounded-lg !py-3 !h-10" type="primary" @click="showWizard = true">
            {{ $t('title.createNewToken') }}
          </NcButton>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.total > 10" class="flex items-center justify-center mt-5">
          <a-pagination
            v-model:current="currentPage"
            :total="pagination.total"
            show-less-items
            @change="loadTokens(currentPage, currentLimit)"
          />
        </div>
      </div>

      <!-- Create Wizard Modal -->
      <a-modal
        v-model:visible="showWizard"
        :footer="null"
        :closable="false"
        width="640px"
        :mask-closable="false"
        :destroy-on-close="true"
      >
        <AccountTokenCreateWizard @created="onWizardCreated" @cancel="showWizard = false" />
      </a-modal>

      <!-- Delete Confirmation -->
      <GeneralDeleteModal
        v-model:visible="isModalOpen"
        :entity-name="$t('labels.token')"
        :on-delete="deleteToken"
      >
        <template #entity-preview>
          <span>
            <div class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle mb-4">
              <GeneralIcon icon="key" class="nc-view-icon" />
              <div class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75" style="word-break: keep-all; white-space: nowrap; display: inline">
                {{ tokenToDeleteDesc }}
              </div>
            </div>
          </span>
        </template>
      </GeneralDeleteModal>
    </div>
  </div>
</template>
