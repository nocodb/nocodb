<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'

const { metas, getMeta } = useMetas()

const column = inject(ColumnInj, ref())

const row = inject(RowInj)!

const cellValue = inject(CellValueInj, ref())

const isGroupByLabel = inject(IsGroupByLabelInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const cellClickHook = inject(CellClickHookInj, null)

const onDivDataCellEventHook = inject(OnDivDataCellEventHookInj, null)

const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const clientMousePosition = inject(ClientMousePositionInj, reactive(clientMousePositionDefaultValue))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))

const cellEventHook = inject(CellEventHookInj, null)

// Change the row height of the child cell under lookup
// Other wise things like text will can take multi line tag
const providedHeightRef = ref(1) as any

const rowHeight = inject(RowHeightInj, ref(1) as any)

provide(RowHeightInj, providedHeightRef)

const relationColumn = computed(() => {
  if (column.value?.fk_model_id) {
    return metas.value[column.value.fk_model_id]?.columns?.find(
      (c: ColumnType) => c.id === (column.value?.colOptions as LookupType)?.fk_relation_column_id,
    )
  }
  return undefined
})

watch(
  column,
  async (newColumn) => {
    if (!newColumn?.fk_model_id || metas.value[newColumn?.fk_model_id]) return
    await getMeta(newColumn.fk_model_id)
  },
  { immediate: true },
)

watch(
  relationColumn,
  async (relationCol: { colOptions: LinkToAnotherRecordType }) => {
    if (relationCol && relationCol.colOptions) await getMeta(relationCol.colOptions.fk_related_model_id!)
  },
  { immediate: true },
)

const lookupTableMeta = computed<Record<string, any> | undefined>(() => {
  if (relationColumn.value && relationColumn.value?.colOptions)
    return metas.value[relationColumn.value.colOptions.fk_related_model_id!]

  return undefined
})

const lookupColumn = computed(
  () =>
    lookupTableMeta.value?.columns?.find((c: any) => c.id === (column.value?.colOptions as LookupType)?.fk_lookup_column_id) as
      | ColumnType
      | undefined,
)

watch(
  [lookupColumn, rowHeight],
  () => {
    if (lookupColumn.value && !isAttachment(lookupColumn.value)) {
      providedHeightRef.value = 1
    } else {
      providedHeightRef.value = rowHeight.value
    }
  },
  {
    immediate: true,
  },
)

