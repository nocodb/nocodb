<script lang="ts" setup>
import { PermissionKey, isSystemColumn } from 'nocodb-sdk'
import type { TableType } from 'nocodb-sdk'

interface Props {
  tableData: TableType
  tableToolbarClassName?: string
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
    col: field,
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
  <!-- Field Permissions Table -->
  <NcTable
    :is-data-loading="false"
    :columns="fieldPermissionsColumns"
    :data="fieldPermissionsData"
    :bordered="false"
    row-height="56px"
    disable-table-scroll
    force-sticky-header
    header-row-height="44px"
    body-row-class-name="!cursor-default"
    :table-toolbar-class-name="tableToolbarClassName"
    class="nc-field-permissions-table flex-1"
  >
    <template #tableToolbar>
      <div class="flex items-center justify-between min-h-8">
        <h3 class="text-nc-content-gray-emphasis text-bodyBold mb-0 capitalize">{{ $t('title.fieldPermissions') }}</h3>
        <div class="flex items-center gap-2">
          <template v-if="customFieldPermissionsCount > 0">
            <div class="flex items-center justify-center">
              <div class="h-1.5 w-1.5 rounded-full bg-primary flex-none"></div>
            </div>
            <span class="text-body text-nc-content-gray-subtle">
              {{
                $t('title.mOfNFieldsHaveCustomPermissions', {
                  m: customFieldPermissionsCount,
                  n: visibleFields.length,
                })
              }}
            </span>
          </template>
          <slot name="actions" :has-permissions="customFieldPermissionsCount > 0" />
        </div>
      </div>
    </template>
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'field_name'">
        <div v-if="isFieldModified(record.field_id!)" class="flex items-center justify-center absolute left-1">
          <div class="h-1.5 w-1.5 rounded-full bg-primary flex-none"></div>
        </div>

        <div class="flex items-center gap-3">
          <NcIconField :field="record.col" class="flex-none h-4 w-4 !mx-0" color="text-nc-content-gray-subtle" />
          <span class="text-captionBold text-nc-content-gray truncate">
            {{ record.field_name }}
          </span>
        </div>
      </template>

      <template v-if="column.key === 'edit_permission'">
        <NcTooltip :disabled="showEditRestrictedColumnTooltip(record.col)" :arrow="false">
          <template #title>
            {{ $t('tooltip.dataInThisFieldCantBeManuallyEdited') }}
          </template>

          <PermissionsInlineFieldSelector
            :base="base!"
            :field-id="record.field_id!"
            :field-title="record.field_title!"
            :permission-type="PermissionKey.RECORD_FIELD_EDIT"
            :current-value="getPermissionSummaryLabel('field', record.field_id!, PermissionKey.RECORD_FIELD_EDIT)"
            :border-on-hover="true"
            class="-ml-3"
            :class="!showEditRestrictedColumnTooltip(record.col) ? 'opacity-70' : ''"
            :readonly="!showEditRestrictedColumnTooltip(record.col)"
            :remove-readonly-padding="false"
            @save="handlePermissionSave"
          />
        </NcTooltip>
      </template>
    </template>
  </NcTable>
</template>

<style scoped>
:deep(.nc-table-header) {
  @apply bg-nc-bg-gray-light;
}

:deep(.nc-table-row:hover) {
  @apply bg-nc-bg-gray-light;
}
</style>
