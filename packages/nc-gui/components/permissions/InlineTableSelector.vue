<script lang="ts" setup>
import { type BaseType, PermissionEntity, type PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  tableId: string
  permissionType: PermissionKey
  currentValue: string
}>()

const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: props.permissionType,
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" select-width="min-w-48" />
</template>
