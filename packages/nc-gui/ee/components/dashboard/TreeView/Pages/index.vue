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
  if (isUIAllowed('docList')) {
    loadDocs({ baseId: baseId.value })
  }
  isExpanded.value = !isExpanded.value
}

// Eagerly load docs on mount so the list is populated on page reload
onMounted(() => {
  if (isUIAllowed('docList')) {
    loadDocs({ baseId: baseId.value })
  }
})

// Reload docs and auto-expand when the active doc changes
// (e.g. navigating to a doc from another base)
watch(activeDocId, () => {
  loadDocs({ baseId: baseId.value })

  if (activeDoc.value?.base_id === openedProject.value?.id) {
    isExpanded.value = true
  }
})
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
    <DashboardTreeViewPagesList v-if="isExpanded" :base-id="baseId!" />
  </div>
</template>
