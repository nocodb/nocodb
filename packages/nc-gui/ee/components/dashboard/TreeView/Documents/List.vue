<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isUIAllowed } = useRoles()

const documentsStore = useDocumentsStore()
const { createDocument } = documentsStore
const { activeDocumentId, documents: allDocuments } = storeToRefs(documentsStore)

const baseDocuments = computed(() => allDocuments.value.get(baseId.value) ?? [])

const onCreateDocument = async () => {
  await createDocument(baseId.value)
}
</script>

<template>
  <div data-testid="nc-docs-sidebar-pages-list">
    <!-- Empty state: no create permission -->
    <div
      v-if="!baseDocuments.length && !isUIAllowed('documentCreate')"
      class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal"
    >
      {{ $t('labels.noDocuments') }}
    </div>

    <template v-else>
      <!-- Empty state: show "+ New document" CTA only when no documents exist -->
      <div
        v-if="!baseDocuments.length && isUIAllowed('documentCreate')"
        class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
        role="button"
        data-testid="nc-docs-sidebar-add-page"
        @click="onCreateDocument"
      >
        <div class="nc-project-home-section-item">
          <GeneralIcon icon="plus" />
          <div>{{ $t('labels.newDocument') }}</div>
        </div>
      </div>

      <!-- Document list (shown when documents exist) -->
      <div v-else-if="baseDocuments.length" class="nc-documents-menu flex flex-col w-full !border-r-0 bg-nc-bg-gray-sidebar">
        <DashboardTreeViewDocumentsNode
          v-for="doc of baseDocuments"
          :key="doc.id"
          :data-id="doc.id"
          :data-order="doc.order"
          :data-title="doc.title"
          :doc="doc"
          class="nc-document-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            active: activeDocumentId === doc.id,
          }"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss">
.nc-documents-menu {
  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}
</style>
