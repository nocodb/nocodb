<script lang="ts" setup>
import { type BaseType, PermissionEntity, type PermissionKey } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    base: BaseType
    tableId: string
    permissionType: PermissionKey
    currentValue: string
    readonly?: boolean
    inlineStyle?: boolean
  }>(),
  {
    readonly: true,
    inlineStyle: true,
  },
)

const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: props.permissionType,
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" :readonly="readonly" :inline-style="inlineStyle" />
</template>
