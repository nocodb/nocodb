<script lang="ts" setup>
import type { ApiTokenType, RequestParams } from 'nocodb-sdk'

interface Props {
  /** Embedded in a base's settings: the account page chrome is dropped. CE has no token scopes. */
  lockedBaseId?: string
}

const props = withDefaults(defineProps<Props>(), {
  lockedBaseId: undefined,
})

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

const columns: NcTableColumnProps[] = [
  { key: 'name', title: t('title.tokenName'), minWidth: 200, padding: '0px 24px' },
  { key: 'creator', title: t('title.creator'), minWidth: 180, basis: '28%', padding: '0px 24px' },
  { key: 'token', title: t('labels.token'), minWidth: 200, basis: '30%', padding: '0px 24px' },
  { key: 'actions', title: '', width: 80, minWidth: 80, padding: '0px 24px', justify: 'justify-end' },
]

// Rows open nothing in CE; NcTable's default pointer would promise otherwise.
const customRow = () => ({ 'data-testid': 'nc-token-row', 'class': '!cursor-default' })

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

const isTokenShown = (token: IApiTokenInfo) => selectedToken.isShow && selectedToken.id === token.token

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
  if (props.lockedBaseId) {
    viewMode.value = 'create'
    return
  }

  navigateTo('/account/tokens/new')
}

const onTokenCreated = () => {
  loadTokens()
  loadAllTokens(pagination.total + 1)
}

const returnToList = () => {
  viewMode.value = 'list'

  if (props.lockedBaseId) return

  navigateTo('/account/tokens')
}

const onCreateCancel = () => {
  returnToList()
}
</script>

<template>
  <div class="flex flex-col" :class="{ 'h-full min-h-0': lockedBaseId }">
    <NcPageHeader v-if="!lockedBaseId">
      <template #icon>
        <GeneralIcon icon="ncKey2" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ viewMode === 'list' ? $t('title.tokens') : $t('title.createNewToken') }}
        </span>
      </template>
    </NcPageHeader>
    <div
      class="flex flex-col min-h-0"
      :class="
        lockedBaseId
          ? 'h-full nc-shell-gutter pb-6 pt-3'
          : 'nc-content-max-w p-6 gap-6 overflow-auto nc-scrollbar-thin h-[calc(100vh_-_100px)]'
      "
    >
      <!-- ============ CREATE FORM ============ -->
      <div v-if="viewMode === 'create'" class="w-full" :class="lockedBaseId ? 'max-w-3xl' : 'max-w-202 mx-auto'">
        <AccountTokenCreateWizard @created="onTokenCreated" @cancel="onCreateCancel" />
      </div>

      <!-- ============ TOKEN LIST ============ -->
      <div
        v-else
        class="flex flex-col h-full w-full min-h-0"
        :class="{ 'max-w-202 mx-auto': !lockedBaseId }"
        data-testid="nc-token-list"
      >
        <!-- Account page keeps its own heading; in the shell the header band names the pane. -->
        <template v-if="!lockedBaseId">
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
        </template>

        <ShellActions v-else>
          <NcButton type="primary" size="small" data-testid="nc-token-create" @click="openCreateForm">
            <div class="flex items-center gap-x-1">
              <GeneralIcon icon="plus" />
              <span>{{ $t('labels.newApiToken') }}</span>
            </div>
          </NcButton>
        </ShellActions>

        <div class="flex-1 min-h-0 flex flex-col" :class="{ 'mt-6': !lockedBaseId }">
          <NcTable
            hide-on-empty
            :columns="columns"
            :data="tokens"
            :is-data-loading="isLoadingAllTokens"
            :custom-row="customRow"
            row-height="54px"
            header-row-height="54px"
            class="max-h-full min-h-0 w-full"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="flex items-center gap-1.5 w-full min-w-0">
                  <NcTooltip
                    :title="record.description"
                    show-on-truncate-only
                    class="text-captionMedium text-nc-content-gray truncate"
                  >
                    {{ record.description }}
                  </NcTooltip>
                  <NcTooltip v-if="record.fk_sso_client_id" :title="$t('msg.ssoTokenTooltip')" placement="top">
                    <NcBadge color="orange" size="xs" class="flex-none text-bodySm">SSO</NcBadge>
                  </NcTooltip>
                </div>
              </template>

              <template v-else-if="column.key === 'creator'">
                <NcTooltip
                  :title="record.created_by"
                  show-on-truncate-only
                  class="text-bodyDefaultSm text-nc-content-gray-subtle2 truncate"
                >
                  {{ record.created_by }}
                </NcTooltip>
              </template>

              <template v-else-if="column.key === 'token'">
                <NcTooltip
                  v-if="isTokenShown(record)"
                  :title="record.token"
                  show-on-truncate-only
                  class="text-bodyDefaultSm text-nc-content-gray-subtle2 truncate"
                >
                  {{ record.token }}
                </NcTooltip>
                <span v-else class="text-bodyDefaultSm text-nc-content-gray-subtle2">************************************</span>
              </template>

              <template v-else-if="column.key === 'actions'">
                <div class="flex justify-end" @click.stop>
                  <NcDropdown placement="bottomRight">
                    <NcButton type="secondary" size="small" data-testid="nc-token-row-action-icon" class="nc-row-action">
                      <GeneralIcon icon="threeDotVertical" />
                    </NcButton>
                    <template #overlay>
                      <NcMenu variant="small">
                        <NcMenuItem class="nc-toggle-token-visibility" @click="hideOrShowToken(record.token as string)">
                          <GeneralIcon :icon="isTokenShown(record) ? 'ncEyeOff' : 'ncEye'" />
                          <span>{{ $t('labels.showOrHide') }}</span>
                        </NcMenuItem>
                        <NcMenuItem @click="copyToken(record.token)">
                          <GeneralIcon icon="copy" />
                          <span>{{ $t('labels.copyToken') }}</span>
                        </NcMenuItem>
                        <NcDivider />
                        <NcMenuItem
                          danger
                          data-testid="nc-token-row-delete"
                          @click="triggerDeleteModal(record.token as string, record.description as string)"
                        >
                          <GeneralIcon icon="delete" />
                          <span>{{ $t('general.delete') }}</span>
                        </NcMenuItem>
                      </NcMenu>
                    </template>
                  </NcDropdown>
                </div>
              </template>
            </template>

            <template #emptyText>
              <ShellEmpty :title="$t('placeholder.noTokenCreated')" />
            </template>
          </NcTable>
        </div>

        <div v-if="pagination.total > 10 && !lockedBaseId" class="flex-none flex items-center justify-center mt-5">
          <a-pagination
            v-model:current="currentPage"
            :total="pagination.total"
            show-less-items
            @change="loadTokens(currentPage, currentLimit)"
          />
        </div>
      </div>
    </div>

    <GeneralDeleteModal
      v-model:visible="isModalOpen"
      :entity-name="$t('labels.token')"
      :on-delete="() => deleteToken(tokenToCopy)"
    >
      <template #entity-preview>
        <div
          class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle mb-4"
        >
          <GeneralIcon icon="ncKey2" class="flex-none" />
          <div class="text-ellipsis overflow-hidden whitespace-nowrap select-none w-full pl-1.75">
            {{ tokenDesc }}
          </div>
        </div>
      </template>
    </GeneralDeleteModal>
  </div>
</template>
