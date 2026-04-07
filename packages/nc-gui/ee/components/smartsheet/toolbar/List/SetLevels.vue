<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType, ListViewLevelType, TableType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { $e } = useNuxtApp()

const { eventBus } = useSmartsheetStoreOrThrow()

const { levels, saveLevelConfiguration, showEmptyParents, updateViewMeta } = useListViewStoreOrThrow()

const open = ref(false)

const isLoading = ref(false)

useMenuCloseOnEsc(open)

const localLevels = ref<Partial<ListViewLevelType>[]>([])

watch(open, (val) => {
  if (val) {
    if (levels.value.length > 0) {
      localLevels.value = levels.value.map((l) => ({ ...l }))
    } else {
      localLevels.value = [{ level: 0, fk_model_id: meta.value?.id }]
    }
  }
})

const displayOrder = computed(() => {
  return localLevels.value.map((_, i) => i).reverse()
})

const canAddLevel = computed(() => {
  if (localLevels.value.length >= 3) return false
  if (localLevels.value.length === 0) return true

  return localLevels.value.every((level, idx) => {
    if (!level.fk_model_id) return false
    return !(idx > 0 && !level.fk_link_column_id)
  })
})

function filterTableForLevel(arrayIndex: number): (table: TableType) => boolean {
  return (table: TableType) => {
    const sourceId = meta.value?.source_id
    if (sourceId && table.source_id !== sourceId) return false

    const usedTableIds = new Set(
      localLevels.value
        .filter((_, i) => i !== arrayIndex)
        .map((l) => l.fk_model_id)
        .filter(Boolean),
    )
    return !usedTableIds.has(table.id!)
  }
}

// Filter: only HM link columns pointing to the target table (level below)
function filterLinkColumnForLevel(targetTableId: string | undefined) {
  return (c: ColumnType) => {
    if (!isLinksOrLTAR(c) || c.system) return false
    const colOptions = c.colOptions as LinkToAnotherRecordType | undefined
    if (!colOptions) return false
    if (colOptions.type !== RelationTypes.HAS_MANY && colOptions.type !== RelationTypes.ONE_TO_MANY) return false
    if (targetTableId && colOptions.fk_related_model_id !== targetTableId) return false
    return true
  }
}

function onTableSelect(arrayIndex: number, tableId: string | null | undefined) {
  if (!tableId) return
  localLevels.value[arrayIndex].fk_model_id = tableId
  localLevels.value[arrayIndex].fk_link_column_id = undefined
}

function addLevel() {
  if (!canAddLevel.value) return
  localLevels.value.push({ level: localLevels.value.length })
  $e('c:list:set-levels:add-level')
}

function removeLevel(arrayIndex: number) {
  if (arrayIndex === 0) return
  localLevels.value.splice(arrayIndex, 1)
  localLevels.value.forEach((l, i) => {
    l.level = i
  })
  $e('c:list:set-levels:remove-level')
}

