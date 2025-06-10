<script lang="ts" setup>
import { PermissionEntity } from 'nocodb-sdk'
import type { BaseType, PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  fieldId: string
  fieldTitle: string
  permissionType: string
  currentValue: string
  minimumRole?: 'viewer' | 'editor' | 'creator'
}>()

// Create permission config for the unified Selector
const permissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.FIELD,
  entityId: props.fieldId,
  permission: props.permissionType as PermissionKey,
  label: props.permissionType === 'RECORD_FIELD_VIEW' ? 'Who can view this field?' : 'Who can edit this field?',
  description: props.permissionType === 'RECORD_FIELD_VIEW' ? 'can view this field' : 'can edit this field',
  minimumRole: props.minimumRole,
}))
</script>

<template>
  <PermissionsSelector :base="base" :config="permissionConfig" mode="inline" select-width="min-w-44" />
</template>
