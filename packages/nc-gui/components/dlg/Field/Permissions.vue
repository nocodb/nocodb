<script lang="ts" setup>
import { PermissionEntity, PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  fieldId: string
  fieldTitle: string
  fieldUidt: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

const baseStore = useBase()
const { navigateToProjectPage } = baseStore
const { base } = storeToRefs(baseStore)

// Permission configuration for field edit
const editPermissionConfig: PermissionConfig = {
  entity: PermissionEntity.FIELD,
  entityId: props.fieldId,
  permission: PermissionKey.RECORD_FIELD_EDIT,
}

const handlePermissionSave = () => {
  $e('a:field:permissions')
}

const onNavigateToPermissionsOverview = () => {
  navigateToProjectPage({ page: 'permissions' })
  visible.value = false
}
</script>

<template>
  <NcModal
    v-model:visible="visible"
    size="xs"
    height="auto"
    :show-separator="false"
    wrap-class-name="nc-modal-single-field-permissions"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncLock" class="w-5 h-5 flex items-center" />
          <div class="text-nc-content-gray-subtle2 font-bold">Field permissions</div>
          <div class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md">
            <component :is="getUIDTIcon(fieldUidt || 'SingleLineText')" class="flex-none h-4 w-4 text-nc-content-gray-subtle" />
            <div>{{ fieldTitle }}</div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <PermissionsSelector :base="base" :config="editPermissionConfig" @save="handlePermissionSave" />
        </div>
      </div>
    </div>

    <div class="flex justify-end mt-6">
      <NcButton type="ghost" size="small" @click="onNavigateToPermissionsOverview">Go to Permissions Overview</NcButton>
    </div>
  </NcModal>
</template>
