<script setup lang="ts">
import ViewHarness from './-components/ViewHarness.vue'
import { EXPANDED_DEMO_ROW_ID, buildTable, buildView, isMockViewKind } from './-helper/mock-data'
import { installPlaygroundMocks } from './-helper/install'

/** The slug must equal the view's slug, or the views store rewrites the URL to the real table route. */
definePageMeta({
  path: '/playground/:baseId(views)/:viewId(grid|gallery|kanban|calendar|form|map|list|timeline|gantt|expanded)/:slugs([^/]+)*',
  middleware: [
    (to) => {
      if (to.params.viewId === 'expanded') {
        const slug = toReadableUrlSlug([buildTable('grid').title, buildView('grid').title])
        return navigateTo(
          { path: `/playground/views/grid/${slug}`, query: { rowId: String(EXPANDED_DEMO_ROW_ID) } },
          { replace: true },
        )
      }
      const kind = to.params.viewId
      if (!isMockViewKind(kind)) return
      const slug = toReadableUrlSlug([buildTable(kind).title, buildView(kind).title])
      if ((to.params.slugs as string[] | undefined)?.[0] !== slug) {
        return navigateTo({ path: `/playground/views/${kind}/${slug}`, query: to.query }, { replace: true })
      }
      installPlaygroundMocks(kind)
    },
  ],
})

const route = useRoute()

const kind = computed(() => (isMockViewKind(route.params.viewId) ? route.params.viewId : 'grid'))
</script>

<template>
  <div class="h-full">
    <ViewHarness :key="kind" :kind="kind" />
  </div>
</template>
