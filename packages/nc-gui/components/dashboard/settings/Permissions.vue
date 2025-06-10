<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'

interface Props {
  state: string
  baseId: string
  reload?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload'])

const vReload = useVModel(props, 'reload', emits)

const { t } = useI18n()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { projectPageTab } = storeToRefs(useConfigStore())

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const { activeTables } = storeToRefs(useTablesStore())

const { getPermissionSummaryLabel } = usePermissions()

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
    width: 320,
    padding: '0px 12px',
  },
  {
    key: 'create_records',
    title: 'Create records',
    name: 'Create records',
    padding: '0px 12px',
    minWidth: 150,
  },
  {
    key: 'delete_records',
    title: 'Delete records',
    name: 'Delete records',
    minWidth: 150,
    padding: '0px 12px',
  },
  {
    key: 'field_permissions',
    title: 'Field Permissions',
    name: 'Field Permissions',
    minWidth: 150,
    padding: '0px 12px',
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

// Watch for reload prop changes
watch(
  () => props.reload,
  (reload) => {
    if (reload) {
      vReload.value = false
    }
  },
)

watch(
  projectPageTab,
  () => {
    if (projectPageTab.value === 'permissions') {
      until(() => !!activeWorkspace.value)
        .toBeTruthy()
        .then(() => {})
    }
  },
  {
    immediate: true,
  },
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

    <div
      class="flex mt-4"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 218px)',
      }"
    >
      <NcTable
        :is-data-loading="base?.isLoading"
        :columns="columns"
        sticky-first-column
        :data="getTableData()"
        :bordered="false"
        row-height="44px"
        header-row-height="44px"
        class="nc-base-permissions flex-1"
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
                <GeneralTableIcon :meta="record as any" class="flex-none h-4 w-4 !text-nc-content-gray-subtle" />
                <NcTooltip class="truncate font-weight-600 max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                  <template #title>
                    {{ record?.title }}
                  </template>
                  {{ record?.title }}
                </NcTooltip>
              </div>
              <div
                v-else-if="record.type === 'field_permissions'"
                class="w-full flex items-center gap-3 max-w-full text-gray-600 pl-6"
              >
                <GeneralIcon icon="ncLock" class="flex-none h-4 w-4" />
                <span class="text-sm">{{ record.title }}</span>
              </div>
            </template>

            <!-- Create Records Column -->
            <template v-if="column.key === 'create_records'">
              <div v-if="record.type === 'table'" class="w-full flex items-center gap-2">
                <PermissionsInlineTableSelector
                  :base="base!"
                  :table-id="record.id"
                  permission-type="TABLE_RECORD_ADD"
                  :current-value="getPermissionSummaryLabel('table', record.id, 'TABLE_RECORD_ADD')"
                  minimum-role="editor"
                />
              </div>
            </template>

            <!-- Delete Records Column -->
            <template v-if="column.key === 'delete_records'">
              <div v-if="record.type === 'table'" class="w-full flex items-center gap-2">
                <PermissionsInlineTableSelector
                  :base="base!"
                  :table-id="record.id"
                  permission-type="TABLE_RECORD_DELETE"
                  :current-value="getPermissionSummaryLabel('table', record.id, 'TABLE_RECORD_DELETE')"
                  minimum-role="editor"
                />
              </div>
            </template>

            <!-- Field Permissions Column -->
            <template v-if="column.key === 'field_permissions'">
              <div v-if="record.type === 'table'" class="w-full flex items-center gap-2">
                <NcButton size="small" type="text" @click="openFieldPermissionsModal(record.id)">
                  <div class="flex items-center gap-2 text-primary">
                    <GeneralIcon icon="ncEdit" class="flex-none h-4 w-4" />
                    <span class="text-sm">Modify</span>
                  </div>
                </NcButton>
              </div>
            </template>
          </template>
        </template>
      </NcTable>
    </div>
  </div>

  <!-- Permissions Modal -->
  <PermissionsModal
    v-if="selectedTableForPermissions"
    v-model:visible="isFieldPermissionsModalOpen"
    :base-id="base?.id || ''"
    :table-id="selectedTableForPermissions"
  />
</template>

<style scoped></style>
