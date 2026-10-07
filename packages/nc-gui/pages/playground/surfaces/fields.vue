<script setup lang="ts">
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { ColumnType, TableType } from 'nocodb-sdk'
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'
import PgDemo from '../-components/PgDemo.vue'
import { COL } from '../views/-helper/mock-data'
import SurfaceHarness from './-components/SurfaceHarness.vue'
import PopupStage from './-components/PopupStage.vue'
import { installSurfaceMocks, surfaceRoute } from './-helper/mocks'

definePageMeta({
  path: '/playground/surfaces/fields/:baseId(views)?/:viewId(grid)?/:slugs([^/]+)*',
  middleware: [
    (to) => {
      const target = surfaceRoute('fields')
      if (to.path !== target) return navigateTo(target, { replace: true })
      installSurfaceMocks()
    },
  ],
})

interface EditorDemo {
  key: string
  label: string
  hint: string
  /** edit an existing mock column */
  columnId?: string
  /** or open the "add field" editor preloaded with this (form state, so colOptions keys sit flat) */
  preload?: Partial<ColumnType> & Record<string, unknown>
  /** links / lookup / formula editors are wider than a half-width card */
  wide?: boolean
  height?: number
}

const sections = [
  { id: 'editor', title: 'Field editor' },
  { id: 'add-field', title: 'Add field · any type' },
  { id: 'column-menu', title: 'Column menu' },
  { id: 'headers', title: 'Header cells' },
]

const editors: EditorDemo[] = [
  { key: 'text', label: 'Single line text', hint: 'edit · Launch', columnId: COL.title },
  { key: 'number', label: 'Number', hint: 'edit · Effort (pts)', columnId: COL.effort },
  { key: 'select', label: 'Single select', hint: 'edit · Status, 5 options', columnId: COL.status, height: 580 },
  { key: 'date', label: 'Date', hint: 'edit · Launch date', columnId: COL.launch, height: 580 },
  { key: 'links', label: 'Links', hint: 'edit · Tasks (has many)', columnId: COL.tasks, wide: true, height: 700 },
  {
    key: 'formula',
    label: 'Formula',
    hint: 'add · preloaded expression',
    preload: { uidt: UITypes.Formula, title: 'Days to launch', formula_raw: 'DATETIME_DIFF({Launch date}, NOW(), "days")' },
    wide: true,
    height: 660,
  },
  {
    key: 'lookup',
    label: 'Lookup',
    hint: 'add · Task title through Tasks',
    preload: { uidt: UITypes.Lookup, title: 'Task names', fk_relation_column_id: COL.tasks, fk_lookup_column_id: 'pgt-title' },
    wide: true,
    height: 520,
  },
]

const addTypes = [
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Checkbox,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Duration,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.Attachment,
  UITypes.User,
  UITypes.Links,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Formula,
  UITypes.Barcode,
  UITypes.QrCode,
  UITypes.Button,
  UITypes.JSON,
  UITypes.GeoData,
]

const addType = ref<UITypes>(UITypes.SingleSelect)

// bumped on save/cancel so the editor remounts with a clean form
const resetKeys = ref<Record<string, number>>({})

const savedNote = ref<Record<string, string>>({})

const menuColumnId = ref<string>(COL.status)

const editingFromMenu = ref<string | null>(null)

function headerColumnIds(meta: TableType) {
  return (meta.columns ?? []).filter((c) => !c.system && c.uidt !== UITypes.ID).map((c) => c.id!)
}

function columnOf(meta: TableType, id: string) {
  return meta.columns?.find((c) => c.id === id)
}

function reset(key: string, note?: string) {
  resetKeys.value[key] = (resetKeys.value[key] ?? 0) + 1
  if (note) savedNote.value[key] = note
}
</script>

