<script lang="ts" setup>
import { PermissionKey, isSystemColumn } from 'nocodb-sdk'
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
    const hasEditPermissions = editPermissions.find((p) => p.permission === PermissionKey.RECORD_FIELD_EDIT)
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
    width: 220,
    padding: '0px 16px',
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

const isFieldModified = (fieldId: string) => {
  const editPermissions = permissionsByEntity.value[`field_${fieldId}`] || []
  const hasEditPermissions = editPermissions.find((p) => p.permission === PermissionKey.RECORD_FIELD_EDIT)
  return hasEditPermissions
}

const { $e } = useNuxtApp()

const handlePermissionSave = () => {
  $e('a:field:permissions')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4 min-h-8">
      <h3 class="text-nc-content-gray-emphasis text-bodyBold mb-0">Field Permissions</h3>
      <div class="flex items-center gap-2">
        <template v-if="customFieldPermissionsCount > 0">
          <div class="flex items-center justify-center">
            <div class="h-1.5 w-1.5 rounded-full bg-primary flex-none"></div>
          </div>
          <span class="text-body text-nc-content-gray-subtle">
            {{ customFieldPermissionsCount }}/{{ visibleFields.length }} fields have custom permissions
          </span>
        </template>
        <slot name="actions" />
      </div>
    </div>

    <!-- Field Permissions Table -->
    <div class="border border-nc-border-gray-medium rounded-lg overflow-hidden">
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
            <div v-if="isFieldModified(record.field_id!)" class="flex items-center justify-center absolute left-1">
              <div class="h-1.5 w-1.5 rounded-full bg-primary flex-none"></div>
            </div>

            <div class="flex items-center gap-3">
              <component :is="getUIDTIcon(record.field_icon || '')" class="flex-none h-4 w-4 text-nc-content-gray-subtle" />
              <span class="text-captionBold text-nc-content-gray truncate">
                {{ record.field_name }}
              </span>
            </div>
          </template>

          <template v-if="column.key === 'edit_permission'">
            <PermissionsInlineFieldSelector
              :base="base!"
              :field-id="record.field_id!"
              :field-title="record.field_title!"
              :permission-type="PermissionKey.RECORD_FIELD_EDIT"
              :current-value="getPermissionSummaryLabel('field', record.field_id!, PermissionKey.RECORD_FIELD_EDIT)"
              :border-on-hover="true"
              class="-ml-3"
              @save="handlePermissionSave"
            />
          </template>
        </template>
      </NcTable>
    </div>
  </div>
</template>

<style scoped>
:deep(.nc-table-header) {
  @apply bg-nc-bg-gray-light;
}

:deep(.nc-table-row:hover) {
  @apply bg-nc-bg-gray-light;
}
</style>
