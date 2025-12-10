<script lang="ts" setup>
import { PermissionEntity, PermissionKey, ProjectRoles } from 'nocodb-sdk'
import type { BaseType, TableType } from 'nocodb-sdk'
import type { NcDropdownPlacement } from '#imports'

const props = defineProps<{
  tableId: string
  base: BaseType
  horizontal?: boolean
  table: TableType
  placement?: NcDropdownPlacement
}>()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { permissionsByEntity } = usePermissions()

const { isUIAllowed } = useRoles()

// Check if user is base owner (only owners can configure table visibility)
const canConfigureTableVisibility = computed(() => {
  const baseRole = props.base?.project_role
  return baseRole === ProjectRoles.OWNER
})

// Permission configuration for table visibility
const tableVisibilityConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_VISIBILITY,
  disabled: !canConfigureTableVisibility.value || (props.table.synced as boolean),
  tooltip: props.table.synced 
    ? t('msg.info.permissionsNotAvailableForSyncedTable')
    : !canConfigureTableVisibility.value
    ? t('msg.info.onlyBaseOwnersCanConfigureTableVisibility')
    : undefined,
}

// Permission configurations for create and delete
const createPermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_ADD,
  disabled: props.table.synced as boolean,
  tooltip: props.table.synced ? t('msg.info.permissionsNotAvailableForSyncedTable') : undefined,
}

const deletePermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_DELETE,
  disabled: props.table.synced as boolean,
  tooltip: props.table.synced ? t('msg.info.permissionsNotAvailableForSyncedTable') : undefined,
}

const handlePermissionSave = () => {
  $e('a:table:permissions')
}

const hasTablePermissions = computed(() => {
  return (permissionsByEntity.value[`table_${props.tableId}`]?.length ?? 0) > 0
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between">
      <slot name="title">
        <div class="text-nc-content-gray-emphasis text-bodyBold min-h-8 flex items-center capitalize">
          {{ $t('title.tablePermissions') }}
        </div>
      </slot>
      <slot name="actions" :has-permissions="hasTablePermissions" />
    </div>

    <!-- Table Visibility Section -->
    <div class="flex flex-col gap-3">
      <div class="text-nc-content-gray-emphasis text-bodyBold min-h-8 flex items-center">
        {{ $t('title.tableVisibility') }}
      </div>
      <PermissionsSelector
        :base="base"
        :config="tableVisibilityConfig"
        :horizontal="horizontal"
        :placement="placement"
        :readonly="!canConfigureTableVisibility"
        @save="handlePermissionSave"
      />
    </div>

    <!-- Record Operations Section -->
    <div class="flex flex-col gap-3">
      <div class="text-nc-content-gray-emphasis text-bodyBold min-h-8 flex items-center">
        {{ $t('title.recordOperations') }}
      </div>

      <!-- Create Records Permission -->
      <PermissionsSelector
        :base="base"
        :config="createPermissionConfig"
        :horizontal="horizontal"
        :placement="placement"
        @save="handlePermissionSave"
      />

      <!-- Delete Records Permission -->
      <PermissionsSelector
        :base="base"
        :config="deletePermissionConfig"
        :horizontal="horizontal"
        :placement="placement"
        @save="handlePermissionSave"
      />
    </div>
  </div>
</template>
