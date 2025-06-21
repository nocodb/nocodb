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
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div class="text-lg text-nc-content-gray-subtle2 leading-6 font-bold">Table permissions</div>
      <slot name="actions" />
    </div>

    <div class="flex flex-col gap-4 px-4">
      <div class="text-sm text-nc-content-gray-muted">Limit who can create and delete records in Locked Table</div>

      <div class="flex flex-col gap-2">
        <!-- Create Records Permission -->
        <PermissionsSelector :base="base" :config="createPermissionConfig" @save="handlePermissionSave" />

        <!-- Delete Records Permission -->
        <PermissionsSelector :base="base" :config="deletePermissionConfig" @save="handlePermissionSave" />
      </div>
    </div>
  </div>
</template>