const arrValue = computed(() => {
  if (
    lookupColumn.value?.uidt === UITypes.Checkbox &&
    [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(relationColumn.value?.colOptions?.type)
  ) {
    const hasLink = !!(row && row.value?.row[relationColumn.value?.title])

    if (!cellValue.value && !hasLink) return []

    return (ncIsArray(cellValue.value) ? cellValue.value : [cellValue.value]).map(getCheckBoxValue)
  }

  if (!cellValue.value) return []

  // if lookup column is Attachment and relation type is Belongs/OneToOne to wrap the value in an array
  // since the attachment component expects an array or JSON string array
  if (lookupColumn.value?.uidt === UITypes.Attachment) {
    if ([RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(relationColumn.value?.colOptions?.type)) {
      return ncIsArray(cellValue.value) ? cellValue.value : [cellValue.value]
    }

    if (
      ncIsArray(cellValue.value) &&
      cellValue.value.every((v) => {
        if (ncIsNull(v)) return true

        if (ncIsArray(v)) {
          return !v.length || ncIsObject(v[0])
        }

        return false
      })
    ) {
      return cellValue.value
        .filter((v) => v !== null)
        .reduce((acc, v) => {
          acc.push(...v)

          return acc
        }, [])
    }
  }

  // TODO: We are filtering null as cell value can be null. Find the root cause and fix it
  if (Array.isArray(cellValue.value)) return cellValue.value.filter((v) => v !== null)

  return [cellValue.value]
})

provide(MetaInj, lookupTableMeta)

provide(IsUnderLookupInj, ref(true))

provide(CellUrlDisableOverlayInj, ref(true))

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()

const search = ref('')
const searchableUITypes = [
  UITypes.ID,
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Year,
  UITypes.PhoneNumber,
  UITypes.Email,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Rating,
  UITypes.Formula,
]
const isSearchable = computed(() => {
  if (!lookupColumn.value) return false
  return searchableUITypes.includes(lookupColumn.value.uidt! as UITypes)
})

const disableDropdown = computed(() => {
  if (!lookupColumn.value) return true
  if (arrValue.value.length < 2) return true
  return false
})

const filteredArrValues = computed(() => {
  return arrValue.value.filter((val) => {
    return searchCompare(val, search.value)
  })
})

const dropdownVisible = ref(false)

const triggerRef = ref<HTMLDivElement | null>(null)

const randomClass = `lookup-${Math.floor(Math.random() * 99999)}`

const cell = computed(() => triggerRef.value?.closest('td, .nc-data-cell'))

const dropdownOverlayRef = ref<HTMLInputElement | null>(null)
const active = inject(ActiveCellInj, ref(false))

function toggleDropdown(e: Event) {
  if (e.type !== 'click') return
  if (isExpandedForm.value || isForm.value || active.value) {
    dropdownVisible.value = !dropdownVisible.value
  }
}

const onCellEvent = (event?: Event) => {
  if (!(event instanceof KeyboardEvent) || !event.target || isActiveInputElementExist(event)) return

  if (isExpandCellKey(event)) {
    dropdownVisible.value = !dropdownVisible.value

    return true
  }
}

onMounted(() => {
  onClickOutside(cell.value, (e) => {
    if ((e.target as HTMLElement)?.closest(`.${randomClass}`)) return
    dropdownVisible.value = false
  })
  onDivDataCellEventHook?.on(toggleDropdown)
  cellClickHook?.on(toggleDropdown)
  cellEventHook?.on(onCellEvent)

  if (isUnderLookup.value || !isCanvasInjected || !clientMousePosition || isExpandedForm.value || !isGrid.value) return

  if (onCellEvent(canvasCellEventData.event)) return

  dropdownVisible.value = true
})

onUnmounted(() => {
  onDivDataCellEventHook?.off(toggleDropdown)
  cellClickHook?.off(toggleDropdown)
})

watch(dropdownVisible, (val) => {
  setTimeout(() => {
    if (val && dropdownOverlayRef.value)
      dropdownOverlayRef.value?.querySelector<HTMLInputElement>('.lookup-search-input input')?.focus()
  }, 200)
})

useSelectedCellKeydownListener(active, (e) => {
  switch (e.key) {
    case 'Enter':
      dropdownVisible.value = true
      e.stopPropagation()
      break
  }
})

const smartsheetCellClass = computed(() => {
  const isAttachmentColumn = isAttachment(lookupColumn.value!)
  return [
    `${
      [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User].includes(lookupColumn.value!.uidt! as UITypes)
        ? 'pl-2'
        : !isAttachmentColumn
        ? 'px-1'
        : ''
    }`,
    {
      'min-h-0 min-w-0': isAttachmentColumn,
      '!w-auto ': !isAttachmentColumn,
    },
  ]
})

const cellHeight = computed(() =>
  isGroupByLabel.value || (lookupColumn.value && isAttachment(lookupColumn.value))
    ? undefined
    : rowHeight.value
    ? `${rowHeight.value === 1 ? rowHeightInPx['1'] - 4 : rowHeightInPx[`${rowHeight.value}`] - (isGrid.value ? 17 : 0)}px`
    : `2.85rem`,
)

const handleCloseDropdown = (e: MouseEvent) => {
  if (e.target && e.target.closest('.nc-attachment-item')) {
    e.stopPropagation()
    dropdownVisible.value = false
  }
}

const badgedVirtualColumns = [UITypes.Rollup, UITypes.Formula]
const isBadgedVirtualColumn = computed(() => badgedVirtualColumns.includes(lookupColumn.value?.uidt as UITypes))

const extensionConfig = inject(ExtensionConfigInj, ref({ isPageDesignerPreviewPanel: false }))
const { getPossibleAttachmentSrc } = useAttachment()
const attachmentUrl = computed(() => getPossibleAttachmentSrc(arrValue.value[0])?.[0] ?? '')
</script>

<template>
  <img
    v-if="extensionConfig.isPageDesignerPreviewPanel && attachmentUrl"
    :src="attachmentUrl"
    class="object-contain h-full w-full"
  />
  <NcDropdown
    v-else
    :disabled="disableDropdown"
    :trigger="[]"
    :visible="!disableDropdown && dropdownVisible"
    :auto-close="false"
    :overlay-class-name="`!min-w-[300px] nc-links-dropdown ${dropdownVisible ? 'active' : ''}`"
  >
    <div
      ref="triggerRef"
      class="nc-cell-field h-full w-full nc-lookup-cell"
      tabindex="-1"
      :style="{
        height: cellHeight,
      }"
      @dblclick="activateShowEditNonEditableFieldWarning"
    >
      <div
        class="h-full w-full overflow-hidden"
        :class="{
          'nc-cell-lookup-scroll': rowHeight === 1,
          'flex gap-1': !(lookupColumn && isAttachment(lookupColumn) && arrValue[0] && ncIsObject(arrValue[0])),
        }"
        @click="handleCloseDropdown"
      >
        <template v-if="lookupColumn">
          <!-- Render virtual cell -->
          <div v-if="isVirtualCol(lookupColumn) && !isBadgedVirtualColumn" class="flex h-full virtual-lookup-cells">
            <!-- If non-belongs-to and non-one-to-one LTAR column then pass the array value, else iterate and render -->
            <template
              v-if="
                lookupColumn.uidt !== UITypes.LinkToAnotherRecord ||
                (lookupColumn.uidt === UITypes.LinkToAnotherRecord &&
                  [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(lookupColumn.colOptions.type))
              "
            >
              <LazySmartsheetVirtualCell
                v-for="(v, i) of arrValue"
                :key="i"
                :edit-enabled="false"
                :model-value="v"
                :column="lookupColumn"
                :read-only="true"
              />
            </template>

            <LazySmartsheetVirtualCell
              v-else
              :edit-enabled="false"
              :read-only="true"
              :model-value="arrValue"
              :column="lookupColumn"
            />
          </div>

          <!-- Render normal cell -->
          <template v-else>
            <div v-if="isAttachment(lookupColumn) && arrValue[0] && ncIsObject(arrValue[0])">
              <LazySmartsheetCell :model-value="arrValue" :column="lookupColumn" :edit-enabled="false" :read-only="true" />
            </div>
            <!-- For attachment cell avoid adding chip style -->
            <template v-else>
              <div
                class="max-h-full max-w-full w-full nc-cell-lookup-scroll !overflow-x-hidden"
                :class="{
                  'nc-scrollbar-thin ': rowHeight !== 1 && !isAttachment(lookupColumn),
                }"
              >
                <div
                  class="flex gap-1.5 w-full h-full"
                  :class="{
                    'flex-wrap': rowHeight !== 1 && !isAttachment(lookupColumn),
                    '!overflow-hidden nc-cell-lookup-scroll': rowHeight === 1 || isAttachment(lookupColumn),
                    'items-center': rowHeight === 1,
                    'items-start': rowHeight !== 1,
                    'py-[3px]': !isAttachment(lookupColumn),
                  }"
                >
                  <div
                    v-for="(v, i) of arrValue"
                    :key="i"
                    class="flex-none"
                    :class="{
                      'bg-nc-bg-default rounded-full': !isAttachment(lookupColumn),
                      'border-gray-200 rounded border-1 max-w-full': ![
                        UITypes.Attachment,
                        UITypes.MultiSelect,
                        UITypes.SingleSelect,
                        UITypes.User,
                        UITypes.CreatedBy,
                        UITypes.LastModifiedBy,
                      ].includes(lookupColumn.uidt),
                      'min-h-0 min-w-0': isAttachment(lookupColumn),
                    }"
                  >
                    <LazySmartsheetVirtualCell
                      v-if="lookupColumn.uidt === UITypes.Rollup"
                      :edit-enabled="false"
                      :read-only="true"
                      :model-value="v"
                      :column="lookupColumn"
                      class="px-2"
                    />
                    <LazySmartsheetCell
                      v-else
                      :model-value="v"
                      :column="lookupColumn"
                      :edit-enabled="false"
                      :virtual="true"
                      :read-only="true"
                      :class="smartsheetCellClass"
                    />
                  </div>
                </div>
                <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
                  {{ $t('msg.info.computedFieldEditWarning') }}
                </div>
                <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
                  {{ $t('msg.info.computedFieldDeleteWarning') }}
                </div>
              </div>
            </template>
          </template>
        </template>
      </div>
    </div>
    <template #overlay>
      <div
        v-if="lookupColumn"
        ref="dropdownOverlayRef"
        class="w-[300px] max-h-[320px] flex flex-col rounded-sm lookup-dropdown outline-none"
        :class="[randomClass]"
        tabindex="0"
        @keydown.esc="dropdownVisible = false"
      >
        <a-input v-if="isSearchable" v-model:value="search" :placeholder="$t('general.search')" class="lookup-search-input">
          <template #prefix>
            <GeneralIcon icon="search" class="text-nc-content-gray-muted" />
          </template>
        </a-input>
        <div class="flex flex-wrap gap-2 items-start overflow-y-auto px-3 py-2">
          <div
            v-if="search && !filteredArrValues.length"
            class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center"
          >
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              alt="No search results found"
            />

            {{ $t('title.noResultsMatchedYourSearch') }}
          </div>
          <template v-else-if="isVirtualCol(lookupColumn) && !isBadgedVirtualColumn">
            <!-- If non-belongs-to and non-one-to-one LTAR column then pass the array value, else iterate and render -->
            <template
              v-if="
                lookupColumn.uidt !== UITypes.LinkToAnotherRecord ||
                (lookupColumn.uidt === UITypes.LinkToAnotherRecord &&
                  [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(lookupColumn.colOptions.type))
              "
            >
              <LazySmartsheetVirtualCell
                v-for="(v, i) of filteredArrValues"
                :key="i"
                :edit-enabled="false"
                :model-value="v"
                :column="lookupColumn"
                :read-only="true"
              />
            </template>
          </template>
          <template v-else>
            <div
              v-if="isAttachment(lookupColumn) && arrValue[0] && ncIsObject(arrValue[0])"
              class="nc-lookup-attachment-wrapper"
              @click="handleCloseDropdown"
            >
              <LazySmartsheetCell :model-value="arrValue" :column="lookupColumn" :edit-enabled="false" :read-only="true" />
            </div>
            <!-- For attachment cell avoid adding chip style -->
            <template v-else>
              <div
                v-for="(v, i) of filteredArrValues"
                :key="i"
                class="flex-none"
                :class="{
                  'bg-nc-bg-default rounded-full': !isAttachment(lookupColumn),
                  'border-gray-200 rounded border-1 max-w-full': ![
                    UITypes.Attachment,
                    UITypes.MultiSelect,
                    UITypes.SingleSelect,
                    UITypes.User,
                    UITypes.CreatedBy,
                    UITypes.LastModifiedBy,
                  ].includes(lookupColumn.uidt),
                  'min-h-0 min-w-0': isAttachment(lookupColumn),
                }"
                @click="handleCloseDropdown"
              >
                <LazySmartsheetVirtualCell
                  v-if="lookupColumn.uidt === UITypes.Rollup"
                  :edit-enabled="false"
                  :read-only="true"
                  :model-value="v"
                  :column="lookupColumn"
                  class="px-2"
                />
                <LazySmartsheetCell
                  v-else
                  :model-value="v"
                  :column="lookupColumn"
                  :edit-enabled="false"
                  :virtual="true"
                  :read-only="true"
                  :class="smartsheetCellClass"
                />
              </div>
            </template>
          </template>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-cell-lookup-scroll {
  &::-webkit-scrollbar-thumb {
    @apply bg-transparent;
  }
}

