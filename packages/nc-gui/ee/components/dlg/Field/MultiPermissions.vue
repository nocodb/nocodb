<script lang="ts" setup>
import { type ColumnType, PermissionEntity, PermissionKey, type TableType, UITypes } from 'nocodb-sdk'

// Bulk-permissions dialog for the multi-field menu. Renders the same
// PermissionsSelector the single-field dialog uses, but configures it with
// entityIds so saveState fans the API call across every selected field.
const props = defineProps<{
  visible: boolean
  columns: ColumnType[]
}>()

const emits = defineEmits(['update:visible', 'saved'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref({} as TableType))

const baseStore = useBase()
const { navigateToProjectPage } = baseStore
const { base } = storeToRefs(baseStore)

const fieldIds = computed(() => props.columns.map((c) => c.id!).filter(Boolean))

// The probe field — used by usePermissionSelector for initializing the state
// display. We pick the first one; if the N fields have different permissions
// they will all be overwritten with whatever the user picks here.
const probeField = computed(() => props.columns[0])

const editPermissionConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.FIELD,
  entityId: probeField.value?.id ?? '',
  permission: PermissionKey.RECORD_FIELD_EDIT,
  entityIds: fieldIds.value,
}))

const handlePermissionSave = () => {
  $e('a:field:permissions:multi', { count: fieldIds.value.length })
  visible.value = false
  emits('saved')
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
    wrap-class-name="nc-modal-multi-field-permissions"
  >
    <div class="flex flex-col gap-4 w-full align-top">
      <div class="flex items-center justify-between">
        <div class="flex-1 flex items-center gap-2 text-nc-content-gray-emphasis">
          <GeneralIcon icon="ncLock" class="w-5 h-5 flex-none" />
          <div class="text-subHeading2">
            {{ $t('labels.editNFieldPermissions', { count: fieldIds.length }) }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto nc-scrollbar-thin">
        <div
          v-for="col in columns"
          :key="col.id"
          class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md text-caption text-nc-content-gray-subtle"
        >
          <SmartsheetHeaderIcon :column="col" :default-uidt="UITypes.SingleLineText" class="flex-none h-4 w-4 !mx-0" />
          <div>{{ col.title }}</div>
        </div>
      </div>

      <PermissionsSelector
        v-if="probeField && base"
        :base="base"
        :config="editPermissionConfig"
        horizontal
        @save="handlePermissionSave"
      />
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
