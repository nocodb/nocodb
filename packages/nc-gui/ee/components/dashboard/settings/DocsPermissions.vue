<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'
import {
  extractBaseRoleFromWorkspaceRole,
  getPermissionOptionValue,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  type PermissionRole,
  ProjectRoles,
} from 'nocodb-sdk'

interface Props {
  state: string
  baseId: string
}

const props = defineProps<Props>()

defineEmits(['update:state'])

const { t } = useI18n()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const documentsStore = useDocumentsStore()
const { activeDocuments } = storeToRefs(documentsStore)

const isLoadingAllDocs = ref(false)

const isCreatorOrAbove = computed(() => {
  const role = base.value?.project_role || extractBaseRoleFromWorkspaceRole(base.value?.workspace_role)
  return role === ProjectRoles.OWNER || role === ProjectRoles.CREATOR
})

const searchQuery = ref('')

// Cached map of doc ID → doc for efficient lookups (avoids rebuilding per-cell)
const docsById = computed(() => new Map(activeDocuments.value.map((d) => [d.id, d])))

/**
 * Resolve the effective permission for a document by checking its own explicit
 * permission first, then walking up the parent chain.
 * Returns the PermissionOptionValue string, or undefined if no explicit permission
 * exists anywhere in the chain (i.e. the default applies).
 */
