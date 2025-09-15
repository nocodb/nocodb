<script lang="ts" setup>
import { type ColumnType, PermissionEntity, PermissionKey, type TableType, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  field: ColumnType
  fieldId: string
  fieldTitle: string
  fieldUidt: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref({} as TableType))

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
  navigateToProjectPage({
    page: 'permissions',
    action: meta.value?.id ? `permissions-${meta.value.id}` : undefined,
  })

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
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between">
        <div class="flex-1 flex items-center gap-2 text-nc-content-gray-emphasis">
          <GeneralIcon icon="ncLock" class="w-5 h-5 flex-none" />
          <div class="text-subHeading2">{{ $t('title.fieldPermissions') }}</div>
          <div class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md text-caption text-nc-content-gray-subtle">
            <SmartsheetHeaderIcon :column="field" :default-uidt="UITypes.SingleLineText" class="flex-none h-4 w-4 !mx-0" />
            <div>{{ fieldTitle }}</div>
          </div>
        </div>
      </div>

      <PermissionsSelector :base="base" :config="editPermissionConfig" horizontal @save="handlePermissionSave" />
    </div>

    <div class="flex justify-start mt-5">
      <NcTooltip :title="$t('tooltip.viewAndEditPermissionsForAllFieldsInThisTable')" placement="right" :arrow="false">
        <NcButton type="secondary" size="small" @click="onNavigateToPermissionsOverview">
          {{ $t('general.manageAllFields') }}
        </NcButton>
      </NcTooltip>
    </div>
  </NcModal>
</template>
