<script setup lang="ts">
import { isVirtualCol } from 'nocodb-sdk'
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'
import CellSlot from './-sections/CellSlot.vue'
import {
  CELLS_BASE_ID,
  CELLS_TABLE_ID,
  COMPANY_TABLE_ID,
  cellGroups,
  cellsBase,
  cellsSource,
  cellsTableMeta,
  cellsUsers,
  companyTableMeta,
  createCellsRow,
} from './-helper/fixtures'

const { metas } = useMetas()

const basesStore = useBases()

const baseStore = useBase()

const meta = ref(cellsTableMeta())

const row = ref(createCellsRow())

const isReady = ref(false)

const isReadOnly = ref(false)

const search = ref('')

const previousForcedProjectId = baseStore.forcedProjectId

const modes = [
  { key: 'idle', label: 'Grid · idle', hint: 'Selected-off state; the canvas grid paints the same look' },
  { key: 'edit', label: 'Grid · editing', hint: 'Editor overlay after double-click / Enter' },
  { key: 'expanded', label: 'Expanded form', hint: 'Field row inside the expanded record' },
] as const

const visibleGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  return cellGroups
    .map((g) => ({
      ...g,
      fixtures: g.fixtures.filter(
        (f) => !q || f.column.title!.toLowerCase().includes(q) || String(f.column.uidt).toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.fixtures.length)
})

const sections = computed(() => visibleGroups.value.map((g) => ({ id: `cells-${g.id}`, title: g.title })))

const fieldCount = cellGroups.reduce((n, g) => n + g.fixtures.length, 0)

function resetValues() {
  row.value = createCellsRow()
}

provide(MetaInj, meta)

provide(IsPublicInj, ref(false))

// useRoles reads source restrictions from here; without it every dataEdit check warns
provide(
  ActiveSourceInj,
  computed(() => cellsSource),
)

provide(ReloadViewDataHookInj, createEventHook())

useProvideSmartsheetLtarHelpers(meta)

onMounted(() => {
  metas.value[`${CELLS_BASE_ID}:${CELLS_TABLE_ID}`] = meta.value
  metas.value[`${CELLS_BASE_ID}:${COMPANY_TABLE_ID}`] = companyTableMeta()
  basesStore.bases.set(CELLS_BASE_ID, cellsBase)
  basesStore.basesUser.set(CELLS_BASE_ID, cellsUsers)
  baseStore.forcedProjectId = CELLS_BASE_ID
  isReady.value = true
})

onBeforeUnmount(() => {
  baseStore.forcedProjectId = previousForcedProjectId
  basesStore.bases.delete(CELLS_BASE_ID)
  basesStore.basesUser.delete(CELLS_BASE_ID)
})
</script>

<template>
  <PgPage
    title="Cells"
    :description="`${fieldCount} field configurations across every field type, rendered with the real SmartsheetCell / SmartsheetVirtualCell components. All three columns share one record, so an edit shows up everywhere.`"
    :sections="sections"
  >
    <div
      class="sticky top-0 z-10 -mx-2 px-2 py-2 mb-4 flex flex-wrap items-center gap-3 bg-nc-bg-default border-b-1 border-nc-border-gray-light"
    >
      <a-input v-model:value="search" placeholder="Filter by field name or type" allow-clear class="nc-input-sm !w-64">
        <template #prefix>
          <GeneralIcon icon="ncSearch" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
        </template>
      </a-input>
      <NcSwitch v-model:checked="isReadOnly" size="small">
        <span class="text-captionSm">Read-only</span>
      </NcSwitch>
      <NcButton size="small" type="secondary" class="!ml-auto" @click="resetValues">
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="ncRotateCcw" class="w-3.5 h-3.5" />
          Reset values
        </div>
      </NcButton>
    </div>

    <template v-if="isReady">
      <PgSection
        v-for="group in visibleGroups"
        :id="`cells-${group.id}`"
        :key="group.id"
        :title="group.title"
        :description="group.description"
      >
        <div class="rounded-xl border-1 border-nc-border-gray-medium overflow-hidden">
          <div class="pg-cells-grid bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-medium">
            <div class="px-3 py-2 text-captionSmBold text-nc-content-gray-subtle">Field</div>
            <NcTooltip v-for="m in modes" :key="m.key" :title="m.hint" class="px-3 py-2" :arrow="false">
              <span class="text-captionSmBold text-nc-content-gray-subtle">{{ m.label }}</span>
            </NcTooltip>
          </div>
          <div
            v-for="fixture in group.fixtures"
            :key="fixture.column.id"
            class="pg-cells-grid border-b-1 border-nc-border-gray-light last:border-b-0"
            :data-testid="`pg-cell-${fixture.column.id}`"
          >
            <div class="px-3 py-2 min-w-0 flex flex-col justify-center gap-0.5">
              <LazySmartsheetHeaderVirtualCell
                v-if="isVirtualCol(fixture.column)"
                :column="fixture.column"
                hide-menu
                class="h-6"
              />
              <LazySmartsheetHeaderCell v-else :column="fixture.column" hide-menu class="h-6" />
              <div class="flex items-center gap-1.5 text-captionXs text-nc-content-gray-muted">
                <code class="font-mono">{{ fixture.column.uidt }}</code>
                <NcBadge v-if="fixture.displayOnly" color="orange" :border="false" class="!h-4 !text-captionXs">
                  needs backend
                </NcBadge>
              </div>
              <div v-if="fixture.note" class="text-captionXs text-nc-content-gray-muted">{{ fixture.note }}</div>
            </div>
            <div v-for="m in modes" :key="m.key" class="px-2 py-2 min-w-0 flex items-center">
              <CellSlot :column="fixture.column" :row="row" :mode="m.key" :read-only="isReadOnly" />
            </div>
          </div>
        </div>
      </PgSection>

      <div v-if="!visibleGroups.length" class="py-16 text-center text-caption text-nc-content-gray-muted">
        No field matches “{{ search }}”
      </div>
    </template>
  </PgPage>
</template>

<style scoped lang="scss">
.pg-cells-grid {
  display: grid;
  /* the expanded form gives fields the most room */
  grid-template-columns: 252px repeat(2, minmax(0, 1fr)) minmax(0, 1.3fr);
  align-items: stretch;
}
</style>
