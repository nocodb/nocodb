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
const showEditModal = ref(false)
const editingToken = ref<IApiTokenInfo | null>(null)
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
    const v3List = await loadV3Tokens()
    if (v3List.length || page === 1) {
      const allItems = v3List
      pagination.total = allItems.length
      const start = (page - 1) * limit
      tokens.value = allItems.slice(start, start + limit)

      if (!allTokens.value.length) {
        allTokens.value = allItems
      }
      return
    }

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
  loadTokens()
  loadAllTokens(pagination.total + 1)
}

const openEditModal = (token: IApiTokenInfo) => {
  editingToken.value = token
  showEditModal.value = true
}

const onEditSaved = () => {
  showEditModal.value = false
  editingToken.value = null
  loadTokens()
}

const onEditCancel = () => {
  showEditModal.value = false
  editingToken.value = null
}

const getScopeSummary = (token: IApiTokenInfo) => {
  if (!token.scopes?.length) return 'Org-wide'
  const count = token.scopes.length
  const types = [...new Set(token.scopes.map((s) => s.resource_type))]
  if (types.length === 1 && types[0] === 'base') {
    return count === 1 ? '1 base' : `${count} bases`
  }
  return count === 1 ? '1 resource' : `${count} resources`
}

const getPermissionsSummary = (token: IApiTokenInfo) => {
  const perms = token.scopes?.[0]?.permissions
  if (!perms) return 'Full access'

  const writeCount = Object.values(perms).filter((v) => v === 'write').length
  const readCount = Object.values(perms).filter((v) => v === 'read').length
  const total = Object.keys(perms).length

  if (writeCount === total) return 'Full access'
  if (writeCount === 0 && readCount === 0) return 'No access'
  if (writeCount === 0) return 'Read-only'
  return 'Custom'
}

const getExpiryDisplay = (token: IApiTokenInfo) => {
  if (!token.expiry) return 'No expiry'
  const date = new Date(token.expiry)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 30) return `Expires in ${days}d`
  if (days < 365) return `Expires in ${Math.floor(days / 30)}mo`
  return `Expires in ${Math.floor(days / 365)}y`
}

const isExpired = (token: IApiTokenInfo) => {
  if (!token.expiry) return false
  return new Date(token.expiry) < new Date()
}

