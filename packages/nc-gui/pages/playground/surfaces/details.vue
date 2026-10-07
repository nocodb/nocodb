<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'
import PgDemo from '../-components/PgDemo.vue'
import SurfaceHarness from './-components/SurfaceHarness.vue'
import PopupStage from './-components/PopupStage.vue'
import ToolsShell from './-components/ToolsShell.vue'
import { installSurfaceMocks, surfaceRedirect } from './-helper/mocks'

definePageMeta({
  path: '/playground/surfaces/details/:baseId(views)?/:viewId(grid)?/:slugs([^/]+)*',
  middleware: [
    (to) => {
      const redirect = surfaceRedirect(to, 'details')
      if (redirect) return redirect
      installSurfaceMocks()
    },
  ],
})

const tools = [
  {
    slug: 'field',
    title: 'Fields',
    source: 'SmartsheetDetailsFields',
    description: 'Manage fields: edits stage into the save bar; saving sends one columnsBulk op to the mock.',
  },
  {
    slug: 'relation',
    title: 'Relations',
    source: 'SmartsheetDetailsErd',
    description: 'ERD of this table and its links (Tasks).',
  },
  {
    slug: 'webhook',
    title: 'Webhooks',
    source: 'SmartsheetDetailsWebhooks',
    description: 'Two mock hooks — one active, one paused. Toggle, duplicate and delete work against the mock store.',
  },
  {
    slug: 'api',
    title: 'API snippets',
    source: 'SmartsheetDetailsApi',
    description: 'Generated client snippets for the mock table and view.',
  },
  ...(isEeUI
    ? [
        {
          slug: 'templates',
          title: 'Record templates',
          source: 'SmartsheetDetailsRecordTemplates',
          description: 'EE · empty state (no templates on the mock table).',
        },
      ]
    : []),
]

const sections = tools.map((tool) => ({ id: `details-${tool.slug}`, title: tool.title }))

const toolSlugs = tools.map((tool) => tool.slug)

const active = ref<Record<string, string>>(Object.fromEntries(toolSlugs.map((slug) => [slug, slug])))
</script>

<template>
  <PgPage
    title="Table details"
    description="The table Tools shell (Details.vue) — rail, header band, save bar and each tool body — inline against the mock table. Each card starts on one tool; the rail switches tools in place."
    :sections="sections"
    wide
  >
    <SurfaceHarness>
      <PgSection
        v-for="tool in tools"
        :id="`details-${tool.slug}`"
        :key="tool.slug"
        :title="tool.title"
        :source="tool.source"
        :description="tool.description"
      >
        <PgDemo :label="tool.title" hint="Details.vue shell, inline" :padded="false">
          <PopupStage :height="640">
            <!-- the real shell is an xl modal (≤1280px); narrower than this it squeezes field names out -->
            <div class="h-[640px] overflow-x-auto nc-scrollbar-thin">
              <div class="h-full min-w-[1100px]">
                <ToolsShell v-model:active="active[tool.slug]" :tools="toolSlugs" />
              </div>
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>
    </SurfaceHarness>
  </PgPage>
</template>
