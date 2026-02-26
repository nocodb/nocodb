<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isUIAllowed } = useRoles()

const docsStore = useDocsStore()
const { createDoc } = docsStore
const { activeDocId, docs: allDocs } = storeToRefs(docsStore)

const baseDocs = computed(() => allDocs.value.get(baseId.value) ?? [])

const onCreateDoc = async () => {
  await createDoc(baseId.value)
}
</script>

<template>
  <div data-testid="nc-docs-sidebar-pages-list">
    <!-- Empty state: no create permission -->
    <div
      v-if="!baseDocs.length && !isUIAllowed('docCreate')"
      class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal"
    >
      {{ $t('labels.noPages') }}
    </div>

    <template v-else>
      <!-- Empty state: show "+ New page" CTA only when no pages exist -->
      <div
        v-if="!baseDocs.length && isUIAllowed('docCreate')"
        class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
        role="button"
        data-testid="nc-docs-sidebar-add-page"
        @click="onCreateDoc"
      >
        <div class="nc-project-home-section-item">
          <GeneralIcon icon="plus" />
          <div>{{ $t('labels.newPage') }}</div>
        </div>
      </div>

      <!-- Page list (shown when docs exist) -->
      <div
        v-else-if="baseDocs.length"
        class="nc-pages-menu flex flex-col w-full !border-r-0 bg-nc-bg-gray-sidebar"
      >
        <DashboardTreeViewPagesNode
          v-for="doc of baseDocs"
          :key="doc.id"
          :data-id="doc.id"
          :data-order="doc.order"
          :data-title="doc.title"
          :doc="doc"
          class="nc-page-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            active: activeDocId === doc.id,
          }"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss">
.nc-pages-menu {
  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}
</style>
