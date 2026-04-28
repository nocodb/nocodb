<script lang="ts" setup>
interface Props {
  docId: string
  baseId?: string
}

const props = defineProps<Props>()

const documentsStore = useDocumentsStore()
const { loadChildren } = documentsStore
const { activeDocuments } = storeToRefs(documentsStore)

const { activeWorkspaceId } = storeToRefs(useWorkspace())
const { ncNavigateTo, isMobileMode, isLeftSidebarOpen } = useGlobal()

const currentDoc = computed(() => activeDocuments.value.find((d) => d.id === props.docId))

const children = computed(() => {
  return activeDocuments.value
    .filter((d) => d.parent_id === props.docId)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
})

watch(
  [() => props.docId, () => props.baseId, () => currentDoc.value?.has_children],
  async ([docId, baseId, hasChildren]) => {
    if (!docId || !baseId) return
    if (!hasChildren) return
    await loadChildren(baseId, docId)
  },
  { immediate: true },
)

const navigateToChild = (child: { id?: string; title?: string }) => {
  if (!child.id) return

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: props.baseId,
    docId: child.id,
    docTitle: child.title,
  })

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}
</script>

<template>
  <div v-if="children.length" class="nc-doc-sub-documents pt-8 pb-12" data-testid="nc-doc-sub-documents">
    <div class="nc-doc-sub-documents-header">
      <span class="nc-doc-sub-documents-title">{{ $t('labels.subDocuments') }}</span>
    </div>
    <div class="nc-doc-sub-documents-list mt-2">
      <div
        v-for="child in children"
        :key="child.id"
        v-e="['c:document:sub-document:open']"
        class="nc-doc-sub-documents-item"
        :data-testid="`nc-doc-sub-documents-item-${child.title}`"
        @click="navigateToChild(child)"
      >
        <div class="nc-doc-sub-documents-icon">
          <span v-if="parseProp(child.meta)?.icon" class="text-base leading-none">
            {{ parseProp(child.meta).icon }}
          </span>
          <GeneralIcon v-else icon="ncFileText" class="!text-[16px] text-nc-content-gray-subtle" />
        </div>
        <span class="nc-doc-sub-documents-name truncate">
          {{ child.title || $t('general.untitled') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-sub-documents-header {
  border-bottom: 1px solid var(--nc-border-gray-medium);
}

.nc-doc-sub-documents-title {
  display: inline-block;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--nc-content-gray);
  margin-bottom: -1px;
  @apply text-sm font-semibold text-nc-content-gray;
}

.nc-doc-sub-documents-item {
  @apply flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer text-bodyDefaultSm text-nc-content-gray;

  &:hover {
    background: var(--nc-bg-gray-light);
  }
}

.nc-doc-sub-documents-icon {
  @apply flex items-center justify-center w-5 h-5 flex-none;
}

.nc-doc-sub-documents-name {
  @apply flex-1;
}
</style>
