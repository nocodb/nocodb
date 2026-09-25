<script setup lang="ts">
import { ApiTokenPermissionLevel } from 'nocodb-sdk'
import dayjs from 'dayjs'

/**
 * The account MCP surface. With `lockedBaseId` (base settings → MCP Server)
 * it lists only connections that reach that base and creates new ones pinned
 * to it, the way the API-token page does.
 */
const props = defineProps<{
  lockedBaseId?: string
}>()

const { t } = useI18n()

const { accountMcpTokens, listAccountMcpTokens, regenerateAccountMcpToken, isScopedMcpToken } = useMcpSettings()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('MCPToken')

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const entries = Object.entries(value)
    if (entries.length > 0) {
      const [field, direction] = entries[0]
      saveOrUpdateSort({
        field,
        direction,
      })
    }
  },
})

const isLoading = ref(false)

const mcpSearch = ref('')

// Found by the name it was given or by the base it reaches.
const filteredMcpTokens = computed(() =>
  accountMcpTokens.value.filter((token: any) => searchCompare([token.title, token.base?.title], mcpSearch.value)),
)

const sortedMcpTokens = computed(() => handleGetSortedData(filteredMcpTokens.value, sorts.value))

// `name` and `access` flex; `created_at` and `action` are fixed. The four
// minimums have to fit the narrowest shell this page gets -- `max-w-202` is
// 808px, but the column is fluid below that and measures ~655px at a 1024px
// viewport. Overflow has no escape hatch here: the table clips at
// `overflow-x: hidden` and shows no scrollbar, so a row wider than its
// container puts the action menu (edit, regenerate, delete) out of reach.
const columns = computed<NcTableColumnProps[]>(() => [
  {
    key: 'name',
    title: t('general.name'),
    name: 'Token',
    minWidth: 180,
    padding: '0px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'access',
    title: t('general.access'),
    minWidth: 130,
    padding: '0px 24px',
    showOrderBy: false,
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    // Fixed and min agree: a larger min overflows the fixed outer cell, a
    // smaller one wraps the header onto two lines.
    width: 180,
    minWidth: 180,
    padding: '0px 24px',
    showOrderBy: true,
    dataIndex: 'created_at',
  },
  {
    key: 'action',
    // Shell lists leave the actions header blank.
    title: props.lockedBaseId ? '' : t('general.action'),
    // Holds one 33px icon button, right-aligned.
    width: 120,
    minWidth: 120,
    padding: '0px 24px',
    justify: 'justify-end',
    align: 'center',
  },
])

