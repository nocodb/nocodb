<script setup lang="ts">
import dayjs from 'dayjs'

const { t } = useI18n()

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
  addNewMcpToken,
  isCreatingMcpToken,
  newMcpTokenTitle,
  updateMcpToken,
} = useMcpSettings()

const sortedMcpTokens = computed(() => handleGetSortedData(mcpTokens.value, sorts.value))

const columns = [
  {
    key: 'name',
    title: t('general.name'),
    name: 'Token',
    minWidth: 397,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    width: 150,
    minWidth: 180,
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
  <div v-if="isCreatingMcpToken" class="absolute w-full h-full inset-0 flex items-center justify-center z-90 bg-black/12">
    <div
      v-if="isCreatingMcpToken"
      style="box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1)"
      class="bg-white p-6 flex flex-col w-[488px] rounded-2xl"
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

  <div class="flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">
      {{ $t('labels.modelContextProtocol') }}
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('labels.mcpSubText') }}
    </div>

    <div class="flex items-center mt-6 gap-5">
      <NcButton
        :disabled="isUnsavedMCPTokenPending"
        type="secondary"
        data-testid="add-new-mcp-token"
        size="small"
        @click="addNewMcpToken"
      >
        {{ $t('labels.newMCPEndpoint') }}
      </NcButton>
    </div>

    <NcTable
      v-model:order-by="orderBy"
      :columns="columns"
      header-row-height="44px"
      row-height="44px"
      :data="sortedMcpTokens"
      class="h-full mt-5"
      body-row-class-name="nc-base-settings-mcp-token-item group no-border-last"
      @row-click="handleOpenTokenModal"
    >
      <template #bodyCell="{ column, record: token }">
        <template v-if="column.key === 'name'">
          <NcTooltip v-if="!token.isNew" class="truncate text-gray-800 font-semibold text-sm">
            {{ token.title }}

            <template #title>
              <div class="text-[10px] leading-[14px] uppercase font-semibold pt-1 text-gray-300">
                {{ $t('labels.createdOn') }}
              </div>
              <div class="mt-1 text-[13px]">
                {{ dayjs(token.created_at).format('D MMMM YYYY, hh:mm A') }}
              </div>
              <div class="text-[10px] leading-[14px] uppercase font-semibold mt-2 text-gray-300">
                {{ $t('labels.createdBy') }}
              </div>
              <div class="mt-1 pb-1 text-[13px]">
                {{ token.created_display_name }}
              </div>
            </template>
          </NcTooltip>
          <a-input v-else v-model:value="newMcpTokenTitle" class="new-token-title" placeholder="Token name" />
        </template>

        <template v-if="column.key === 'created_at'">
          <div v-if="!token.isNew && token.created_at" class="text-nc-content-gray-subtle">
            {{ getFormattedDate(token.created_at, 'D MMM YYYY') }}
          </div>
        </template>

        <template v-if="column.key === 'action'">
          <NcDropdown v-if="!token.isNew">
            <NcButton type="secondary" class="!hidden !group-hover:block" size="small" @click.stop>
              <GeneralIcon icon="threeDotVertical" />
            </NcButton>

            <template #overlay>
              <NcMenu variant="small">
                <NcMenuItem @click="regenerateToken(token)">
                  <GeneralIcon icon="refresh" />
                  {{ $t('labels.regenerateToken') }}
                </NcMenuItem>
                <NcDivider />
                <NcMenuItem class="!text-nc-content-red-dark !hover:bg-nc-bg-red-light" @click="confirmDeleteToken(token)">
                  <GeneralIcon icon="ncTrash2" />
                  {{ $t('labels.deleteToken') }}
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
          <div v-else>
            <div class="flex gap-2">
              <NcButton data-testid="cancel-token-btn" type="secondary" size="small" @click.stop="cancelNewMcpToken()">
                {{ $t('general.cancel') }}
              </NcButton>

              <NcButton data-testid="create-token-btn" type="primary" size="small" @click.stop="createTokenWithExpiry(token)">
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </div>
        </template>
      </template>
    </NcTable>

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
  @apply rounded-lg py-1 px-3 w-398 h-8 border-1 focus:border-brand-500 border-gray-200;
}
</style>
