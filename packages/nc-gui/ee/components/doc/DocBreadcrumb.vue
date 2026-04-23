<script setup lang="ts">
import type { BaseType, DocumentType } from 'nocodb-sdk'

interface Props {
  docId: string
  currentTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentTitle: '',
})

const documentsStore = useDocumentsStore()
const { activeDocument, activeDocuments } = storeToRefs(documentsStore)
const { getDocumentAncestors, loadChildren } = documentsStore

const { ncNavigateTo } = useGlobal()

const basesStore = useBases()
const { activeProjectId, openedProject, basesList } = storeToRefs(basesStore)
const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { t } = useI18n()

const ancestors = computed(() => getDocumentAncestors(props.docId))

const rootAncestor = computed(() => (ancestors.value.length > 0 ? ancestors.value[0] : null))

const parentAncestor = computed(() => (ancestors.value.length > 1 ? ancestors.value[ancestors.value.length - 1] : null))

// Single middle ancestor shown inline (when exactly 3 ancestors: root, middle, parent)
const middleAncestor = computed(() => (ancestors.value.length === 3 ? ancestors.value[1] : null))

// Collapsed middle ancestors (between root and parent) shown in dropdown
const collapsedMiddle = computed(() => {
  if (ancestors.value.length <= 3) return []
  return ancestors.value.slice(1, ancestors.value.length - 1)
})

const hasCollapsed = computed(() => collapsedMiddle.value.length > 0)

const isEllipsisOpen = ref(false)

const displayTitle = computed(() => props.currentTitle || activeDocument.value?.title || t('general.untitled'))

// Every doc on the active path — ancestors plus the currently-open doc. Any row
// whose id appears here is highlighted as active, so the full trail stays lit
// regardless of how deep the user drills into a segment's submenu tree.
const activePathIds = computed<string[]>(() => {
  const ids = ancestors.value.map((a) => a.id).filter((id): id is string => !!id)
  if (activeDocument.value?.id) ids.push(activeDocument.value.id)
  return ids
})

// Treat null, undefined, and empty string as "no parent" (matches sidebar's `!d.parent_id`)
const normalizeParentId = (v: string | null | undefined) => v || null

const getSiblingsByParent = (parentId: string | null | undefined) => {
  const target = normalizeParentId(parentId)
  return activeDocuments.value
    .filter((d) => normalizeParentId(d.parent_id) === target)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

const getChildren = (docId: string) => getSiblingsByParent(docId)

const ensureChildrenLoaded = (docId: string) => {
  if (!activeProjectId.value) return
  loadChildren(activeProjectId.value, docId)
}

const rootSiblings = computed(() => (rootAncestor.value ? getSiblingsByParent(rootAncestor.value.parent_id) : []))

const middleSiblings = computed(() => (middleAncestor.value ? getSiblingsByParent(middleAncestor.value.parent_id) : []))

const parentSiblings = computed(() => (parentAncestor.value ? getSiblingsByParent(parentAncestor.value.parent_id) : []))

const currentSiblings = computed(() => (activeDocument.value ? getSiblingsByParent(activeDocument.value.parent_id) : []))

const navigateToDoc = (doc: DocumentType) => {
  if (!doc.id || !activeProjectId.value) return
  isEllipsisOpen.value = false
  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: activeProjectId.value,
    docId: doc.id,
    docTitle: doc.title,
  })
}

const navigateToBase = (base: BaseType) => {
  if (!base.id) return
  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: base.id,
  })
}

// Ellipsis dropdown — existing NcList behavior for collapsed ancestors
const collapsedDropdownItems = computed<NcListItemType[]>(() =>
  collapsedMiddle.value.map((ancestor, index) => ({
    value: ancestor.id!,
    label: ancestor.title || t('general.untitled'),
    ncIcon: ancestor.meta?.icon,
    ncDepth: index,
  })),
)

const collapsedDocsMap = computed(() => {
  const map = new Map<string, DocumentType>()
  for (const doc of collapsedMiddle.value) {
    if (doc.id) map.set(doc.id, doc)
  }
  return map
})

const handleEllipsisSelect = (option: NcListItemType) => {
  const doc = collapsedDocsMap.value.get(option.value as string)
  if (doc) navigateToDoc(doc)
}
</script>

