<script lang="ts" setup>
import { type BaseType, PermissionEntity, PermissionKey } from 'nocodb-sdk'
import type { NcDropdownPlacement } from '#imports'

const props = defineProps<{
  tableId: string
  base: BaseType
  horizontal?: boolean
  placement?: NcDropdownPlacement
}>()

const { $e } = useNuxtApp()

const { permissionsByEntity } = usePermissions()

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
</template>