async function save() {
  if (isLocked.value) return

  isLoading.value = true

  try {
    const cleanedLevels = localLevels.value.map((l) => {
      const clean: Partial<ListViewLevelType> = {
        level: l.level,
        fk_model_id: l.fk_model_id,
      }
      if (l.fk_link_column_id) clean.fk_link_column_id = l.fk_link_column_id
      if (l.fk_self_link_column_id) clean.fk_self_link_column_id = l.fk_self_link_column_id
      if (l.wrap_headers != null) clean.wrap_headers = l.wrap_headers
      if (l.enable_nested_records != null) clean.enable_nested_records = l.enable_nested_records
      return clean
    })

    await saveLevelConfiguration({
      levels: cleanedLevels as ListViewLevelType[],
    })

    await nextTick()

    if (levels.value.length > 0) {
      localLevels.value = levels.value.map((l) => ({ ...l }))
    }

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
    eventBus.emit(SmartsheetStoreEvents.FILTER_RELOAD)

    $e('a:list:set-levels:save', { levelCount: cleanedLevels.length })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

async function toggleHideEmptySections(val: boolean) {
  if (isLocked.value) return
  await updateViewMeta({ show_empty_parents: !val })
  $e('c:list:toggle-hide-empty-sections', { enabled: val })
}

const _hideEmptySections = computed({
  get: () => !showEmptyParents.value,
  set: (val: boolean) => {
    toggleHideEmptySections(val)
  },
})

const isConfigValid = computed(() => {
  if (localLevels.value.length === 0) return false
  return localLevels.value.every((level, idx) => {
    if (!level.fk_model_id) return false
    if (idx > 0 && !level.fk_link_column_id) return false
    return true
  })
})

const isDirty = computed(() => {
  return JSON.stringify(localLevels.value) !== JSON.stringify(levels.value.map((l) => ({ ...l })))
})

// Auto-save when config is valid and dirty
const debouncedSave = useDebounceFn(() => {
  if (isDirty.value && isConfigValid.value && !isLoading.value) {
    save()
  }
}, 500)

watch(
  () => JSON.stringify(localLevels.value),
  () => {
    if (isDirty.value && isConfigValid.value) {
      debouncedSave()
    }
  },
)
</script>

<template>
  <NcDropdown
    v-if="!isPublic"
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-list-set-levels-menu overflow-hidden"
  >
    <NcTooltip :disabled="!isToolbarIconMode" class="nc-list-set-levels-btn">
      <template #title>
        {{ $t('title.setLevels') }}
      </template>

      <NcButton
        v-e="['c:list:set-levels']"
        class="nc-list-set-levels-menu-btn nc-toolbar-btn !border-0 !h-7 group"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="layers" class="h-4 w-4" />
          <div v-if="!isToolbarIconMode" class="flex items-center gap-0.5">
            <span class="text-capitalize !text-[13px] font-medium">
              {{ $t('title.setLevels') }}
            </span>
            <div
              v-if="levels.length > 0"
              class="flex items-center rounded-md transition-colors duration-0.3s bg-nc-bg-gray-light px-1 min-h-5"
              :class="{
                'group-hover:bg-nc-bg-gray-medium': !isLocked,
              }"
            >
              <span class="!text-[13px] font-medium !leading-5">{{ levels.length }}</span>
            </div>
          </div>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        v-if="open"
        class="p-4 w-[min(98dvw,480px)] bg-nc-bg-default nc-table-toolbar-menu rounded-lg flex flex-col gap-3"
        @click.stop
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-nc-content-gray">
            {{ $t('title.levels') }}
          </span>
          <NcButton
            v-if="localLevels.length < 3"
            type="text"
            size="xs"
            class="!text-nc-content-gray-subtle !text-xs"
            :disabled="isLocked"
            @click="addLevel"
          >
            <div
              :class="{
                'text-nc-content-gray-disabled': isLocked || !canAddLevel,
              }"
              class="flex items-center gap-1"
            >
              <GeneralIcon icon="plus" class="w-3.5 h-3.5" />
              <span>{{ $t('general.addLevelAbove') }}</span>
            </div>
          </NcButton>
        </div>

        <div class="border-t border-nc-border-gray-medium" />

        <!-- Compact level rows -->
        <div class="flex flex-col gap-1.5">
          <template v-for="arrIdx in displayOrder" :key="arrIdx">
            <div
              class="nc-level-row flex items-center gap-2 rounded-lg px-2 py-1.5"
              :class="arrIdx === 0 ? 'bg-nc-bg-gray-light' : 'hover:bg-nc-bg-gray-light'"
            >
              <!-- Level label -->
              <span class="text-[11px] font-semibold text-nc-content-gray-muted uppercase tracking-wide flex-none w-7">
                L{{ arrIdx + 1 }}
              </span>

              <!-- Table selector -->
              <div class="flex-1 min-w-0">
                <NcListTableSelector
                  disable-label
                  :value="localLevels[arrIdx].fk_model_id"
                  :disabled="isLocked || arrIdx === 0"
                  :filter-table="filterTableForLevel(arrIdx)"
                  dropdown-class="!rounded-md"
                  default-slot-wrapper-class="!py-1 !px-2 !min-h-7"
                  @update:value="(val) => onTableSelect(arrIdx, val)"
                />
              </div>

              <!-- Link field selector (only for non-leaf levels) -->
              <template v-if="arrIdx > 0">
                <GeneralIcon icon="ncArrowRight" class="flex-none h-3.5 w-3.5 text-nc-content-gray-muted" />
                <div class="flex-1 min-w-0">
                  <NcListColumnSelector
                    disable-label
                    auto-select
                    :table-id="localLevels[arrIdx]?.fk_model_id"
                    :value="localLevels[arrIdx].fk_link_column_id"
                    :disabled="isLocked || !localLevels[arrIdx]?.fk_model_id || !localLevels[arrIdx - 1]?.fk_model_id"
                    :filter-column="filterLinkColumnForLevel(localLevels[arrIdx - 1]?.fk_model_id)"
                    @update:value="
                      (val) => {
                        localLevels[arrIdx].fk_link_column_id = val
                      }
                    "
                  />
                </div>
              </template>

              <!-- Remove button / info icon -->
              <div class="flex-none w-5 flex items-center justify-center">
                <NcTooltip v-if="arrIdx === 0">
                  <template #title>
                    {{ $t('tooltip.levelOneTable') }}
                  </template>
                  <GeneralIcon icon="info" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
                </NcTooltip>
                <NcButton
                  v-else
                  type="text"
                  size="xxs"
                  class="!text-nc-content-gray-muted hover:!text-nc-content-red-dark !w-5 !h-5 !min-w-0"
                  :disabled="isLocked"
                  @click="removeLevel(arrIdx)"
                >
                  <GeneralIcon icon="close" class="w-3.5 h-3.5" />
                </NcButton>
              </div>
            </div>
          </template>
        </div>

        <GeneralLockedViewFooter v-if="isLocked" class="-mb-4 -mx-4" @on-open="open = false" />
      </div>
    </template>
  </NcDropdown>
</template>
