<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { PermissionKey } from 'nocodb-sdk'

interface Props {
  state: string
  baseId: string
  reload?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload'])

const vReload = useVModel(props, 'reload', emits)

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { activeTables } = storeToRefs(useTablesStore())

const { getPermissionSummaryLabel } = usePermissions()

const { projectPageTab } = storeToRefs(useConfigStore())

const searchQuery = ref<string>('')

// Modal state
const isFieldPermissionsModalOpen = ref(false)
const selectedTableForPermissions = ref<string | null>(null)

const tables = computed(() => {
  if (!base.value?.sources || !activeTables.value.length) return []

  const metaOrLocalSources = base.value.sources.filter((source) => source.is_meta || source.is_local)
  const metaOrLocalSourceIds = new Set(metaOrLocalSources.map((source) => source.id))

  return activeTables.value.filter((table: any) => metaOrLocalSourceIds.has(table.source_id!))
})

const columns = [
  {
    key: 'name',
    title: t('general.name'),
    name: 'Name',
    padding: '0px 32px',
  },
  {
    key: 'create_records',
    title: 'Create records',
    name: 'Create records',
    minWidth: 180,
    basis: '25%',
    padding: '0px 12px',
  },
  {
    key: 'delete_records',
    title: 'Delete records',
    name: 'Delete records',
    minWidth: 180,
    basis: '25%',
    padding: '0px 12px',
  },
  {
    key: 'context_actions',
    title: '',
    name: '',
    justify: 'justify-end',
    padding: '0px 12px',
    width: 60,
  },
] as NcTableColumnProps[]

// Handle opening field permissions modal
const openFieldPermissionsModal = (tableId: string) => {
  selectedTableForPermissions.value = tableId
  isFieldPermissionsModalOpen.value = true
}

// Get table data with field permissions row
const getTableData = (): (TableType & { type: string })[] => {
  const data: (TableType & { type: string })[] = []

  for (const table of tables.value) {
    data.push({
      ...table, // Include all table properties to satisfy TableType
      type: 'table',
    } as TableType & { type: string })
  }

  return data
}

const tableData = computed(() => {
  const data = getTableData()

  return data.filter((table) => searchCompare(table.title, searchQuery.value))
})

const onRowClick = (record: TableType & { type: string }) => {
  if (!record?.id) return

  if (record.type === 'table') {
    openFieldPermissionsModal(record.id!)
  }
}

// Watch for reload prop changes
watch(
  () => props.reload,
  (reload) => {
    if (reload) {
      vReload.value = false
    }
  },
)

/**
 * Reset search query on unmount
 */
onBeforeUnmount(() => {
  searchQuery.value = ''
})

const removeActionQuery = (action: string) => {
  if (!action) return

  router.replace({
    query: {
      ...route.value.query,
      action: undefined,
    },
  })
}

const onRevertToDefault = (tableName: string) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgResetPermissions'), {
    'visible': isOpen,
    'tableName': tableName,
    'options': ['table', 'field'],
    'onUpdate:visible': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

watch(projectPageTab, () => {
  if (!searchQuery.value) return

  searchQuery.value = ''
})

watch(
  () => route.value.query.action,
  (action) => {
    if (!action || !(action as string).startsWith('permissions-')) return removeActionQuery(action as string)

    const tableId = (action as string).split('-')[1]

    if (!tableId) return

    openFieldPermissionsModal(tableId)

    removeActionQuery(action as string)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col h-full p-6" data-testid="nc-settings-permissions-tab">
    <div class="mb-6 flex items-center justify-between gap-3">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="nc-search-permissions-input nc-input-border-on-value !max-w-90 nc-input-sm"
        placeholder="Search tables"
        allow-clear
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
        </template>
      </a-input>
    </div>

    <NcTable
      :is-data-loading="base?.isLoading"
      :columns="columns"
      sticky-first-column
      :data="tableData"
      :bordered="false"
      row-height="44px"
      header-row-height="44px"
      class="nc-base-permissions flex-1 max-w-full"
      @row-click="onRowClick"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="record.type === 'table'">
          <!-- Name Column -->
          <template v-if="column.key === 'name'">
            <div
              v-if="record.type === 'table'"
              class="w-full flex items-center gap-3 max-w-full text-gray-800"
              data-testid="permissions-table-name"
            >
              <GeneralTableIcon :meta="(record as TableType)" class="flex-none h-4 w-4 !text-nc-content-gray-subtle" />
              <NcTooltip class="truncate font-weight-600 max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                <template #title>
                  {{ record?.title }}
                </template>
                {{ record?.title }}
              </NcTooltip>
            </div>
            <div v-else-if="record.type === 'context_actions'" class="w-full flex gap-3 max-w-full text-gray-600 pl-6">
              <GeneralIcon icon="ncLock" class="flex-none h-4 w-4" />
              <span class="text-sm">{{ record.title }}</span>
            </div>
          </template>

          <!-- Create Records Column -->
          <template v-if="column.key === 'create_records'">
            <div v-if="record.type === 'table'" class="w-full flex justify-center gap-2">
              <PermissionsInlineTableSelector
                :base="base!"
                :table-id="record.id"
                :permission-type="PermissionKey.TABLE_RECORD_ADD"
                :current-value="getPermissionSummaryLabel('table', record.id, PermissionKey.TABLE_RECORD_ADD)"
              />
            </div>
          </template>

          <!-- Delete Records Column -->
          <template v-if="column.key === 'delete_records'">
            <div v-if="record.type === 'table'" class="w-full flex justify-center gap-2">
              <PermissionsInlineTableSelector
                :base="base!"
                :table-id="record.id"
                :permission-type="PermissionKey.TABLE_RECORD_DELETE"
                :current-value="getPermissionSummaryLabel('table', record.id, PermissionKey.TABLE_RECORD_DELETE)"
              />
            </div>
          </template>

          <template v-if="column.key === 'context_actions'">
            <div v-if="record.type === 'table'" class="w-full flex justify-end gap-2">
              <NcDropdown>
                <NcButton size="small" type="secondary" @click.stop>
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="threeDotVertical" class="flex-none h-4 w-4" />
                  </div>
                </NcButton>
                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem @click="openFieldPermissionsModal(record.id)">
                      <GeneralIcon icon="ncMaximize2" class="flex-none h-4 w-4" />
                      View field permissions
                    </NcMenuItem>
                    <NcMenuItem @click="onRevertToDefault(record.title)">
                      <GeneralIcon icon="ncRotateCcw" class="flex-none h-4 w-4" />
                      Revert permissions to default
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </template>
        </template>
      </template>
    </NcTable>
  </div>

  <!-- Permissions Modal -->
  <PermissionsModal
    v-if="selectedTableForPermissions"
    v-model:visible="isFieldPermissionsModalOpen"
    :base-id="base?.id || ''"
    :table-id="selectedTableForPermissions"
  />
</template>
