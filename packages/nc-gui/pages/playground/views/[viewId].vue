<script setup lang="ts">
import ViewHarness from './-components/ViewHarness.vue'
import { EXPANDED_DEMO_ROW_ID, buildTable, buildView, isMockViewKind } from './-helper/mock-data'
import { installPlaygroundMocks } from './-helper/install'

/**
 * `baseId(views)` captures the literal `views` segment as the base id, so the
 * stores that read `route.params.baseId` / `route.params.viewId` (table id)
 * resolve the mock base and table unpatched. The trailing slug must equal the
 * view's readable slug, or the views store tries to rewrite the URL onto the
 * real table route (which needs a workspace param).
 * `expanded` is an alias: the grid with a record already open (`?rowId=`).
 */
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