const isExpiringSoon = (token: IApiTokenInfo) => {
  if (!token.expiry) return false
  const days = Math.ceil((new Date(token.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return days >= 0 && days < 7
}

const isFineGrained = (token: IApiTokenInfo) => {
  return !!(token.scopes?.length) || !!token.expiry || !!token.token_prefix
}

const getRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const columns = computed<NcTableColumnProps[]>(() => [
  {
    key: 'token',
    title: t('title.tokenName'),
    minWidth: 220,
    dataIndex: 'title',
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 130,
    minWidth: 130,
    justify: 'justify-end',
  },
])
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
      <div class="max-w-195 mx-auto h-full w-full" data-testid="nc-token-list">
        <div class="flex gap-4 items-center justify-between">
          <h6 class="text-xl font-bold my-0 text-nc-content-gray" data-rec="true">{{ $t('title.apiTokens') }}</h6>
          <NcButton
            data-testid="nc-token-create"
            size="small"
            type="primary"
            @click="showWizard = true"
          >
            <div class="flex items-center gap-1" data-rec="true">
              <component :is="iconMap.plus" />
              {{ $t('title.addNewToken') }}
            </div>
          </NcButton>
        </div>

        <span class="text-sm text-nc-content-gray-muted" data-rec="true">{{ $t('msg.apiTokenCreate') }}</span>

        <NcTable
          :columns="columns"
          :data="tokens"
          :is-data-loading="isLoadingAllTokens"
          body-row-class-name="group"
          class="h-[calc(100%-58px)] mt-6"
        >
          <template #bodyCell="{ column, record: el }">
            <!-- Token name + details -->
            <div v-if="column.key === 'token'" class="w-full flex gap-3 items-center" data-testid="nc-token-row">
              <div
                class="w-2 h-2 rounded-full flex-none"
                :class="el.enabled === false ? 'bg-gray-300' : 'bg-green-500'"
              />
              <div class="flex flex-col flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <NcTooltip class="text-sm !leading-5 text-nc-content-gray font-semibold truncate" show-on-truncate-only>
                    <template #title>{{ el.title || el.description }}</template>
                    {{ el.title || el.description }}
                  </NcTooltip>
                  <NcBadge
                    v-if="el.fk_sso_client_id"
                    :border="false"
                    color="orange"
                    class="text-[10px] leading-[14px] !h-[18px] font-semibold flex-none"
                  >
                    SSO
                  </NcBadge>
                  <NcBadge
                    v-if="el.enabled === false"
                    :border="false"
                    color="gray"
                    class="text-[10px] leading-[14px] !h-[18px] font-semibold flex-none"
                  >
                    Disabled
                  </NcBadge>
                </div>
                <div class="text-xs !leading-4 text-nc-content-gray-subtle2 truncate" data-testid="nc-token-scope">
                  <span v-if="el.token_prefix" class="font-mono">{{ el.token_prefix }}…</span>
                  <span v-if="el.token_prefix" class="mx-1">·</span>
                  <span data-testid="nc-token-permissions">{{ getPermissionsSummary(el) }}</span>
                  <span class="mx-1">·</span>
                  <span>{{ getScopeSummary(el) }}</span>
                  <span class="mx-1">·</span>
                  <span
                    data-testid="nc-token-expiry"
                    :class="{
                      'text-nc-content-red-medium': isExpired(el),
                      'text-nc-content-orange-medium': isExpiringSoon(el) && !isExpired(el),
                    }"
                  >{{ getExpiryDisplay(el) }}</span>
                  <template v-if="el.created_at">
                    <span class="mx-1">·</span>
                    <span>Created {{ getRelativeTime(el.created_at) }}</span>
                  </template>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="column.key === 'action'" class="flex items-center gap-2">
              <NcTooltip v-if="isFineGrained(el)" placement="top">
                <template #title>{{ el.enabled === false ? 'Enable' : 'Disable' }}</template>
                <a-switch
                  :checked="el.enabled !== false"
                  size="small"
                  data-testid="nc-token-toggle-enabled"
                  @change="toggleEnabled(el)"
                />
              </NcTooltip>

              <NcDropdown :trigger="['click']" placement="bottomRight">
                <NcButton size="xsmall" type="ghost" data-testid="nc-token-row-action-icon">
                  <component
                    :is="iconMap.threeDotVertical"
                    class="text-nc-content-gray-subtle2 h-5.5 w-5.5 rounded outline-0 p-0.5 transform transition-transform !text-gray-400 cursor-pointer hover:(!text-nc-content-inverted-secondary-disabled bg-nc-bg-gray-light)"
                  />
                </NcButton>

                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem
                      v-if="isFineGrained(el)"
                      data-testid="nc-token-row-edit-icon"
                      @click="openEditModal(el)"
                    >
                      <component :is="iconMap.edit" class="flex text-nc-content-gray-subtle2" />
                      <div>Edit</div>
                    </NcMenuItem>
                    <NcMenuItem v-if="el.token" @click="copyToken(el.token)">
                      <component :is="iconMap.copy" class="flex text-nc-content-gray-subtle2" />
                      <div data-rec="true">{{ $t('general.copy') }} token</div>
                    </NcMenuItem>
                    <NcDivider />
                    <NcMenuItem danger @click="triggerDeleteModal(el)">
                      <MaterialSymbolsDeleteOutlineRounded />
                      {{ $t('general.delete') }}
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </template>

          <template #extraRow>
            <div
              v-if="!isLoadingAllTokens && !tokens.length"
              class="w-full pt-12 pb-4 px-2 flex flex-col items-center gap-6 text-center"
            >
              <div class="text-2xl text-nc-content-gray font-bold">{{ $t('placeholder.noTokenCreated') }}</div>
              <div class="text-sm text-nc-content-gray-subtle">{{ $t('placeholder.noTokenCreatedLabel') }}</div>
              <img src="~assets/img/placeholder/api-tokens.png" class="!w-[22rem] flex-none" />
            </div>
          </template>

          <template #tableFooter>
            <div v-if="pagination.total > 10" class="px-4 py-2 flex items-center justify-center">
              <a-pagination
                v-model:current="currentPage"
                :total="pagination.total"
                show-less-items
                @change="loadTokens(currentPage, currentLimit)"
              />
            </div>
          </template>
        </NcTable>
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

      <!-- Edit Modal -->
      <a-modal
        v-model:visible="showEditModal"
        :footer="null"
        :closable="false"
        width="640px"
        :mask-closable="false"
        :destroy-on-close="true"
      >
        <AccountTokenEditModal
          v-if="editingToken"
          :token="editingToken"
          @saved="onEditSaved"
          @cancel="onEditCancel"
        />
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
              <div
                class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ tokenToDeleteDesc }}
              </div>
            </div>
          </span>
        </template>
      </GeneralDeleteModal>
    </div>
  </div>
</template>
