<script lang="ts" setup>
import { isSystemColumn } from 'nocodb-sdk'
import type { TableType } from 'nocodb-sdk'

interface Props {
  tableData: TableType
}

const props = defineProps<Props>()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { getPermissionSummaryLabel, permissionsByEntity } = usePermissions()

// Get visible fields (exclude system fields)
const visibleFields = computed(() => {
  return props.tableData?.columns?.filter((column) => !isSystemColumn(column)) || []
})

// Count fields with custom permissions
const customFieldPermissionsCount = computed(() => {
  return visibleFields.value.filter((field) => {
    const editPermissions = permissionsByEntity.value[`field_${field.id}`] || []
    const hasEditPermissions = editPermissions.find((p) => p.permission === 'RECORD_FIELD_EDIT')
    return hasEditPermissions
  }).length
})

// NcTable columns configuration
const fieldPermissionsColumns = [
  {
    key: 'field_name',
    title: 'Field Name',
    name: 'Field Name',
    padding: '0px 16px',
  },
  {
    key: 'edit_permission',
    title: 'Edit',
    name: 'Edit',
    width: 300,
    padding: '0px 16px',
    justify: 'justify-center',
  },
] as NcTableColumnProps[]

// Transform fields data for NcTable
const fieldPermissionsData = computed(() => {
  return visibleFields.value.map((field) => ({
    id: field.id,
    field_name: field.title,
    field_icon: field.uidt,
    field_id: field.id,
    field_title: field.title,
  }))
})
</script>

<template>
  <div class="border-t border-gray-200 pt-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg text-nc-content-gray-subtle2 leading-6 font-bold">Field Permissions</h3>
      <div class="flex items-center gap-4">
        <span class="text-sm text-blue-600">
          {{ customFieldPermissionsCount }}/{{ visibleFields.length }} fields have custom permissions
        </span>
        <slot name="actions" />
      </div>
    </div>

    <!-- Field Permissions Table -->
    <div class="border border-gray-200 rounded-lg overflow-hidden px-4">
      <NcTable
        :is-data-loading="false"
        :columns="fieldPermissionsColumns"
        :data="fieldPermissionsData"
        :bordered="false"
        row-height="56px"
        header-row-height="44px"
        class="nc-field-permissions-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'field_name'">
            <div class="flex items-center gap-3">
              <component :is="getUIDTIcon(record.field_icon || '')" class="flex-none h-4 w-4 text-nc-content-gray-subtle" />
              <span class="text-sm font-medium text-nc-content-gray-emphasis truncate">
                {{ record.field_name }}
              </span>
            </div>
          </template>

          <template v-if="column.key === 'edit_permission'">
            <PermissionsInlineFieldSelector
              :base="base!"
              :field-id="record.field_id!"
              :field-title="record.field_title!"
              permission-type="RECORD_FIELD_EDIT"
              :current-value="getPermissionSummaryLabel('field', record.field_id!, 'RECORD_FIELD_EDIT')"
              minimum-role="editor"
            />
          </template>
        </template>
      </NcTable>
    </div>
  </div>
</template>

<style scoped>
:deep(.nc-table-header) {
  background-color: #f8fafc;
}

:deep(.nc-table-row:hover) {
  background-color: #f8fafc;
}
</style>
