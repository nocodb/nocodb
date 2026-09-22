<script setup lang="ts">
import dayjs from 'dayjs'

/**
 * Base settings -> MCP Server. Takes the base explicitly, the way the API-token
 * pane does: `activeProjectId` is a different source that need not be the base
 * these settings were opened for, and getting it wrong silently unpins the
 * surface -- the list stops being filtered and a new connection is no longer
 * pinned.
 */
const props = defineProps<{
  baseId: string
}>()

const { t } = useI18n()

const newTokenInputRef = ref()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Webhook') // Using 'Webhook' as the sort type since 'MCPToken' isn't defined

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

const {
  mcpTokens,
  createMcpToken,
  listMcpTokens,
  cancelNewMcpToken,
  isUnsavedMCPTokenPending,
  addNewMcpToken: _addNewMcpToken,
  isCreatingMcpToken,
  newMcpTokenTitle,
  updateMcpToken,
} = useMcpSettings()

const addNewMcpToken = () => {
  _addNewMcpToken()

  nextTick(() => {
    newTokenInputRef.value.focus()
  })
}

const sortedMcpTokens = computed(() => handleGetSortedData(mcpTokens.value, sorts.value))

const columns = [
  {
    key: 'name',
    title: t('general.name'),
    name: 'Token',
    minWidth: 397,
    padding: '0px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    width: 150,
    minWidth: 180,
    padding: '0px 24px',
    showOrderBy: true,
    dataIndex: 'created_at',
  },
  {
    key: 'action',
    title: '',
    width: 162,
    minWidth: 162,
    padding: '0px 24px',
    justify: 'justify-end',
    align: 'center',
  },
] as NcTableColumnProps[]

onMounted(async () => {
  loadSorts()
  await listMcpTokens()
})

const isTokenModalVisible = ref(false)

const activeToken = ref<MCPTokenExtendedType | null>(null)

const handleOpenTokenModal = (token: MCPTokenExtendedType) => {
  if (token.isNew) return
  activeToken.value = token
  isTokenModalVisible.value = true
}

const createTokenWithExpiry = async (token: Partial<MCPTokenExtendedType>) => {
  const res = await createMcpToken(token)

  if (res) {
    handleOpenTokenModal(res)
  }
}

const regenerateToken = async (token: MCPTokenExtendedType) => {
  const newToken = await updateMcpToken(token)

  if (newToken) {
    handleOpenTokenModal(newToken)
  }
}

const closeModal = async () => {
  activeToken.value = null
  isTokenModalVisible.value = false
  await listMcpTokens()
}

const confirmDeleteToken = (token: MCPTokenExtendedType) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgMCPDelete'), {
    'modelValue': isOpen,
    'mcpToken': token,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': async () => {
      closeDialog()
      await listMcpTokens()
    },
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

const getFormattedDate = (date: string, format?: string) => dayjs(date).format(format || 'D MMMM YYYY, h:mm A')
</script>

