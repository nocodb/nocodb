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
}

const deletePermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_DELETE,
}

const handlePermissionSave = () => {
  $e('a:table:permissions')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <slot name="title">
        <div class="text-nc-content-gray-subtle2 leading-6 font-bold">Table permissions</div>
      </slot>
      <slot name="actions" />
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <!-- Create Records Permission -->
        <PermissionsSelector :base="base" :config="createPermissionConfig" @save="handlePermissionSave" />

        <!-- Delete Records Permission -->
        <PermissionsSelector :base="base" :config="deletePermissionConfig" @save="handlePermissionSave" />
      </div>
    </div>
  </div>
</template>
