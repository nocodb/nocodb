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

const sortedMcpTokens = computed(() => handleGetSortedData(accountMcpTokens.value, sorts.value))

// `name` and `access` flex; `created_at` and `action` are fixed (150 + 162).
// The mins have to leave those two room inside the `max-w-202` (808px) shell,
// or the row overflows and the action menu lands outside the clipped container
// with no scrollbar to reach it.
const columns = [
  {
    key: 'name',
    title: t('general.name'),
    name: 'Token',
    minWidth: 240,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'access',
    title: t('general.access'),
    minWidth: 180,
    showOrderBy: false,
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    width: 150,
    // Matches `width`: a larger min only makes the inner cell overflow the
    // fixed outer one.
    minWidth: 150,
    showOrderBy: true,
    dataIndex: 'created_at',
  },
  {
    key: 'action',
    title: t('general.action'),
    width: 162,
    minWidth: 162,
    justify: 'justify-end',
    align: 'center',
  },
] as NcTableColumnProps[]

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

    <!-- Same shell as the API-token page: one content column, list capped at the same width. -->
    <div
      class="nc-content-max-w p-6 flex flex-col gap-6 nc-scrollbar-thin"
      :class="[
        lockedBaseId ? 'h-full' : 'h-[calc(100vh_-_100px)]',
        isEeUI && viewMode === 'create' ? 'min-h-0 overflow-hidden' : 'overflow-auto',
      ]"
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

      <div v-else class="max-w-202 mx-auto h-full w-full" data-testid="nc-mcp-list">
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
        <span data-rec="true">
          {{ lockedBaseId ? $t('msg.info.mcpConnectionsReachingBase') : $t('labels.mcpConnectionsLabel') }}
        </span>

        <div v-if="isLoading" class="flex items-center justify-center h-96">
          <GeneralLoader size="xlarge" />
        </div>

        <!-- Empty state, same shape as the API-token page -->
        <div
          v-else-if="isEeUI && !sortedMcpTokens.length"
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
          :columns="columns"
          header-row-height="44px"
          row-height="44px"
          :data="sortedMcpTokens"
          class="h-full mt-6"
          body-row-class-name="nc-account-mcp-token-item group no-border-last cursor-pointer"
          @row-click="openRow"
        >
          <template #bodyCell="{ column, record: token }">
            <template v-if="column.key === 'name'">
              <NcTooltip class="truncate text-nc-content-gray font-semibold text-sm">
                {{ token.title }}

                <template #title>
                  <div class="text-[10px] leading-[14px] uppercase font-semibold pt-1 text-nc-content-brand-hover">
                    {{ $t('labels.createdOn') }}
                  </div>
                  <div class="mt-1 text-[13px]">
                    {{ dayjs(token.created_at).format('D MMMM YYYY, hh:mm A') }}
                  </div>
                </template>
              </NcTooltip>
            </template>

            <template v-if="column.key === 'access'">
              <div class="flex items-center gap-2 truncate">
                <span class="text-nc-content-gray-subtle truncate">{{ accessSummary(token).label }}</span>
                <NcTooltip v-if="accessSummary(token).legacy">
                  <NcBadge :border="false" class="!bg-nc-bg-orange-light !text-nc-content-orange-dark px-1 text-tiny">
                    {{ $t('labels.legacy') }}
                  </NcBadge>
                  <template #title>{{ $t('msg.info.mcpLegacyConnection') }}</template>
                </NcTooltip>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <NcDropdown>
                <NcButton type="secondary" class="!hidden !group-hover:block" size="small" @click.stop>
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
              <div v-if="token.created_at" class="text-nc-content-gray-subtle">
                {{ getFormattedDate(token.created_at, 'D MMM YYYY') }}
              </div>
            </template>
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