const resolveDocPermission = (docId: string, permissionKey: PermissionKey): string | undefined => {
  const permissions = base.value?.permissions
  if (!permissions) return undefined

  let currentDoc = docsById.value.get(docId)

  // Check explicit permission on this doc, then walk up ancestors
  while (currentDoc) {
    const perm = permissions.find(
      (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === currentDoc!.id && p.permission === permissionKey,
    )

    if (perm) {
      return getPermissionOptionValue(
        perm.granted_type as PermissionGrantedType,
        perm.granted_role as PermissionRole,
      )
    }

    currentDoc = currentDoc.parent_id ? docsById.value.get(currentDoc.parent_id) : undefined
  }

  return undefined
}

/**
 * Get the inherited effective value for a doc (for the "Inherited" badge).
 * Returns undefined if the doc has its own explicit permission.
 */
const getEffectiveValue = (docId: string, permissionKey: PermissionKey): string | undefined => {
  const permissions = base.value?.permissions
  if (!permissions) return undefined

  const hasExplicit = permissions.some(
    (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === docId && p.permission === permissionKey,
  )
  if (hasExplicit) return undefined

  return resolveDocPermission(docId, permissionKey)
}

/**
 * Get the parent document's effective permission (for constraining child options).
 * Returns undefined for root-level docs (no parent constraint).
 */
const getParentEffectiveValue = (docId: string, permissionKey: PermissionKey): string | undefined => {
  const doc = docsById.value.get(docId)

  if (!doc?.parent_id) return undefined

  return resolveDocPermission(doc.parent_id, permissionKey)
}

// Build a flat list with depth info for indentation
interface DocRow {
  doc: DocumentType
  depth: number
}

const flatDocList = computed<DocRow[]>(() => {
  const docs = activeDocuments.value
  if (!docs.length) return []

  // Group by parent_id
  const childrenMap = new Map<string | null, DocumentType[]>()
  for (const doc of docs) {
    const parentKey = doc.parent_id ?? null
    const group = childrenMap.get(parentKey) || []
    group.push(doc)
    childrenMap.set(parentKey, group)
  }

  // Flatten tree with depth
  const result: DocRow[] = []

  const buildLevel = (parentId: string | null, depth: number) => {
    const siblings = childrenMap.get(parentId) || []
    siblings
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((doc) => {
        result.push({ doc, depth })
        if (doc.id) {
          buildLevel(doc.id, depth + 1)
        }
      })
  }

  buildLevel(null, 0)
  return result
})

const filteredDocList = computed(() => {
  if (!searchQuery.value) return flatDocList.value

  return flatDocList.value.filter((row) => searchCompare(row.doc.title, searchQuery.value))
})

const columns = computed(() => {
  const cols: NcTableColumnProps[] = [
    {
      key: 'name',
      title: t('general.name'),
      name: 'Name',
      minWidth: 300,
      padding: '0px 32px',
    },
    {
      key: 'visibility',
      title: t('title.pageVisibility'),
      name: 'Page Visibility',
      minWidth: 180,
      basis: '25%',
      padding: '0px 12px',
    },
    {
      key: 'editing',
      title: t('title.pageEditing'),
      name: 'Page Editing',
      minWidth: 180,
      basis: '25%',
      padding: '0px 12px',
    },
  ]

  return cols
})

// Load all documents (root + all children) for the permissions view
const loadAllDocs = async () => {
  if (!props.baseId) return

  isLoadingAllDocs.value = true

  try {
    // Load root docs first
    const rootDocs = await documentsStore.loadDocuments({ baseId: props.baseId })

    // Recursively load children for all docs that may have children
    const loadChildrenRecursively = async (docs: DocumentType[]) => {
      const docsWithPotentialChildren = docs.filter((d) => d.id)
      await Promise.all(
        docsWithPotentialChildren.map(async (doc) => {
          await documentsStore.expandDocument(props.baseId, doc.id!)

          // After expanding, check for newly loaded children
          const allDocs = activeDocuments.value
          const children = allDocs.filter((d) => d.parent_id === doc.id)
          if (children.length) {
            await loadChildrenRecursively(children)
          }
        }),
      )
    }

    if (ncIsArray(rootDocs) && rootDocs.length) {
      await loadChildrenRecursively(rootDocs)
    }
  } finally {
    isLoadingAllDocs.value = false
  }
}

onMounted(loadAllDocs)
</script>

<template>
  <div class="flex flex-col h-full p-6" data-testid="nc-settings-docs-permissions-tab">
    <div class="mb-6 flex items-center justify-between gap-3">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="nc-search-permissions-input nc-input-border-on-value !max-w-90 nc-input-sm"
        :placeholder="$t('placeholder.searchDocs')"
        allow-clear
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
        </template>
      </a-input>
    </div>

    <NcTable
      :is-data-loading="isLoadingAllDocs"
      :columns="columns"
      sticky-first-column
      :data="filteredDocList"
      :bordered="false"
      row-height="44px"
      header-row-height="44px"
      class="nc-docs-permissions flex-1 max-w-full"
    >
      <template #bodyCell="{ column, record }">
        <!-- Name Column -->
        <template v-if="column.key === 'name'">
          <div
            class="w-full flex items-center gap-2 max-w-full text-nc-content-gray-subtle"
            :style="{ paddingLeft: `${record.depth * 20}px` }"
            data-testid="permissions-doc-name"
          >
            <GeneralIcon icon="ncFileText" class="flex-none h-4 w-4 !text-nc-content-gray-subtle" />
            <NcTooltip class="truncate font-weight-600 max-w-[calc(100%_-_28px)]" show-on-truncate-only>
              <template #title>
                {{ record.doc?.title }}
              </template>
              {{ record.doc?.title }}
            </NcTooltip>
          </div>
        </template>

        <!-- Visibility Column -->
        <template v-if="column.key === 'visibility'">
          <PermissionsSelector
            v-if="base && record.doc?.id"
            :base="base"
            :config="{
              entity: PermissionEntity.DOCUMENT,
              entityId: record.doc.id,
              entityTitle: record.doc.title,
              permission: PermissionKey.DOCUMENT_VISIBILITY,
              disabled: !isCreatorOrAbove,
              tooltip: !isCreatorOrAbove ? $t('msg.info.onlyCreatorsCanConfigureDocPermissions') : undefined,
              effectiveValue: getEffectiveValue(record.doc.id, PermissionKey.DOCUMENT_VISIBILITY),
              parentEffectiveValue: getParentEffectiveValue(record.doc.id, PermissionKey.DOCUMENT_VISIBILITY),
            }"
            mode="inline"
            :readonly="!isCreatorOrAbove"
            inline-style
          />
        </template>

        <!-- Editing Column -->
        <template v-if="column.key === 'editing'">
          <PermissionsSelector
            v-if="base && record.doc?.id"
            :base="base"
            :config="{
              entity: PermissionEntity.DOCUMENT,
              entityId: record.doc.id,
              entityTitle: record.doc.title,
              permission: PermissionKey.DOCUMENT_EDIT,
              disabled: !isCreatorOrAbove,
              tooltip: !isCreatorOrAbove ? $t('msg.info.onlyCreatorsCanConfigureDocPermissions') : undefined,
              effectiveValue: getEffectiveValue(record.doc.id, PermissionKey.DOCUMENT_EDIT),
              parentEffectiveValue: getParentEffectiveValue(record.doc.id, PermissionKey.DOCUMENT_EDIT),
            }"
            mode="inline"
            :readonly="!isCreatorOrAbove"
            inline-style
          />
        </template>
      </template>

      <template #emptyText>
        <div class="flex items-center justify-center h-40 text-nc-content-gray-muted">
          {{ searchQuery ? $t('title.noResults') : $t('msg.info.noDocs') }}
        </div>
      </template>
    </NcTable>
  </div>
</template>

<style lang="scss" scoped>
.nc-docs-permissions {
  :deep(thead th) {
    font-size: 13px !important;
  }

  :deep(tbody td) {
    font-size: 13px !important;
  }

  :deep(tbody td .font-medium) {
    font-size: 13px !important;
  }

  :deep(.font-weight-600) {
    @apply !font-medium;
  }
}
</style>
