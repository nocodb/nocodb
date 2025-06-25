<script lang="ts" setup>
import { PermissionEntity, PermissionKey } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  fieldId: string
  fieldTitle: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

const baseStore = useBase()
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
    wrap-class-name="nc-modal-single-field-permissions"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-6">
        <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold">Field permissions</div>
        <NcButton type="text" size="small" @click="visible = false">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </div>

      <div class="text-sm text-nc-content-gray-muted mb-6">
        Limit who can edit the <span class="font-semibold">{{ fieldTitle }}</span> field
      </div>

      <div class="space-y-6">
        <PermissionsSelector :base="base" :config="editPermissionConfig" @save="handlePermissionSave" />
      </div>
    </div>
  </GeneralModal>
</template>
