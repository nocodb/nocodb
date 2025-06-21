<script lang="ts" setup>
import { type BaseType, PermissionEntity, type PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  fieldId: string
  fieldTitle: string
  permissionType: PermissionKey
  currentValue: string
}>()

const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.FIELD,
  entityId: props.fieldId,
  permission: props.permissionType,
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" select-width="min-w-44" />
</template>
