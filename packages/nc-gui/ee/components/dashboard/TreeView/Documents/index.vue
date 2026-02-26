<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isUIAllowed } = useRoles()

const documentsStore = useDocumentsStore()
const { loadDocuments } = documentsStore
const { activeDocumentId, activeDocument } = storeToRefs(documentsStore)

const bases = useBases()
const { openedProject } = storeToRefs(bases)

const isExpanded = ref(true)

const onExpand = async () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value && isUIAllowed('documentList')) {
    await loadDocuments({ baseId: baseId.value })
  }
}

// Load documents whenever activeDocumentId changes AND on initial mount (immediate: true).
// This ensures the list is populated even on a full page reload where activeDocumentId
// is set (by the route component) before this watcher is created.
// No isUIAllowed gate here — the backend enforces ACL; the frontend gate on
// onExpand is sufficient for the expand/collapse interaction.
watch(activeDocumentId, () => {
  loadDocuments({ baseId: baseId.value })

  if (activeDocument.value?.base_id === openedProject.value?.id) {
    isExpanded.value = true
  }
}, { immediate: true })
</script>

<template>
  <div class="nc-tree-item nc-documents-node-wrapper nc-project-home-section text-sm select-none w-full nc-base-tree-documents">
    <div v-e="['c:documents:toggle-expand']" class="nc-project-home-section-header w-full cursor-pointer" @click.stop="onExpand">
      <div>{{ $t('objects.documents') }}</div>
      <div class="flex-1" />
      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns text-nc-content-gray-muted cursor-pointer transform transition-transform duration-200 text-[20px]"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <DashboardTreeViewDocumentsList v-if="isExpanded" :base-id="baseId" />
  </div>
</template>
