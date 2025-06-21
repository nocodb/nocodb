<script lang="ts" setup>
import { type BaseType, PermissionEntity, type PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  fieldId: string
  fieldTitle: string
  permissionType: PermissionKey
  currentValue: string
  borderOnHover?: boolean
}>()

const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.FIELD,
  entityId: props.fieldId,
  permission: props.permissionType,
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" :border-on-hover="borderOnHover" />
</template>
