<script setup lang="ts">
import dayjs from 'dayjs'

const authClientStore = useOAuthClients()

const { t } = useI18n()

const { loadOAuthClients } = authClientStore

const { oauthClients, isOauthClientsLoading } = storeToRefs(authClientStore)

const { sorts, sortDirection, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('OAuthClients')

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

const sortedOAuthClients = computed(() => handleGetSortedData(oauthClients.value, sorts.value))

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

const modalVisible = ref(false)
const detailsModalVisible = ref(false)
const deleteModalVisible = ref(false)
const regenerateModalVisible = ref(false)
const selectedClientId = ref<string | undefined>(undefined)
const selectedClient = ref<any>(null)

const addNewClient = () => {
  modalVisible.value = true
}

const viewClientDetails = (clientId: string) => {
  selectedClientId.value = clientId
  detailsModalVisible.value = true
}

const handleRegenerateSecret = (client: any) => {
  selectedClient.value = client
  regenerateModalVisible.value = true
}

const handleDeleteClient = (client: any) => {
  selectedClient.value = client
  deleteModalVisible.value = true
}

const onRegeneratedSecret = () => {
  if (selectedClient.value?.client_id) {
    viewClientDetails(selectedClient.value.client_id)
  }
}

onMounted(async () => {
  await loadOAuthClients()
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncLock" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.oauthClients') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="max-w-202 mx-auto h-full w-full" data-testid="nc-token-list">
        <div class="flex gap-4 items-baseline justify-between">
          <h6 class="text-xl text-left font-bold my-0" data-rec="true">{{ $t('title.oauthClients') }}</h6>
          <NcButton
            :disabled="isOauthClientsLoading"
            data-testid="nc-token-create-top"
            size="small"
            type="primary"
            @click="addNewClient"
          >
            <span class="hidden md:block" data-rec="true">
              {{ $t('labels.addNewClient') }}
            </span>
            <span class="flex items-center justify-center md:hidden" data-rec="true">
              <component :is="iconMap.plus" />
            </span>
          </NcButton>
        </div>
        <NcTable
          v-model:order-by="orderBy"
          :columns="columns"
          header-row-height="44px"
          row-height="44px"
          :data="sortedOAuthClients"
          class="h-full mt-5"
          body-row-class-name="nc-base-settings-mcp-token-item group no-border-last cursor-pointer"
          @row-click="(record) => viewClientDetails(record.client_id)"
        >
          <template #bodyCell="{ column, record: oAuthClient }">
            <template v-if="column.key === 'name'">
              <NcTooltip class="truncate text-nc-content-gray font-semibold text-sm">
                {{ oAuthClient.client_name }}

                <template #title>
                  <div class="text-[10px] leading-[14px] uppercase font-semibold pt-1 text-gray-300">
                    {{ $t('labels.createdOn') }}
                  </div>
                  <div class="mt-1 text-[13px]">
                    {{ dayjs(oAuthClient.created_at).format('D MMMM YYYY, hh:mm A') }}
                  </div>
                </template>
              </NcTooltip>
            </template>
            <template v-if="column.key === 'created_at'">
              <div v-if="oAuthClient.created_at" class="text-nc-content-gray-subtle">
                {{ dayjs(oAuthClient.created_at).format('D MMM YYYY') }}
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <NcDropdown>
                <NcButton type="secondary" class="!hidden !group-hover:block" size="small" @click.stop>
                  <GeneralIcon icon="threeDotVertical" />
                </NcButton>

                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem @click.stop="viewClientDetails(oAuthClient.client_id)">
                      <GeneralIcon icon="eye" />
                      View Details
                    </NcMenuItem>
                    <NcMenuItem
                      v-if="oAuthClient.client_type === 'confidential'"
                      @click.stop="handleRegenerateSecret(oAuthClient)"
                    >
                      <GeneralIcon icon="refresh" />
                      Regenerate Secret
                    </NcMenuItem>
                    <NcDivider />
                    <NcMenuItem danger @click.stop="handleDeleteClient(oAuthClient)">
                      <GeneralIcon icon="delete" />
                      Delete Client
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </template>
          </template>
        </NcTable>
      </div>
    </div>

    <AccountOAuthModal v-model:visible="modalVisible" />
    <AccountOAuthDetails
      v-model:visible="detailsModalVisible"
      :client-id="selectedClientId"
      @deleted="loadOAuthClients({ force: true })"
    />
    <DlgOAuthClientDelete
      v-if="selectedClient"
      v-model="deleteModalVisible"
      :oauth-client="selectedClient"
      @deleted="loadOAuthClients({ force: true })"
    />
    <DlgOAuthClientRegenerateSecret
      v-if="selectedClient"
      v-model="regenerateModalVisible"
      :oauth-client="selectedClient"
      @regenerated="onRegeneratedSecret"
    />
  </div>
</template>
