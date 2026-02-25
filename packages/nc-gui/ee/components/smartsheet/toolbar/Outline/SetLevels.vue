<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType, OutlineViewLevelType, TableType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { eventBus } = useSmartsheetStoreOrThrow()

const { levels, saveLevelConfiguration, showEmptyParents, updateViewMeta, isLoading } = useOutlineViewStoreOrThrow()

const open = ref(false)

useMenuCloseOnEsc(open)

const localLevels = ref<Partial<OutlineViewLevelType>[]>([])

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
    if (colOptions.type !== RelationTypes.HAS_MANY) return false
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
}

function removeLevel(arrayIndex: number) {
  if (arrayIndex === 0) return
  localLevels.value.splice(arrayIndex, 1)
  localLevels.value.forEach((l, i) => {
    l.level = i
  })
}

async function save() {
  if (isLocked.value) return

  try {
    const cleanedLevels = localLevels.value.map((l) => {
      const clean: Partial<OutlineViewLevelType> = {
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
      levels: cleanedLevels as OutlineViewLevelType[],
    })

    await nextTick()

    if (levels.value.length > 0) {
      localLevels.value = levels.value.map((l) => ({ ...l }))
    }

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
    eventBus.emit(SmartsheetStoreEvents.FILTER_RELOAD)
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function toggleHideEmptySections(val: boolean) {
  if (isLocked.value) return
  await updateViewMeta({ show_empty_parents: !val })
}

const hideEmptySections = computed({
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
</script>

<template>
  <NcDropdown
    v-if="!isPublic"
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-outline-set-levels-menu overflow-hidden"
    class="!xs:hidden"
  >
    <NcTooltip :disabled="!isToolbarIconMode" class="nc-outline-set-levels-btn">
      <template #title>
        {{ $t('title.setLevels') }}
      </template>

      <NcButton
        v-e="['c:outline:set-levels']"
        class="nc-outline-set-levels-menu-btn nc-toolbar-btn !border-0 !h-7 group"
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
      <div v-if="open" class="p-4 w-96 bg-nc-bg-default nc-table-toolbar-menu rounded-lg flex flex-col gap-4" @click.stop>
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
        <div class="flex flex-col">
          <template v-for="(arrIdx, displayIdx) in displayOrder" :key="arrIdx">
            <div class="flex flex-col gap-2 p-3 rounded-lg border border-nc-border-gray-medium">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-nc-content-gray-muted uppercase tracking-wide">
                  {{ $t('general.levelN', { n: arrIdx + 1 }) }}
                </span>
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
                  class="!text-nc-content-gray-muted hover:!text-nc-content-red-dark"
                  :disabled="isLocked"
                  @click="removeLevel(arrIdx)"
                >
                  <GeneralIcon icon="close" class="w-3.5 h-3.5" />
                </NcButton>
              </div>

              <!-- Table selection -->
              <NcListTableSelector
                disable-label
                :value="localLevels[arrIdx].fk_model_id"
                :disabled="isLocked || arrIdx === 0"
                :filter-table="filterTableForLevel(arrIdx)"
                @update:value="(val) => onTableSelect(arrIdx, val)"
              />
            </div>

            <!-- Link connector between levels (dashed line + link field selector) -->
            <div v-if="displayIdx < displayOrder.length - 1" class="nc-level-connector flex items-stretch ml-7">
              <div class="w-0 border-l-2 border-dashed border-nc-border-gray-medium" />
              <div class="py-2 pl-4 flex-1">
                <NcListColumnSelector
                  disable-label
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
            </div>
          </template>
        </div>

        <!-- Enable nested records (for root level) -->
        <!--
        <template v-if="localLevels.length > 0">
          <div class="flex items-center gap-1">
            <NcSwitch v-model:checked="enableNestedRecords" size="small" class="nc-switch" :disabled="isLocked">
              <div class="text-sm text-nc-content-gray">
                {{ $t('labels.enableNestedRecords') || 'Enable nested records' }}
              </div>
            </NcSwitch>
          </div>

          <div v-if="enableNestedRecords" class="nc-level-connector flex items-stretch ml-7">
            <div class="w-0 border-l-2 border-dashed border-nc-border-gray-medium" />
            <div class="py-2 pl-4 flex-1">
              <NcListColumnSelector
                disable-label
                :table-id="localLevels[0]?.fk_model_id"
                :value="localLevels[0]?.fk_self_link_column_id"
                :disabled="isLocked"
                :filter-column="filterSelfLinkColumn"
                @update:value="(val) => { if (localLevels[0]) localLevels[0].fk_self_link_column_id = val }"
              />
            </div>
          </div>
        </template>
        -->

        <!-- Save button (visible when dirty) -->
        <NcButton
          v-if="isDirty"
          type="primary"
          size="small"
          class="w-full"
          :loading="isLoading"
          :disabled="isLocked || !isConfigValid"
          @click="save"
        >
          {{ $t('general.save') || 'Save' }}
        </NcButton>

        <!--        <div class="flex items-center gap-1 pt-1">
          <NcSwitch v-model:checked="hideEmptySections" size="small" class="nc-switch" :disabled="isLocked">
            <div class="text-sm text-nc-content-gray">
              {{ $t('labels.hideEmptySections') || 'Hide empty sections' }}
            </div>
          </NcSwitch>
        </div> -->

        <GeneralLockedViewFooter v-if="isLocked" class="-mb-4 -mx-4" @on-open="open = false" />
      </div>
    </template>
  </NcDropdown>
</template>
