<script setup lang="ts">
import dayjs from 'dayjs'

const { t } = useI18n()

const { appInfo } = useGlobal()

const { copy } = useCopy()

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
    key: 'expires',
    title: t('labels.expiresAt'),
    width: 150,
    minWidth: 150,
    showOrderBy: true,
    dataIndex: 'expires_at',
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

const newTokenExpiryDate = ref<any>(null)

const disabledDate = (current: any) => {
  return current && current < dayjs().startOf('day')
}

onMounted(async () => {
  loadSorts()
  await listMcpTokens()
})

const createTokenWithExpiry = async (token: Partial<MCPTokenExtendedType>) => {
  if (newTokenExpiryDate.value) {
    token.expires_at = dayjs(newTokenExpiryDate.value).format('YYYY-MM-DD')
  }

  await createMcpToken(token)

  newTokenExpiryDate.value = null
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

const copyToken = async (token: MCPTokenExtendedType) => {
  await copy(`${appInfo.value.ncSiteUrl}/mcp/${token.id}`)
  message.success(t('msg.success.mcpUrlCopied'))
}
</script>

<template>
  <div v-if="isCreatingMcpToken" class="absolute w-full h-full inset-0 flex items-center justify-center z-90 bg-black/12">
    <div
      v-if="isCreatingMcpToken"
      style="box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1)"
      class="bg-white p-6 flex flex-col w-[488px] rounded-2xl"
    >
      <div class="text-nc-content-gray-emphasis text-lg font-bold">{{ $t('labels.creatingToken') }}</div>
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
        type="ghost"
        class="!text-primary"
        data-testid="add-new-mcp-token"
        size="small"
        :class="{
          '!text-nc-content-inverted-primary-disabled': isUnsavedMCPTokenPending,
        }"
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
      body-row-class-name="nc-base-settings-mcp-token-item"
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

        <template v-if="column.key === 'expires'">
          <div v-if="!token.isNew && token.expires_at" class="text-nc-content-gray-subtle">
            {{ dayjs(token.expires_at).format('D MMM YYYY') }}
          </div>
          <div v-else-if="!token.isNew" class="text-nc-content-gray-subtle">
            {{ $t('labels.never') }}
          </div>
          <a-date-picker v-else v-model:value="newTokenExpiryDate" :disabled-date="disabledDate" format="YYYY-MM-DD" />
        </template>

        <template v-if="column.key === 'action'">
          <div
            v-if="!token?.isNew"
            :data-testid="`token-${token.title}`"
            class="flex row-action items-center shadow-nc-sm rounded-lg"
          >
            <NcButton
              size="small"
              data-testid="copy-token-btn"
              type="secondary"
              class="!text-sm !rounded-r-none !border-r-0"
              :shadow="false"
              @click="copyToken(token)"
            >
              <div class="text-nc-content-gray-subtle font-semibold">
                {{ $t('general.copy') }}
              </div>
            </NcButton>
            <NcButton
              size="small"
              type="secondary"
              data-testid="delete-token-btn"
              class="!text-xs !rounded-l-none"
              :shadow="false"
              @click="confirmDeleteToken(token)"
            >
              <GeneralIcon icon="delete" />
            </NcButton>
          </div>

          <div v-else>
            <div class="flex gap-2">
              <NcButton data-testid="cancel-token-btn" type="secondary" size="small" @click="cancelNewMcpToken()">
                {{ $t('general.cancel') }}
              </NcButton>

              <NcButton data-testid="create-token-btn" type="primary" size="small" @click="createTokenWithExpiry(token)">
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </div>
        </template>
      </template>
    </NcTable>
  </div>
</template>

<style scoped lang="scss">
.ant-input {
  @apply rounded-lg py-1 px-3 w-398 h-8 border-1 focus:border-brand-500 border-gray-200;
}
</style>
