<script lang="ts" setup>
import { PermissionEntity } from 'nocodb-sdk'
import type { BaseType, ColumnType, PermissionKey, TableType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  field: ColumnType
  table: TableType
  fieldId: string
  fieldTitle: string
  permissionType: PermissionKey
  currentValue: string
  borderOnHover?: boolean
}>()

const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.FIELD,
  entityId: props.fieldId,
  entityTitle: props.fieldTitle,
  permission: props.permissionType,
  disabled: (props.field?.readonly && props.table.synced) as boolean,
  tooltip: 'Permissions are not available for synced column',
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" :border-on-hover="borderOnHover" />
</template>
