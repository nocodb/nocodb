<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const SIZES = ['small', 'middle', 'large'] as const

const FIELD_TYPES = ['Single line text', 'Long text', 'Number', 'Currency', 'Date', 'Checkbox', 'Attachment', 'Links']

const fieldType = ref('Single line text')

const tags = ref<string[]>(['Marketing', 'Q4'])

const owner = ref<string>()

const viewMode = ref('grid')

const sortOrder = ref('asc')

// NcSelectTab runs `title` through $t
const VIEW_ITEMS = [
  { icon: 'grid', title: 'objects.viewType.grid', value: 'grid' },
  { icon: 'gallery', title: 'objects.viewType.gallery', value: 'gallery' },
  { icon: 'kanban', title: 'objects.viewType.kanban', value: 'kanban' },
  { icon: 'calendar', title: 'objects.viewType.calendar', value: 'calendar' },
] as const

const SORT_ITEMS = [
  { label: 'First → Last', value: 'asc' },
  { label: 'Last → First', value: 'desc' },
]
</script>

<template>
  <PgSection id="selects" title="Selects" source="NcSelect · NcSelectTab · NcDropdownSelect">
    <!-- auto-fill: NcSelectTab doesn't shrink, so a card needs ~400px; the token editor narrows the page -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-3">
      <PgDemo label="NcSelect sizes">
        <div class="flex flex-col gap-3">
          <div v-for="size in SIZES" :key="size" class="flex items-center gap-3">
            <span class="w-14 text-captionXs text-nc-content-gray-muted font-mono">{{ size }}</span>
            <NcSelect v-model:value="fieldType" :size="size" class="flex-1">
              <a-select-option v-for="t in FIELD_TYPES" :key="t" :value="t">{{ t }}</a-select-option>
            </NcSelect>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcSelect variants">
        <div class="flex flex-col gap-3">
          <NcSelect v-model:value="tags" mode="tags" placeholder="Add tags" class="w-full">
            <a-select-option v-for="t in ['Marketing', 'Q4', 'Launch', 'Paid', 'Organic']" :key="t" :value="t">{{
              t
            }}</a-select-option>
          </NcSelect>
          <NcSelect v-model:value="owner" show-search allow-clear placeholder="Search a teammate" class="w-full">
            <a-select-option v-for="n in ['Priya Raman', 'Lucas Meyer', 'Aiko Tanaka', 'Omar Haddad']" :key="n" :value="n">
              {{ n }}
            </a-select-option>
          </NcSelect>
          <NcSelect value="Loading options" loading class="w-full" />
          <NcSelect value="Disabled" disabled class="w-full" />
        </div>
      </PgDemo>

      <PgDemo label="NcSelectTab" hint="segmented icon tabs">
        <div class="flex flex-col gap-3 items-start">
          <NcSelectTab v-model="viewMode" :items="[...VIEW_ITEMS]" />
          <NcSelectTab v-model="viewMode" :items="[...VIEW_ITEMS]" disabled tooltip="Locked view" />
          <span class="text-captionSm text-nc-content-gray-muted">Selected: {{ viewMode }}</span>
        </div>
      </PgDemo>

      <PgDemo label="NcDropdownSelect">
        <div class="flex items-center gap-3">
          <!-- the overlay sizes to its content, so callers give it a width (as in the attachments presenter) -->
          <NcDropdownSelect v-model="sortOrder" :items="SORT_ITEMS" overlay-class-name="w-48">
            <NcButton size="small" type="secondary">
              <div class="flex items-center gap-2">
                {{ SORT_ITEMS.find((i) => i.value === sortOrder)?.label }}
                <GeneralIcon icon="chevronDown" class="w-4 h-4 text-nc-content-gray-muted" />
              </div>
            </NcButton>
          </NcDropdownSelect>
          <NcDropdownSelect
            v-model="sortOrder"
            :items="SORT_ITEMS"
            disabled
            tooltip="Sorting is locked"
            overlay-class-name="w-48"
          >
            <NcButton size="small" type="secondary">
              <div class="flex items-center gap-2">
                Disabled
                <GeneralIcon icon="chevronDown" class="w-4 h-4" />
              </div>
            </NcButton>
          </NcDropdownSelect>
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>
