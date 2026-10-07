<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'
import PgDemo from '../-components/PgDemo.vue'
import SurfaceHarness from './-components/SurfaceHarness.vue'
import PopupStage from './-components/PopupStage.vue'
import { installSurfaceMocks, surfaceRoute } from './-helper/mocks'

definePageMeta({
  path: '/playground/surfaces/toolbar/:baseId(views)?/:viewId(grid)?/:slugs([^/]+)*',
  middleware: [
    (to) => {
      const target = surfaceRoute('toolbar')
      if (to.path !== target) return navigateTo(target, { replace: true })
      installSurfaceMocks()
    },
  ],
})

const sections = [
  { id: 'toolbar', title: 'Toolbar' },
  { id: 'filter', title: 'Filter' },
  { id: 'sort', title: 'Sort' },
  { id: 'group', title: 'Group' },
  { id: 'fields', title: 'Fields' },
  { id: 'row-height', title: 'Row height' },
  { id: 'search', title: 'Search' },
  { id: 'view-actions', title: 'View actions' },
]

const menus = [
  {
    id: 'filter',
    title: 'Filter',
    source: 'SmartsheetToolbarColumnFilterMenu',
    selector: '.nc-filter-menu-btn',
    description: 'Two top-level conditions plus a nested group, served from the mock filter store.',
    height: 380,
  },
  {
    id: 'sort',
    title: 'Sort',
    source: 'SmartsheetToolbarSortListMenu',
    selector: '.nc-sort-menu-btn',
    description: 'Launch date ascending, then Budget descending.',
    height: 300,
  },
  {
    id: 'group',
    title: 'Group',
    source: 'SmartsheetToolbarGroupByMenu',
    selector: '.nc-group-by-menu-btn',
    description: 'Grouped by Status, then Owner — persisted on the grid view columns.',
    height: 300,
  },
  {
    id: 'fields',
    title: 'Fields',
    source: 'SmartsheetToolbarFieldsMenu',
    selector: '.nc-fields-menu-btn',
    description: 'Show / hide, reorder and search fields; toggles persist to the mock view columns.',
    height: 560,
  },
  {
    id: 'row-height',
    title: 'Row height',
    source: 'SmartsheetToolbarRowHeight',
    selector: '.nc-height-menu-btn',
    description: 'Short / medium / tall / extra — the pick is stored on the grid view.',
    height: 260,
  },
  {
    id: 'search',
    title: 'Search',
    source: 'SmartsheetToolbarSearchData',
    selector: '[data-testid="nc-global-search-show-input"]',
    description: 'Collapsed button expands into the field picker + query input.',
    height: 300,
  },
] as const

const stages = ref<Record<string, InstanceType<typeof PopupStage> | null>>({})

const { activeTable } = storeToRefs(useTablesStore())

function setStage(id: string, el: unknown) {
  stages.value[id] = el as InstanceType<typeof PopupStage> | null
}
</script>

<template>
  <PgPage
    title="Toolbar menus"
    description="The real view toolbar and each of its menus, open against the mock “Product launches” grid. Filters, sorts and group-bys are pre-populated; edits stay in this tab."
    :sections="sections"
  >
    <SurfaceHarness v-slot="{ view }">
      <PgSection id="toolbar" title="Toolbar" source="SmartsheetToolbar">
        <PgDemo label="Grid toolbar" hint="every trigger is live — menus open inside this card" :padded="false">
          <PopupStage :height="440">
            <SmartsheetToolbar />
            <div class="pt-24 text-center text-captionSm text-nc-content-gray-muted">
              Click Fields, Filter, Group, Sort or Colour — its menu opens in this space.
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>

      <PgSection
        v-for="menu in menus"
        :id="menu.id"
        :key="menu.id"
        :title="menu.title"
        :source="menu.source"
        :description="menu.description"
      >
        <PgDemo :label="menu.title" stage="canvas">
          <template #actions>
            <NcButton size="xxsmall" type="text" @click="stages[menu.id]?.open()">
              <span class="text-captionXs">Reopen</span>
            </NcButton>
          </template>
          <PopupStage :ref="(el) => setStage(menu.id, el)" :open-selector="menu.selector" :height="menu.height">
            <!-- search anchors its box bottom-right of the trigger, like at the toolbar's right edge -->
            <div :class="{ 'flex justify-end': menu.id === 'search' }">
              <div
                class="inline-flex items-center gap-1 px-1 py-0.5 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium"
              >
                <SmartsheetToolbarColumnFilterMenu v-if="menu.id === 'filter'" />
                <SmartsheetToolbarSortListMenu v-else-if="menu.id === 'sort'" />
                <SmartsheetToolbarGroupByMenu v-else-if="menu.id === 'group'" />
                <SmartsheetToolbarFieldsMenu v-else-if="menu.id === 'fields'" />
                <SmartsheetToolbarRowHeight v-else-if="menu.id === 'row-height'" />
                <SmartsheetToolbarSearchData v-else-if="menu.id === 'search'" />
              </div>
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>

      <PgSection
        id="view-actions"
        title="View actions"
        source="SmartsheetToolbarViewActionMenu"
        description="The ⋮ menu next to the view name, rendered inline. Sub-menus (download, lock type, …) open inside the card."
      >
        <PgDemo label="View actions" stage="canvas">
          <PopupStage :height="520">
            <!-- dropdown overlay classes so the menu gets its in-dropdown density -->
            <div
              class="ant-dropdown nc-dropdown nc-dropdown-actions-menu !static w-fit rounded-lg border-1 border-nc-border-gray-medium shadow-lg bg-nc-bg-default overflow-hidden"
            >
              <SmartsheetToolbarViewActionMenu v-if="activeTable" :view="view" :table="activeTable" />
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>
    </SurfaceHarness>
  </PgPage>
</template>
