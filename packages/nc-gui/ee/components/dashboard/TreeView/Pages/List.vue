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
  <div>
    <!-- Empty state: show "New page" CTA -->
    <template v-if="!baseDocs.length && isUIAllowed('docCreate')">
      <div
        class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
        role="button"
        @click="onCreateDoc"
      >
        <div class="nc-project-home-section-item">
          <GeneralIcon icon="plus" />
          <div>New page</div>
        </div>
      </div>
    </template>

    <!-- Empty state: no create permission -->
    <div
      v-else-if="!baseDocs.length && !isUIAllowed('docCreate')"
      class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal"
    >
      No pages
    </div>

    <!-- Page list -->
    <div
      v-else
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

      <div
        v-if="isUIAllowed('docCreate')"
        class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
        role="button"
        @click="onCreateDoc"
      >
        <div class="nc-project-home-section-item">
          <GeneralIcon icon="plus" />
          <div>New page</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-pages-menu {
  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}
</style>
