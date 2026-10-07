<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'
import PgDemo from '../-components/PgDemo.vue'
import SurfaceHarness from './-components/SurfaceHarness.vue'
import { installSurfaceMocks, surfaceRoute } from './-helper/mocks'

definePageMeta({
  path: '/playground/surfaces/base-settings/:baseId(views)?/:viewId(grid)?/:slugs([^/]+)*',
  middleware: [
    (to) => {
      const target = surfaceRoute('base-settings')
      if (to.path !== target) return navigateTo({ path: target, query: to.query }, { replace: true })
      installSurfaceMocks()
    },
  ],
})

const route = useRoute()

const { navGroups, paneMeta } = useBaseSettingsNav()

const sections = [
  { id: 'shell', title: 'Settings shell' },
  { id: 'live', title: 'With real data' },
]

// same resolution as the base route page: the shell opens while `?settings=` names a pane
const settingsTab = computed(() => resolveBaseSettingsTab(route.query.settings))

function open(tab: string) {
  navigateTo({ query: { ...route.query, settings: settingsTabToSlug[tab] || tab } })
}
</script>

<template>
  <PgPage
    title="Base settings"
    description="The real base settings shell (ProjectSettingsShell) on the mock “Playground” base. It is a route-driven modal (?settings=<pane>), so each pane opens the modal over this page; the rail inside switches panes and × closes back here."
    :sections="sections"
  >
    <SurfaceHarness>
      <PgSection
        id="shell"
        title="Settings shell"
        source="ProjectSettingsShell"
        description="Rail groups and panes as the current role / plan sees them. Members, data sources, MCP, trash and snapshots answer from mocks; panes that are app-wide (integrations, audits) read the real workspace."
      >
        <PgDemo v-for="group in navGroups" :key="group.label" :label="group.label || 'General'" stage="canvas">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              v-for="item in group.items"
              :key="item.slug"
              type="button"
              class="flex items-start gap-3 p-3 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default text-left hover:border-nc-border-brand transition-colors"
              @click="open(item.slug)"
            >
              <GeneralIcon :icon="item.icon as IconMapKey" class="flex-none w-4 h-4 mt-0.5 text-nc-content-gray-subtle" />
              <div class="min-w-0">
                <div class="text-captionBold text-nc-content-gray-emphasis">{{ item.title }}</div>
                <div v-if="paneMeta[item.slug]?.description" class="text-captionSm text-nc-content-gray-muted truncate">
                  {{ paneMeta[item.slug]?.description }}
                </div>
                <code class="text-captionXs text-nc-content-gray-muted font-mono"
                  >?settings={{ settingsTabToSlug[item.slug] || item.slug }}</code
                >
              </div>
            </button>
          </div>
        </PgDemo>
      </PgSection>

      <PgSection
        id="live"
        title="With real data"
        description="To see the panes against a real base (actual members, sources, audit log), use the Live app page, which frames base settings for the seeded demo base."
      >
        <PgDemo label="Live app">
          <NuxtLink to="/playground/live">
            <NcButton size="small" type="secondary">
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="ncMonitor" class="w-4 h-4" />
                Open Live pages
              </div>
            </NcButton>
          </NuxtLink>
        </PgDemo>
      </PgSection>

      <LazyProjectSettingsShell v-if="settingsTab" :tab="settingsTab" />
    </SurfaceHarness>
  </PgPage>
</template>