.nc-cell-lookup-scroll:hover {
  &::-webkit-scrollbar-thumb {
    @apply bg-gray-200;
  }
}
.nc-lookup-cell .nc-text-area-clamped-text {
  @apply !mr-1;
}

.nc-lookup-cell {
  &:has(.nc-cell-attachment) {
    height: auto !important;
  }

  .nc-cell-checkbox {
    @apply children:pl-0;
    & > div {
      @apply !h-auto;
    }
  }

  .nc-cell-url {
    a {
      @apply !py-0;
    }
  }

  .nc-attachment-image {
    @apply !hover:cursor-pointer;
  }
}
.lookup-dropdown {
  .nc-cell-field > span {
    @apply !text-[13px];
  }
  .lookup-search-input {
    // order matters hence using vanilla css
    border: none;
    border-bottom: 1px solid;
    @apply !shadow-none px-3 py-[6.5px] rounded-[14px_14px_0_0] !border-nc-border-gray-medium;
    input::placeholder {
      @apply !text-nc-content-gray-muted;
    }
    .ant-input-prefix {
      @apply mr-2;
    }
  }

  .nc-lookup-attachment-wrapper {
    .nc-attachment-cell > div:first-of-type {
      @apply !h-auto justify-start pr-6;

      .nc-attachment-image {
        @apply !hover:cursor-pointer;
      }
    }
  }
}
</style>