<template>
  <!-- The composable is shared, so the account page's create also flips this
       flag; the overlay belongs to the CE inline flow only. -->
  <div
    v-if="isCreatingMcpToken && !isEeUI"
    class="absolute w-full h-full inset-0 flex items-center justify-center z-90 bg-black/12"
  >
    <div
      style="box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1)"
      class="bg-nc-bg-default p-6 flex flex-col w-[488px] rounded-2xl dark:(border-1 border-nc-border-gray-medium)"
    >
      <div class="text-nc-content-gray-emphasis text-lg font-bold">{{ $t('labels.creatingMCPToken') }}</div>
      <div class="text-nc-gray-subtle2 mt-2">
        {{ $t('labels.creatingTokenDescription') }}
      </div>

      <div class="w-full flex justify-between items-center gap-3 mt-5">
        <GeneralLoader size="xlarge" />
      </div>
    </div>
  </div>

  <!-- One MCP surface: on EE this is the account page pinned to the base, the
       way base settings → API Tokens reuses the account token page. CE has no
       scopes, so it keeps its own inline list below. -->
  <AccountMcp v-if="isEeUI" :locked-base-id="props.baseId" />

  <div v-else class="flex flex-col h-full min-h-0 px-6 pb-6 pt-3">
    <ShellActions>
      <NcButton
        :disabled="isUnsavedMCPTokenPending"
        type="primary"
        data-testid="add-new-mcp-token"
        size="small"
        @click="addNewMcpToken"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="plus" />
          {{ $t('labels.newMCPEndpoint') }}
        </div>
      </NcButton>
    </ShellActions>

    <div class="flex-1 min-h-0 flex flex-col">
      <NcTable
        v-model:order-by="orderBy"
        hide-on-empty
        :columns="columns"
        header-row-height="54px"
        row-height="54px"
        :data="sortedMcpTokens"
        class="max-h-full min-h-0 w-full"
        body-row-class-name="nc-base-settings-mcp-token-item group no-border-last"
        @row-click="handleOpenTokenModal"
      >
        <template #bodyCell="{ column, record: token }">
          <template v-if="column.key === 'name'">
            <NcTooltip v-if="!token.isNew" class="truncate w-full text-captionBold text-nc-content-gray">
              {{ token.title }}

              <template #title>
                <div class="text-captionSm uppercase pt-1 text-nc-content-brand-hover">
                  {{ $t('labels.createdOn') }}
                </div>
                <div class="mt-1 text-bodyDefaultSm">
                  {{ dayjs(token.created_at).format('D MMMM YYYY, hh:mm A') }}
                </div>
                <div class="text-captionSm uppercase mt-2 text-nc-content-brand-hover">
                  {{ $t('labels.createdBy') }}
                </div>
                <div class="mt-1 pb-1 text-bodyDefaultSm">
                  {{ token.created_display_name }}
                </div>
              </template>
            </NcTooltip>
            <a-input
              v-else
              ref="newTokenInputRef"
              v-model:value="newMcpTokenTitle"
              class="new-token-title"
              :placeholder="$t('title.tokenName')"
              @keydown.enter="createTokenWithExpiry(token)"
              @keydown.esc="cancelNewMcpToken"
            />
          </template>

          <template v-if="column.key === 'created_at'">
            <div v-if="!token.isNew && token.created_at" class="text-bodyDefaultSm text-nc-content-gray-subtle2">
              {{ getFormattedDate(token.created_at, 'D MMM YYYY') }}
            </div>
          </template>

          <template v-if="column.key === 'action'">
            <NcDropdown v-if="!token.isNew" placement="bottomRight">
              <NcButton type="secondary" size="small" @click.stop>
                <GeneralIcon icon="threeDotVertical" />
              </NcButton>

              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItem @click="regenerateToken(token)">
                    <GeneralIcon icon="refresh" />
                    {{ $t('labels.regenerateToken') }}
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem danger @click="confirmDeleteToken(token)">
                    <GeneralIcon icon="delete" />
                    {{ $t('labels.deleteToken') }}
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
            <div v-else class="flex gap-2">
              <NcButton data-testid="cancel-token-btn" type="secondary" size="small" @click.stop="cancelNewMcpToken()">
                {{ $t('general.cancel') }}
              </NcButton>

              <NcButton data-testid="create-token-btn" type="primary" size="small" @click.stop="createTokenWithExpiry(token)">
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </template>
        </template>

        <template #emptyText>
          <ShellEmpty :title="$t('labels.noMcpConnectionsYet')">
            <template #action>
              <NcButton
                :disabled="isUnsavedMCPTokenPending"
                type="primary"
                data-testid="add-new-mcp-token-empty"
                size="small"
                @click="addNewMcpToken"
              >
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="plus" />
                  {{ $t('labels.newMCPEndpoint') }}
                </div>
              </NcButton>
            </template>
          </ShellEmpty>
        </template>
      </NcTable>
    </div>

    <DashboardSettingsBaseMCPModal
      v-if="isTokenModalVisible"
      v-model:visible="isTokenModalVisible"
      v-model:token="activeToken"
      @close="closeModal"
    />
  </div>
</template>

<style scoped lang="scss">
.ant-input {
  @apply rounded-lg py-1 px-3 h-8 border-1 focus:border-nc-border-brand border-nc-border-gray-medium;
}
</style>
