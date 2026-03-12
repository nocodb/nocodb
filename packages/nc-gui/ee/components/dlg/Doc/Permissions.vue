<script lang="ts" setup>
import { type DocumentType, extractBaseRoleFromWorkspaceRole, getPermissionOptionValue, PermissionEntity, PermissionGrantedType, PermissionKey, type PermissionRole, ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  docId: string
  title?: string
  parentId?: string | null
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const route = useRoute()

const baseStore = useBase()

const { base } = storeToRefs(baseStore)

const documentsStore = useDocumentsStore()
const { activeDocuments } = storeToRefs(documentsStore)

const docsById = computed(() => new Map(activeDocuments.value.map((d) => [d.id, d])))

/**
 * Walk up the parent chain from a given doc to find the nearest explicit permission.
 */
const resolveDocPermission = (docId: string, permissionKey: PermissionKey): string | undefined => {
  const permissions = base.value?.permissions
  if (!permissions) return undefined

  let currentDoc = docsById.value.get(docId)

  while (currentDoc) {
    const perm = permissions.find(
      (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === currentDoc!.id && p.permission === permissionKey,
    )
    if (perm) {
      return getPermissionOptionValue(perm.granted_type as PermissionGrantedType, perm.granted_role as PermissionRole)
    }
    currentDoc = currentDoc.parent_id ? docsById.value.get(currentDoc.parent_id) : undefined
  }

  return undefined
}

/** Inherited effective value — only returns a value if the doc has no explicit permission. */
const getEffectiveValue = (docId: string, permissionKey: PermissionKey): string | undefined => {
  const permissions = base.value?.permissions
  if (!permissions) return undefined

  const hasExplicit = permissions.some(
    (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === docId && p.permission === permissionKey,
  )
  if (hasExplicit) return undefined

  return resolveDocPermission(docId, permissionKey)
}

/** Parent's effective permission — for constraining child options. */
const getParentEffectiveValue = (docId: string, permissionKey: PermissionKey): string | undefined => {
  const doc = docsById.value.get(docId)
  if (!doc?.parent_id) return undefined
  return resolveDocPermission(doc.parent_id, permissionKey)
}

const isCreatorOrAbove = computed(() => {
  const role = base.value?.project_role || extractBaseRoleFromWorkspaceRole(base.value?.workspace_role)
  return role === ProjectRoles.OWNER || role === ProjectRoles.CREATOR
})

const visibilityConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.DOCUMENT,
  entityId: props.docId,
  entityTitle: props.title,
  permission: PermissionKey.DOCUMENT_VISIBILITY,
  disabled: !isCreatorOrAbove.value,
  tooltip: !isCreatorOrAbove.value ? t('msg.info.onlyCreatorsCanConfigureDocPermissions') : undefined,
  effectiveValue: getEffectiveValue(props.docId, PermissionKey.DOCUMENT_VISIBILITY),
  parentEffectiveValue: getParentEffectiveValue(props.docId, PermissionKey.DOCUMENT_VISIBILITY),
}))

const editConfig = computed<PermissionConfig>(() => ({
  entity: PermissionEntity.DOCUMENT,
  entityId: props.docId,
  entityTitle: props.title,
  permission: PermissionKey.DOCUMENT_EDIT,
  disabled: !isCreatorOrAbove.value,
  tooltip: !isCreatorOrAbove.value ? t('msg.info.onlyCreatorsCanConfigureDocPermissions') : undefined,
  effectiveValue: getEffectiveValue(props.docId, PermissionKey.DOCUMENT_EDIT),
  parentEffectiveValue: getParentEffectiveValue(props.docId, PermissionKey.DOCUMENT_EDIT),
}))

const hasExplicitPermissions = computed(() => {
  const permissions = base.value?.permissions
  if (!permissions) return false
  return permissions.some(
    (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === props.docId,
  )
})

const isResetting = ref(false)

const resetToDefault = async () => {
  if (!base.value?.fk_workspace_id || !base.value?.id) return

  const permissionIds = (base.value.permissions ?? [])
    .filter((p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === props.docId)
    .map((p) => p.id)
    .filter(Boolean) as string[]

  if (!permissionIds.length) return

  isResetting.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      base.value.id,
      { operation: 'bulkDropPermissions' },
      { permissionIds },
    )

    // Refresh base permissions
    const basesStore = useBases()
    await basesStore.loadProject(base.value.id, true)

    // Update has_permissions on the doc in sidebar store
    const documentsStore = useDocumentsStore()
    const doc = documentsStore.activeDocuments.find((d) => d.id === props.docId)
    if (doc) {
      ;(doc as DocumentType).has_permissions = false
    }

    $e('a:doc:permissions:reset')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isResetting.value = false
  }
}

const handlePermissionSave = () => {
  $e('a:doc:permissions')
}

const navigateToDocsPermissions = () => {
  if (!base.value?.id) return

  const wsId = route.params.typeOrId
  navigateTo(`/${wsId}/${base.value.id}/settings/docs-permissions`)
  visible.value = false
}
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

      <!-- Footer -->
      <div class="flex items-center justify-between border-t-1 border-nc-border-gray-medium pt-3 -mx-6 px-6 -mb-1">
        <NcButton
          v-if="hasExplicitPermissions && isCreatorOrAbove"
          type="text"
          size="small"
          class="!text-nc-content-gray-muted"
          :loading="isResetting"
          @click="resetToDefault"
        >
          <GeneralIcon icon="ncRefreshCcw" class="mr-1.5 h-3.5 w-3.5" />
          {{ $t('labels.resetToDefault') }}
        </NcButton>
        <div v-else />
        <NcButton type="text" size="small" class="!text-nc-content-gray-muted" @click="navigateToDocsPermissions">
          {{ $t('labels.managePermissions') }}
          <GeneralIcon icon="arrowRight" class="ml-1" />
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