<template>
  <PgPage
    title="Field editor & column menu"
    description="The real field editor (SmartsheetColumnEditOrAdd) and column header menu against the mock “Product launches” table. Saving updates the in-memory table meta — nothing reaches the backend."
    :sections="sections"
  >
    <SurfaceHarness v-slot="{ meta }">
      <PgSection
        id="editor"
        title="Field editor"
        source="SmartsheetColumnEditOrAddProvider"
        description="One editor per field type. Edit cards open an existing column; Formula and Lookup open the add-field flow preloaded."
      >
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PgDemo
            v-for="demo in editors"
            :key="demo.key"
            :label="demo.label"
            :hint="savedNote[demo.key] ?? demo.hint"
            stage="canvas"
            :class="{ 'lg:col-span-2': demo.wide }"
          >
            <PopupStage :height="demo.height ?? 460">
              <div :class="demo.wide ? 'max-w-[640px]' : 'max-w-[440px]'">
                <SmartsheetColumnEditOrAddProvider
                  :key="`${demo.key}-${resetKeys[demo.key] ?? 0}`"
                  :column="demo.columnId ? columnOf(meta, demo.columnId) : undefined"
                  :preload="demo.preload"
                  disable-title-focus
                  class="w-full"
                  @submit="reset(demo.key, 'saved to the mock table')"
                  @cancel="reset(demo.key)"
                />
              </div>
            </PopupStage>
          </PgDemo>
        </div>
      </PgSection>

      <PgSection
        id="add-field"
        title="Add field · any type"
        source="SmartsheetColumnEditOrAddProvider"
        description="The add-field editor preloaded with the picked type. The type select inside the editor is live too."
      >
        <PgDemo label="New field" :hint="savedNote.add" stage="canvas">
          <template #actions>
            <NcSelect v-model:value="addType" size="small" class="w-48" show-search>
              <a-select-option v-for="t in addTypes" :key="t" :value="t">{{ t }}</a-select-option>
            </NcSelect>
          </template>
          <PopupStage :height="560">
            <div class="max-w-[520px]">
              <SmartsheetColumnEditOrAddProvider
                :key="`add-${addType}-${resetKeys.add ?? 0}`"
                :preload="{ uidt: addType }"
                disable-title-focus
                class="w-full"
                @submit="reset('add', 'field added — see the header cells below')"
                @cancel="reset('add')"
              />
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>

      <PgSection
        id="column-menu"
        title="Column menu"
        source="SmartsheetHeaderColumnMenu"
        description="The header ▾ menu, rendered open. “Edit field” opens the editor beside it; sort / filter / group items write to the mock toolbar store."
      >
        <PgDemo label="Column menu" stage="canvas">
          <template #actions>
            <NcSelect v-model:value="menuColumnId" size="small" class="w-48" @change="editingFromMenu = null">
              <a-select-option v-for="c in meta.columns?.filter((c) => !c.system)" :key="c.id" :value="c.id">
                {{ c.title }}
              </a-select-option>
            </NcSelect>
          </template>
          <PopupStage :height="620">
            <div v-if="columnOf(meta, menuColumnId)" class="flex items-start gap-4">
              <!-- dropdown overlay classes so the menu gets its in-dropdown density -->
              <div
                class="ant-dropdown nc-dropdown nc-dropdown-column-operations !static flex-none rounded-lg border-1 border-nc-border-gray-medium shadow-lg bg-nc-bg-default overflow-hidden"
              >
                <SmartsheetHeaderColumnMenu
                  :key="menuColumnId"
                  :is-open="true"
                  :column="columnOf(meta, menuColumnId)!"
                  :virtual="isVirtualCol(columnOf(meta, menuColumnId)!)"
                  @edit="editingFromMenu = menuColumnId"
                />
              </div>
              <div v-if="editingFromMenu" class="w-[440px]">
                <SmartsheetColumnEditOrAddProvider
                  :key="`menu-${editingFromMenu}`"
                  :column="columnOf(meta, editingFromMenu)"
                  class="w-full"
                  @submit="editingFromMenu = null"
                  @cancel="editingFromMenu = null"
                />
              </div>
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>

      <PgSection
        id="headers"
        title="Header cells"
        source="SmartsheetHeaderCell · SmartsheetHeaderVirtualCell"
        description="Grid header cells with their live ▾ menu — click one to open the column menu, then Edit to get the editor dropdown."
      >
        <PgDemo label="Headers" stage="canvas">
          <PopupStage :height="560">
            <div class="flex rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default overflow-x-auto w-fit max-w-full">
              <div
                v-for="id in headerColumnIds(meta)"
                :key="id"
                class="w-44 h-8 px-2 flex items-center border-r-1 border-nc-border-gray-light last:border-r-0"
              >
                <template v-if="columnOf(meta, id)">
                  <LazySmartsheetHeaderVirtualCell
                    v-if="isVirtualCol(columnOf(meta, id)!)"
                    :column="columnOf(meta, id)!"
                    class="w-full"
                  />
                  <LazySmartsheetHeaderCell v-else :column="columnOf(meta, id)!" class="w-full" />
                </template>
              </div>
            </div>
          </PopupStage>
        </PgDemo>
      </PgSection>
    </SurfaceHarness>
  </PgPage>
</template>
