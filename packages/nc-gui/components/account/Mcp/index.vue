<script setup lang="ts">
import dayjs from 'dayjs'

const { t } = useI18n()

const { accountMcpTokens, listAccountMcpTokens, updateMcpToken } = useMcpSettings()

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

const columns = [
  {
    key: 'name',
    title: t('general.name'),
    name: 'Token',
    minWidth: 300,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'workspace',
    title: t('objects.workspace'),
    minWidth: 200,
    showOrderBy: false,
  },
  {
    key: 'base',
    title: t('objects.project'),
    minWidth: 200,
    showOrderBy: false,
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

const loadUserMcpTokens = async () => {
  try {
    isLoading.value = true
    await listAccountMcpTokens()
  } catch (error: any) {
    message.error(await extractSdkResponseErrorMsg(error))
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

const regenerateToken = async (token: MCPTokenExtendedType) => {
  const newToken = await updateMcpToken(token, true)
  if (newToken) {
    handleOpenTokenModal(newToken)
  }
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

const isTokenModalVisible = ref(false)
const activeToken = ref<MCPTokenExtendedType | null>(null)

const handleOpenTokenModal = (token: MCPTokenExtendedType) => {
  activeToken.value = token
  isTokenModalVisible.value = true
}

const closeModal = async () => {
  activeToken.value = null
  isTokenModalVisible.value = false
  await loadUserMcpTokens()
}

const getFormattedDate = (date: string, format?: string) => dayjs(date).format(format || 'D MMMM YYYY, h:mm A')

onMounted(async () => {
  loadSorts()
  await loadUserMcpTokens()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="mcp" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.mcpServer') }}
        </span>
      </template>
    </NcPageHeader>

    <div class="flex flex-col w-full px-6 py-6">
      <div class="text-nc-content-gray-emphasis font-semibold text-lg">
        {{ $t('labels.activeMcpServers') }}
      </div>

      <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
        {{ $t('labels.activeMcpServersLabel') }}
      </div>

      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <GeneralLoader size="xlarge" />
      </div>

      <NcTable
        v-else
        v-model:order-by="orderBy"
        :columns="columns"
        header-row-height="44px"
        row-height="44px"
        :data="sortedMcpTokens"
        class="h-full mt-5"
        body-row-class-name="nc-account-mcp-token-item group no-border-last cursor-pointer"
        @row-click="handleOpenTokenModal"
      >
        <template #bodyCell="{ column, record: token }">
          <template v-if="column.key === 'name'">
            <NcTooltip class="truncate text-gray-800 font-semibold text-sm">
              {{ token.title }}

              <template #title>
                <div class="text-[10px] leading-[14px] uppercase font-semibold pt-1 text-gray-300">
                  {{ $t('labels.createdOn') }}
                </div>
                <div class="mt-1 text-[13px]">
                  {{ dayjs(token.created_at).format('D MMMM YYYY, hh:mm A') }}
                </div>
              </template>
            </NcTooltip>
          </template>

          <template v-if="column.key === 'workspace'">
            <div class="text-nc-content-gray-subtle truncate">
              {{ token.workspace?.title || '-' }}
            </div>
          </template>

          <template v-if="column.key === 'base'">
            <div class="text-nc-content-gray-subtle truncate">
              {{ token.base?.title || '-' }}
            </div>
          </template>

          <template v-if="column.key === 'action'">
            <NcDropdown>
              <NcButton type="secondary" class="!hidden !group-hover:block" size="small" @click.stop>
                <GeneralIcon icon="threeDotVertical" />
              </NcButton>

              <template #overlay>
                <NcMenu variant="small">
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
  @apply hover:bg-gray-50;
}
</style>