<template>
  <div class="nc-doc-breadcrumb flex items-center min-w-0 w-full" data-testid="nc-doc-breadcrumb">
    <!-- 0. Base — icon-only with tooltip, matches table breadcrumb -->
    <DocBreadcrumbSegment
      :label="openedProject?.title || $t('general.untitled')"
      :items="basesList"
      :active-id="activeProjectId ?? null"
      icon-only
      @select="navigateToBase"
    >
      <template #icon>
        <GeneralProjectIcon
          :type="openedProject?.type"
          :color="openedProject?.meta ? parseProp(openedProject.meta).iconColor : undefined"
          :managed-app="{
            managed_app_master: openedProject?.managed_app_master,
            managed_app_id: openedProject?.managed_app_id,
          }"
          class="!grayscale min-w-4"
        />
      </template>
    </DocBreadcrumbSegment>
    <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />

    <!-- 1. Root ancestor -->
    <template v-if="rootAncestor">
      <DocBreadcrumbSegment
        :label="rootAncestor.title || $t('general.untitled')"
        :icon-emoji="rootAncestor.meta?.icon"
        :items="rootSiblings"
        :active-ids="activePathIds"
        nested
        :get-children="getChildren"
        :load-children="ensureChildrenLoaded"
        @select="navigateToDoc"
      />
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 2a. Single middle ancestor shown inline -->
    <template v-if="middleAncestor">
      <DocBreadcrumbSegment
        :label="middleAncestor.title || $t('general.untitled')"
        :icon-emoji="middleAncestor.meta?.icon"
        :items="middleSiblings"
        :active-ids="activePathIds"
        nested
        :get-children="getChildren"
        :load-children="ensureChildrenLoaded"
        @select="navigateToDoc"
      />
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 2b. `...` dropdown for many collapsed middle ancestors -->
    <template v-if="hasCollapsed">
      <NcDropdown v-model:visible="isEllipsisOpen" placement="bottomLeft">
        <div
          class="nc-doc-breadcrumb-segment rounded-lg h-8 px-2 flex items-center gap-1 cursor-pointer text-nc-content-inverted-secondary font-weight-500 hover:(bg-nc-bg-gray-light text-nc-content-gray-emphasis)"
          @click.stop="isEllipsisOpen = !isEllipsisOpen"
        >
          ...
        </div>
        <template #overlay>
          <NcList
            v-model:open="isEllipsisOpen"
            :list="collapsedDropdownItems"
            :show-search-always="collapsedDropdownItems.length > 4"
            :search-input-placeholder="$t('general.search')"
            variant="medium"
            class="!w-64"
            @change="handleEllipsisSelect"
          >
            <template #listItem="{ option }">
              <div class="flex items-center gap-2 truncate">
                <GeneralIcon
                  v-if="option.ncDepth > 0"
                  icon="ncCornerDownRight"
                  class="flex-none text-nc-content-gray-muted !w-3 !h-3 ml-1 -mr-0.5"
                />
                <LazyGeneralEmojiPicker v-if="option.ncIcon" :emoji="option.ncIcon" readonly size="xsmall" />
                <GeneralIcon v-else icon="ncFileText" class="flex-none text-nc-content-gray-muted !w-4 !h-4" />
                <NcTooltip class="truncate" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>
              </div>
            </template>
          </NcList>
        </template>
      </NcDropdown>
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 3. Parent ancestor -->
    <template v-if="parentAncestor">
      <DocBreadcrumbSegment
        :label="parentAncestor.title || $t('general.untitled')"
        :icon-emoji="parentAncestor.meta?.icon"
        :items="parentSiblings"
        :active-ids="activePathIds"
        nested
        :get-children="getChildren"
        :load-children="ensureChildrenLoaded"
        @select="navigateToDoc"
      />
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 4. Current page -->
    <DocBreadcrumbSegment
      :label="displayTitle"
      :icon-emoji="activeDocument?.meta?.icon"
      :items="currentSiblings"
      :active-ids="activePathIds"
      max-width-class="max-w-1/2"
      nested
      :get-children="getChildren"
      :load-children="ensureChildrenLoaded"
      @select="navigateToDoc"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-breadcrumb-divider {
  @apply mx-0.5 flex-none text-nc-content-gray-muted/80 !stroke-transparent;
}
</style>
