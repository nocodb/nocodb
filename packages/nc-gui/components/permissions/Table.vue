<script lang="ts" setup>
import { type BaseType, PermissionEntity, PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  tableId: string
  base: BaseType
}>()

const { $e } = useNuxtApp()

// Permission configurations for create and delete
const createPermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_ADD,
  label: 'Who can create records?',
  description: 'can create records',
}

const deletePermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_DELETE,
  label: 'Who can delete records?',
  description: 'can delete records',
}

const handlePermissionSave = () => {
  $e('a:table:permissions')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold">Table permissions</div>
      <slot name="actions" />
    </div>

    <div class="text-sm text-nc-content-gray-muted mb-6">Limit who can create and delete records in Locked Table</div>

    <div class="space-y-6">
      <!-- Create Records Permission -->
      <PermissionsSelector :base="base" :config="createPermissionConfig" @save="handlePermissionSave" />

      <!-- Delete Records Permission -->
      <PermissionsSelector :base="base" :config="deletePermissionConfig" @save="handlePermissionSave" />
    </div>
  </div>
</template>
