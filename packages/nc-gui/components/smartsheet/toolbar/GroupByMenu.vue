<script setup lang="ts">
import { type ColumnType, UITypes, isVirtualCol } from 'nocodb-sdk'
import MdiFormatListGroup from '~icons/mdi/format-list-group'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  getSortDirectionOptions,
  iconMap,
  inject,
  ref,
  useMenuCloseOnEsc,
  useSmartsheetStoreOrThrow,
} from '#imports'

const primaryGroupingUidt = [UITypes.SingleSelect, UITypes.MultiSelect]
const secondaryGroupingUidt = [UITypes.SingleLineText, UITypes.Date, UITypes.Number]

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const isLocked = inject(IsLockedInj, ref(false))
const reloadDataHook = inject(ReloadViewDataHookInj)

const { groupBy } = useViewGroupBy(view, undefined, () => reloadDataHook?.trigger())

const { eventBus } = useSmartsheetStoreOrThrow()

const { isMobileMode } = useGlobal()

const showAllFields = ref(false)

const addMode = ref(false)

const possibleFieldCount = computed(() => {
  const fields = meta.value?.columns || []

  return fields.filter((field) => {
    if (groupBy.value.find((el) => el.id === field.id)) return false
    return primaryGroupingUidt.includes(field.uidt as UITypes) || secondaryGroupingUidt.includes(field.uidt as UITypes)
  }).length
})

const fieldsToGroupBy = computed(() => {
  const fields = meta.value?.columns || []

  return fields.filter((field) => {
    if (groupBy.value.find((el) => el.id === field.id)) return false
    return (
      primaryGroupingUidt.includes(field.uidt as UITypes) ||
      (showAllFields.value && secondaryGroupingUidt.includes(field.uidt as UITypes))
    )
  })
})

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD) {
    // loadgroupBy()
  }
})

const columns = computed(() => meta.value?.columns || [])

const columnByID = computed(() =>
  columns.value.reduce((obj, col) => {
    obj[col.id!] = col

    return obj
  }, {} as Record<string, ColumnType>),
)

const getColumnUidtByID = (key?: string) => {
  if (!key) return ''
  return columnByID.value[key]?.uidt || ''
}

const open = ref(false)

useMenuCloseOnEsc(open)

watch(open, () => {
  if (open.value) {
    showAllFields.value = false
    addMode.value = false
  }
})

const enableAddMode = () => {
  if (fieldsToGroupBy.value.length === 0) {
    showAllFields.value = true
  }
  addMode.value = true
}

const addFieldToGroupBy = (field: ColumnType) => {
  groupBy.value.push(field)
  addMode.value = false
  open.value = false
}
</script>

<template>
  <a-dropdown v-model:visible="open" offset-y class="" :trigger="['click']" overlay-class-name="nc-dropdown-group-by-menu">
    <div :class="{ 'nc-badge nc-active-btn': groupBy?.length }">
      <a-button v-e="['c:group-by']" class="nc-group-by-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-2">
          <MdiFormatListGroup class="h-4 w-4" />

          <!-- Group By -->
          <span v-if="!isMobileMode" class="text-capitalize !text-sm font-medium">Group By</span>

          <span v-if="groupBy?.length" class="nc-count-badge">{{ groupBy.length }}</span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        class="flex flex-col bg-white shadow-lg rounded-md overflow-auto border-1 border-gray-50 menu-filter-dropdown max-h-[max(80vh,500px)]"
        data-testid="nc-group-by-menu"
      >
        <div v-if="groupBy?.length && !addMode" class="group-by-grid mb-2 max-h-420px overflow-y-auto flex flex-col" @click.stop>
          <div
            v-for="field of groupBy"
            :key="`grouped-by-${field.id}`"
            class="flex items-center py-2 px-2 cursor-pointer bg-slate-50"
          >
            <component
              :is="iconMap.closeBox"
              ref="removeIcon"
              class="nc-group-by-item-remove-btn text-grey self-center"
              small
              @click.stop="groupBy.splice(groupBy.indexOf(field), 1)"
            />
            <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(field)" :column-meta="field" />
            <SmartsheetHeaderCellIcon v-else :column-meta="field" />
            <span>{{ field.title }}</span>
          </div>

          <a-button
            v-if="possibleFieldCount > groupBy.length"
            class="text-capitalize mb-1 mt-2 mx-2 text-sm"
            type="primary"
            ghost
            @click.stop="enableAddMode()"
          >
            <div class="flex gap-1 items-center">Add subgroup</div>
          </a-button>
        </div>

        <template v-else>
          <div class="group-by-field-selector flex flex-col">
            <div class="!text-xs text-gray-300 p-2 pb-0">Pick a field to group by</div>
            <a-menu-divider class="my-1" />
            <div
              v-for="field of fieldsToGroupBy"
              :key="`group-by-${field.id}`"
              class="flex items-center py-1 px-2 cursor-pointer hover:bg-slate-50"
              @click="addFieldToGroupBy(field)"
            >
              <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(field)" :column-meta="field" />
              <SmartsheetHeaderCellIcon v-else :column-meta="field" />
              <span>{{ field.title }}</span>
            </div>
          </div>

          <a-button
            v-if="!showAllFields"
            class="text-capitalize mb-1 mt-2 mx-2 text-sm"
            type="primary"
            ghost
            @click.stop="showAllFields = true"
          >
            <div class="flex gap-1 items-center">Show all fields</div>
          </a-button>
        </template>
      </div>
    </template>
  </a-dropdown>
</template>
