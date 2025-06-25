<script lang="ts" setup>
import { type BaseType, PermissionEntity } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  tableId: string
  permissionType: string
  currentValue: string
  minimumRole?: 'viewer' | 'editor' | 'creator'
}>()

// Create permission config for the unified Selector
const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: props.permissionType,
  label: props.permissionType === 'TABLE_RECORD_ADD' ? 'Who can create records?' : 'Who can delete records?',
  description: props.permissionType === 'TABLE_RECORD_ADD' ? 'can create records' : 'can delete records',
  minimumRole: props.minimumRole,
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" select-width="min-w-48" />
</template>
