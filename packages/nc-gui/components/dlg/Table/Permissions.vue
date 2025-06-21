<script lang="ts" setup>
import { type BaseType, PermissionEntity, type PermissionGrantedType, PermissionKey, type PermissionRole } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  base: BaseType & {
    permissions: {
      entity: PermissionEntity
      entity_id: string
      permission: PermissionKey
      granted_type: PermissionGrantedType
      granted_role?: PermissionRole
      user_ids?: string[]
    }[]
  }
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

// Permission configurations for create and delete
const createPermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_ADD,
  label: 'Who can create records?',
  description: 'can create records',
}

const deletePermissionConfig: PermissionConfig = {
  entity: PermissionEntity.TABLE,
  entityId: props.tableId,
  permission: PermissionKey.TABLE_RECORD_DELETE,
  label: 'Who can delete records?',
  description: 'can delete records',
}

const handlePermissionSave = () => {
  $e('a:table:permissions')
}
</script>

<template>
  <GeneralModal
    v-model:visible="visible"
    :class="{ active: visible }"
    :mask-closable="true"
    :keyboard="true"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-table-permissions"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-6">
        <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold">Table permissions</div>
        <NcButton type="text" size="small" @click="visible = false">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </div>

      <div class="text-sm text-nc-content-gray-muted mb-6">Limit who can create and delete records in Locked Table</div>

      <div class="space-y-6">
        <!-- Create Records Permission -->
        <PermissionsPermissionSelector :base="base" :config="createPermissionConfig" @save="handlePermissionSave" />

        <!-- Delete Records Permission -->
        <PermissionsPermissionSelector :base="base" :config="deletePermissionConfig" @save="handlePermissionSave" />
      </div>
    </div>
  </GeneralModal>
</template>
