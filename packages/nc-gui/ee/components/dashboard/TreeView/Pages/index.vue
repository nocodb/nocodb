<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isUIAllowed } = useRoles()

const docsStore = useDocsStore()
const { loadDocs } = docsStore
const { activeDocId, activeDoc } = storeToRefs(docsStore)

const bases = useBases()
const { openedProject } = storeToRefs(bases)

const isExpanded = ref(true)

const onExpand = async () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value && isUIAllowed('docList')) {
    await loadDocs({ baseId: baseId.value })
  }
}

// Load docs whenever activeDocId changes AND on initial mount (immediate: true).
// This ensures the list is populated even on a full page reload where activeDocId
// is set (by the route component) before this watcher is created.
// No isUIAllowed gate here — the backend enforces ACL; the frontend gate on
// onExpand is sufficient for the expand/collapse interaction.
watch(activeDocId, () => {
  loadDocs({ baseId: baseId.value })

  if (activeDoc.value?.base_id === openedProject.value?.id) {
    isExpanded.value = true
  }
}, { immediate: true })
</script>

<template>
  <div class="nc-tree-item nc-pages-node-wrapper nc-project-home-section text-sm select-none w-full nc-base-tree-pages">
    <div v-e="['c:pages:toggle-expand']" class="nc-project-home-section-header w-full cursor-pointer" @click.stop="onExpand">
      <div>Pages</div>
      <div class="flex-1" />
      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns text-nc-content-gray-muted cursor-pointer transform transition-transform duration-200 text-[20px]"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <DashboardTreeViewPagesList v-if="isExpanded" :base-id="baseId" />
  </div>
</template>