const loadUserMcpTokens = async () => {
  try {
    isLoading.value = true
    await listAccountMcpTokens(props.lockedBaseId)
  } catch (error: any) {
    message.error(await extractSdkResponseErrorMsg(error))
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

const isTokenModalVisible = ref(false)
const activeToken = ref<MCPTokenExtendedType | null>(null)

const handleOpenTokenModal = (token: MCPTokenExtendedType) => {
  activeToken.value = token
  isTokenModalVisible.value = true
}

const viewMode = ref<'list' | 'create'>('list')

const editingToken = ref<MCPTokenExtendedType | null>(null)

const revealToken = ref<MCPTokenExtendedType | null>(null)

const regenerateToken = async (token: MCPTokenExtendedType) => {
  const newToken = await regenerateAccountMcpToken(token)

  if (!newToken) return

  // A legacy connection has no page of its own; the modal still shows its config.
  if (!isScopedMcpToken(newToken)) return handleOpenTokenModal(newToken)

  editingToken.value = null
  revealToken.value = newToken
  viewMode.value = 'create'
}

// Only a per-tool connection has anything to edit; a legacy one carries the
// creator's own authority in one base and a category-shaped grant cannot be
// shown in the picker.
const isEditable = (token: MCPTokenExtendedType) => isScopedMcpToken(token) && !!parseMcpTokenPermissions(token)?.tools

const openCreate = () => {
  editingToken.value = null
  revealToken.value = null
  viewMode.value = 'create'
}

const openEdit = (token: MCPTokenExtendedType) => {
  editingToken.value = token
  revealToken.value = null
  viewMode.value = 'create'
}

/** Row click: the page for a per-tool connection, the modal for a legacy one. */
const openRow = (token: MCPTokenExtendedType) => (isEditable(token) ? openEdit(token) : handleOpenTokenModal(token))

const returnToList = () => {
  editingToken.value = null
  revealToken.value = null
  viewMode.value = 'list'
}

// The page keeps showing the setup phase; only the header needs to know.
const onConnectionCreated = (token: MCPTokenExtendedType) => {
  revealToken.value = token
}

const onEditFromReveal = (token: MCPTokenExtendedType) => {
  revealToken.value = null
  editingToken.value = token
}

const confirmDeleteToken = (token: MCPTokenExtendedType) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgMCPDelete'), {
    'modelValue': isOpen,
    'mcpToken': token,
    'isAccountScope': true,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': async () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

const closeModal = async () => {
  activeToken.value = null
  isTokenModalVisible.value = false
  await loadUserMcpTokens()
}

const getFormattedDate = (date: string, format?: string) => dayjs(date).format(format || 'D MMMM YYYY, h:mm A')

/**
 * What a row grants, in words. A connection created before scopes existed has
 * no `permissions` and carries the creator's own authority in one base — said
 * plainly rather than shown as an empty scope list, since "no scopes" and
 * "every permission the user has" are opposite things.
 */
const accessSummary = (token: MCPTokenExtendedType) => {
  const parsed = parseMcpTokenPermissions(token)

  if (!parsed) {
    return {
      label: token.base?.title ? `${t('labels.fullAccess')} · ${token.base.title}` : t('labels.fullAccess'),
      legacy: true,
    }
  }

  const scopes = parsed.scopes ?? []
  const scopeLabel = `${scopes.length} ${scopes.length === 1 ? t('objects.scope') : t('objects.scopes')}`

  // A per-tool connection has nothing to say about categories — the count of
  // what it may call is the whole summary.
  if (parsed.tools) {
    const count = parsed.tools.length

    return {
      label: `${scopeLabel} · ${count} ${count === 1 ? t('objects.tool') : t('objects.tools')}`,
      legacy: false,
    }
  }

  const levels = scopes.flatMap((scope) => Object.values(scope.permissions ?? {}))

  const tier = levels.includes(ApiTokenPermissionLevel.DELETE)
    ? t('labels.mcpTools.readWriteDelete')
    : levels.includes(ApiTokenPermissionLevel.WRITE)
    ? t('labels.readAndWrite')
    : t('labels.readOnlyAccess')

  return { label: `${scopeLabel} · ${tier}`, legacy: false }
}

onMounted(async () => {
  loadSorts()
  await loadUserMcpTokens()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <NcPageHeader v-if="!lockedBaseId">
      <template #icon>
        <GeneralIcon icon="mcp" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{
            viewMode === 'create'
              ? revealToken
                ? revealToken.title
                : editingToken
                ? $t('labels.editMcpConnection')
                : $t('labels.newMcpConnection')
              : $t('title.mcpServer')
          }}
        </span>
      </template>
    </NcPageHeader>

    <!-- In the shell the pane owns padding and scroll; the account page keeps
         the API-token page's centred content column. -->
    <div
      class="flex flex-col nc-scrollbar-thin"
      :class="
        lockedBaseId
          ? 'h-full min-h-0 nc-shell-gutter pb-6 pt-3 overflow-hidden'
          : [
              'nc-content-max-w p-6 gap-6 h-[calc(100vh_-_100px)]',
              isEeUI && viewMode === 'create' ? 'min-h-0 overflow-hidden' : 'overflow-auto',
            ]
      "
    >
      <div v-if="isEeUI && viewMode === 'create'" class="w-full h-full min-h-0">
        <AccountMcpCreate
          :key="editingToken?.id || revealToken?.id || 'new'"
          :edit-token="editingToken || undefined"
          :reveal-token="revealToken || undefined"
          :locked-base-id="lockedBaseId"
          @created="onConnectionCreated"
          @edit="onEditFromReveal"
          @saved="returnToList"
          @done="returnToList"
          @cancel="returnToList"
        />
      </div>

      <div
        v-else
        class="w-full"
        :class="lockedBaseId ? 'flex-1 min-h-0 flex flex-col' : 'max-w-202 mx-auto h-full'"
        data-testid="nc-mcp-list"
      >
        <!-- Nothing to search through, so no search box: an empty field over an
             empty pane is furniture, not a control. -->
        <div v-if="lockedBaseId && (accountMcpTokens.length || mcpSearch)" class="mb-6 flex items-center justify-between gap-3">
          <a-input
            v-model:value="mcpSearch"
            type="text"
            class="nc-input-border-on-value !max-w-90 nc-input-sm"
            :placeholder="$t('placeholder.searchConnections')"
            allow-clear
            data-testid="nc-mcp-search"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
            </template>
          </a-input>
        </div>

        <!-- Shell: the title lives in the header band, the primary action in its action zone. -->
        <ShellActions v-if="lockedBaseId">
          <NcButton
            v-if="isEeUI"
            v-e="['c:mcp-connection:create:open']"
            data-testid="nc-mcp-new-connection"
            size="small"
            type="primary"
            @click="openCreate"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              <span data-rec="true">{{ $t('labels.newMcpConnection') }}</span>
            </div>
          </NcButton>
        </ShellActions>

        <template v-else>
          <div class="flex gap-4 items-baseline justify-between">
            <h6 class="text-xl text-left font-bold my-0 text-nc-content-gray" data-rec="true">
              {{ $t('labels.mcpConnections') }}
            </h6>
            <NcButton
              v-if="isEeUI"
              v-e="['c:mcp-connection:create:open']"
              class="!rounded-md"
              data-testid="nc-mcp-new-connection"
              size="middle"
              type="primary"
              @click="openCreate"
            >
              <span data-rec="true">{{ $t('labels.newMcpConnection') }}</span>
            </NcButton>
          </div>
          <span data-rec="true">{{ $t('labels.mcpConnectionsLabel') }}</span>
        </template>

        <div v-if="!lockedBaseId && isLoading" class="flex items-center justify-center h-96">
          <GeneralLoader size="xlarge" />
        </div>

        <!-- Account page empty state, same shape as the API-token page -->
        <div
          v-else-if="!lockedBaseId && isEeUI && !sortedMcpTokens.length"
          class="max-w-[40rem] mx-auto px-3 py-6 flex flex-col items-center justify-center gap-6 text-center"
          data-testid="nc-mcp-empty"
        >
          <img src="~assets/img/placeholder/api-tokens.png" class="!w-[22rem] flex-none" />
          <div class="text-2xl text-nc-content-gray font-bold">{{ $t('placeholder.noMcpConnections') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('placeholder.noMcpConnectionsLabel') }}
          </div>
          <NcButton
            v-e="['c:mcp-connection:create:open']"
            class="!rounded-lg !py-3 !h-10"
            data-testid="nc-mcp-new-connection-empty"
            type="primary"
            @click="openCreate"
          >
            <span data-rec="true">{{ $t('labels.newMcpConnection') }}</span>
          </NcButton>
        </div>

        <NcTable
          v-else
          v-model:order-by="orderBy"
          :hide-on-empty="!!lockedBaseId"
          :columns="columns"
          :header-row-height="lockedBaseId ? '54px' : '44px'"
          :row-height="lockedBaseId ? '54px' : '44px'"
          :data="sortedMcpTokens"
          :is-data-loading="!!lockedBaseId && isLoading"
          class="max-h-full min-h-0 w-full"
          :class="{ 'mt-6': !lockedBaseId }"
          body-row-class-name="nc-account-mcp-token-item group no-border-last cursor-pointer"
          @row-click="openRow"
        >
          <template #bodyCell="{ column, record: token }">
            <template v-if="column.key === 'name'">
              <NcTooltip
                class="truncate w-full text-nc-content-gray"
                :class="lockedBaseId ? 'text-captionMedium' : 'font-semibold text-sm'"
              >
                {{ token.title }}

                <template #title>
                  <div class="text-captionSm uppercase pt-1 text-nc-content-brand-hover">
                    {{ $t('labels.createdOn') }}
                  </div>
                  <div class="mt-1 text-bodyDefaultSm">
                    {{ dayjs(token.created_at).format('D MMMM YYYY, hh:mm A') }}
                  </div>
                </template>
              </NcTooltip>
            </template>

            <template v-if="column.key === 'access'">
              <div class="flex items-center gap-2 truncate">
                <span
                  class="truncate"
                  :class="lockedBaseId ? 'text-bodyDefaultSm text-nc-content-gray-subtle2' : 'text-nc-content-gray-subtle'"
                >
                  {{ accessSummary(token).label }}
                </span>
                <NcTooltip v-if="accessSummary(token).legacy">
                  <NcBadge :border="false" size="xs" class="!bg-nc-bg-orange-light !text-nc-content-orange-dark text-captionSm">
                    {{ $t('labels.legacy') }}
                  </NcBadge>
                  <template #title>{{ $t('msg.info.mcpLegacyConnection') }}</template>
                </NcTooltip>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <NcDropdown placement="bottomRight">
                <NcButton type="secondary" size="small" class="nc-row-action" @click.stop>
                  <GeneralIcon icon="threeDotVertical" />
                </NcButton>

                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem
                      v-if="isEditable(token)"
                      v-e="['c:mcp-connection:edit:open']"
                      data-testid="nc-mcp-connection-edit"
                      @click.stop="openEdit(token)"
                    >
                      <GeneralIcon icon="edit" />
                      {{ $t('labels.editMcpConnection') }}
                    </NcMenuItem>
                    <NcMenuItem @click.stop="regenerateToken(token)">
                      <GeneralIcon icon="refresh" />
                      {{ $t('labels.regenerateToken') }}
                    </NcMenuItem>
                    <NcDivider />
                    <NcMenuItem danger @click.stop="confirmDeleteToken(token)">
                      <GeneralIcon icon="delete" />
                      {{ $t('labels.deleteToken') }}
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </template>

            <template v-if="column.key === 'created_at'">
              <div
                v-if="token.created_at"
                :class="lockedBaseId ? 'text-bodyDefaultSm text-nc-content-gray-subtle2' : 'text-nc-content-gray-subtle'"
              >
                {{ getFormattedDate(token.created_at, 'D MMM YYYY') }}
              </div>
            </template>
          </template>

          <template v-if="lockedBaseId" #emptyText>
            <ShellEmpty :title="mcpSearch ? $t('title.noResultsMatchedYourSearch') : $t('labels.noMcpConnectionsYet')" />
          </template>
        </NcTable>
      </div>

      <DashboardSettingsBaseMCPModal
        v-if="isTokenModalVisible"
        v-model:visible="isTokenModalVisible"
        v-model:token="activeToken"
        :show-regenerate-button="false"
        :show-workspace-base-info="true"
        :is-account-level="true"
        @close="closeModal"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-account-mcp-token-item {
  @apply hover:bg-nc-bg-gray-extralight;
}
</style>
