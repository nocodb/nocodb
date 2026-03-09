<script lang="ts" setup>
import { PermissionEntity, PermissionKey, ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  docId: string
  title?: string
  parentId?: string | null
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

const { t } = useI18n()

const baseStore = useBase()

const { base } = storeToRefs(baseStore)

const { permissionsByEntity } = usePermissions()

const isCreatorOrAbove = computed(() => {
  return (
    base.value?.project_role === ProjectRoles.OWNER || base.value?.project_role === ProjectRoles.CREATOR
  )
})

const visibilityConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.DOCUMENT,
  entityId: props.docId,
  permission: PermissionKey.DOCUMENT_VISIBILITY,
  disabled: !isCreatorOrAbove.value,
  tooltip: !isCreatorOrAbove.value ? t('msg.info.onlyCreatorsCanConfigureDocPermissions') : undefined,
}))

const editConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.DOCUMENT,
  entityId: props.docId,
  permission: PermissionKey.DOCUMENT_EDIT,
  disabled: !isCreatorOrAbove.value,
  tooltip: !isCreatorOrAbove.value ? t('msg.info.onlyCreatorsCanConfigureDocPermissions') : undefined,
}))

const handlePermissionSave = () => {
  $e('a:doc:permissions')
}

const hasDocPermissions = computed(() => {
  return (permissionsByEntity.value[`document_${props.docId}`]?.length ?? 0) > 0
})

const inheritedLabel = computed(() => {
  if (!props.parentId) return ''
  return t('labels.inheritedFromParent')
})
</script>

<template>
  <NcModal
    v-model:visible="visible"
    size="xs"
    height="auto"
    :show-separator="false"
    wrap-class-name="nc-modal-doc-permissions"
  >
    <div class="flex flex-col gap-5">
      <div class="flex-1 flex items-center gap-2 text-nc-content-gray-emphasis">
        <GeneralIcon icon="ncLock" class="w-5 h-5 flex-none" />
        <div class="text-subHeading2">{{ $t('title.pagePermissions') }}</div>
        <div
          v-if="title"
          class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md text-caption text-nc-content-gray-subtle truncate max-w-40"
        >
          <GeneralIcon icon="ncFileDocument" class="w-3.5 h-3.5 flex-none" />
          <NcTooltip show-on-truncate-only class="truncate">
            {{ title }}
          </NcTooltip>
        </div>
      </div>

      <!-- Visibility Section -->
      <div class="flex flex-col gap-3">
        <div class="text-nc-content-gray-emphasis text-bodyBold min-h-8 flex items-center">
          {{ $t('title.pageVisibility') }}
        </div>
        <PermissionsSelector
          :base="base"
          :config="visibilityConfig"
          horizontal
          @save="handlePermissionSave"
        />
        <div v-if="parentId && !hasDocPermissions" class="text-xs text-nc-content-gray-subtle">
          {{ inheritedLabel }}
        </div>
      </div>

      <!-- Edit Section -->
      <div class="flex flex-col gap-3">
        <div class="text-nc-content-gray-emphasis text-bodyBold min-h-8 flex items-center">
          {{ $t('title.pageEditing') }}
        </div>
        <PermissionsSelector
          :base="base"
          :config="editConfig"
          horizontal
          @save="handlePermissionSave"
        />
      </div>
    </div>
  </NcModal>
</template>
