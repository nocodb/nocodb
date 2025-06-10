<script lang="ts" setup>
import { PermissionEntity } from 'nocodb-sdk'
import type { BaseType, PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  fieldId: string
  fieldTitle: string
  permissionType: PermissionKey
  currentValue: string
}>()

// Create permission config for the unified Selector
const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.FIELD,
  entityId: props.fieldId,
  permission: props.permissionType,
  label: 'Who can edit this field?',
  description: 'can edit this field',
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" select-width="min-w-44" />
</template>
