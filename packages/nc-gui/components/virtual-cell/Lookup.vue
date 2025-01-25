<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'

const { metas, getMeta } = useMetas()

const column = inject(ColumnInj, ref())

const meta = inject(MetaInj, ref())

const cellValue = inject(CellValueInj, ref())

const isGroupByLabel = inject(IsGroupByLabelInj, ref(false))

// Change the row height of the child cell under lookup
// Other wise things like text will can take multi line tag
const providedHeightRef = ref(1) as any

const rowHeight = inject(RowHeightInj, ref(1) as any)

provide(RowHeightInj, providedHeightRef)

const relationColumn = computed(() =>
  meta.value?.id
    ? metas.value[meta.value?.id]?.columns?.find(
        (c: ColumnType) => c.id === (column.value?.colOptions as LookupType)?.fk_relation_column_id,
      )
    : undefined,
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

watch([lookupColumn, rowHeight], () => {
  if (lookupColumn.value && !isAttachment(lookupColumn.value)) {
    providedHeightRef.value = 1
  } else {
    providedHeightRef.value = rowHeight.value
  }
})

const arrValue = computed(() => {
  if (!cellValue.value) return []

  // if lookup column is Attachment and relation type is Belongs/OneToOne to wrap the value in an array
  // since the attachment component expects an array or JSON string array
  if (
    lookupColumn.value?.uidt === UITypes.Attachment &&
    [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(relationColumn.value?.colOptions?.type)
  )
    return [cellValue.value]

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

const isSearchable = computed(() => {
  if (!lookupColumn.value) return false

  switch (lookupColumn.value.uidt!) {
    case UITypes.ID:
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
    case UITypes.Year:
    case UITypes.PhoneNumber:
    case UITypes.Email:
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
    case UITypes.Formula:
      return true
    default:
      return false
  }
})

const disableDropdown = computed(() => {
  if (!lookupColumn.value) return true
  if (arrValue.value.length < 2) return true
  return false
})

const filteredArrValues = computed(() => {
  const query = search.value.toLowerCase()
  return arrValue.value.filter((val) => {
    return `${val}`.toLowerCase().includes(query)
  })
})

const dropdownVisible = ref(false)

const triggerRef = ref<HTMLDivElement | null>(null)

const randomClass = `lookup-${Math.floor(Math.random() * 99999)}`

const cell = computed(() => triggerRef.value?.closest('td, .nc-data-cell'))

const dropdownOverlayRef = ref<HTMLInputElement | null>(null)
const active = inject(ActiveCellInj, ref(false))
const isGrid = inject(IsGridInj, ref(false))
const isCellAlreadyActive = ref(false)

function toggleDropdown() {
  if (isGrid.value && !isCellAlreadyActive.value && active.value) {
    isCellAlreadyActive.value = true
    return
  }
  dropdownVisible.value = !dropdownVisible.value
}

watch(active, (val) => {
  if (!val) isCellAlreadyActive.value = false
})

onMounted(() => {
  const container = triggerRef.value?.closest('td, .nc-data-cell, .nc-default-value-wrapper')
  if (container) container.addEventListener('click', toggleDropdown)
  onClickOutside(cell.value, (e) => {
    if ((e.target as HTMLElement)?.closest(`.${randomClass}`)) return
    dropdownVisible.value = false
  })
})

onUnmounted(() => {
  const container = triggerRef.value?.closest('td, .nc-data-cell, .nc-default-value-wrapper')
  if (container) container.removeEventListener('click', toggleDropdown)
})

watch(dropdownVisible, (val) => {
  setTimeout(() => {
    if (val && dropdownOverlayRef.value)
      dropdownOverlayRef.value?.querySelector<HTMLInputElement>('.lookup-search-input input')?.focus()
  }, 200)
})
</script>

<template>
  <NcDropdown
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
        height:
          isGroupByLabel || (lookupColumn && isAttachment(lookupColumn))
            ? undefined
            : rowHeight
            ? `${rowHeight === 1 ? rowHeightInPx['1'] - 4 : rowHeightInPx[`${rowHeight}`] - 18}px`
            : `2.85rem`,
      }"
      @dblclick="activateShowEditNonEditableFieldWarning"
    >
      <div
        class="h-full w-full flex gap-1"
        :class="{
          '!overflow-x-hidden nc-cell-lookup-scroll !overflow-y-hidden': rowHeight === 1,
        }"
      >
        <template v-if="lookupColumn">
          <!-- Render virtual cell -->
          <div v-if="isVirtualCol(lookupColumn) && lookupColumn.uidt !== UITypes.Rollup" class="flex h-full">
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
            <div
              v-if="isAttachment(lookupColumn) && arrValue[0] && !Array.isArray(arrValue[0]) && typeof arrValue[0] === 'object'"
            >
              <LazySmartsheetCell :model-value="arrValue" :column="lookupColumn" :edit-enabled="false" :read-only="true" />
            </div>
            <!-- For attachment cell avoid adding chip style -->
            <template v-else>
              <div
                class="max-h-full max-w-full w-full nc-cell-lookup-scroll"
                :class="{
                  'nc-scrollbar-md ': rowHeight !== 1 && !isAttachment(lookupColumn),
                }"
              >
                <div
                  class="flex gap-1.5 w-full h-full py-[3px]"
                  :class="{
                    'flex-wrap': rowHeight !== 1 && !isAttachment(lookupColumn),
                    '!overflow-x-hidden nc-cell-lookup-scroll !overflow-y-hidden': rowHeight === 1 || isAttachment(lookupColumn),
                    'items-center': rowHeight === 1,
                    'items-start': rowHeight !== 1,
                  }"
                >
                  <div
                    v-for="(v, i) of arrValue"
                    :key="i"
                    class="flex-none"
                    :class="{
                      'bg-nc-bg-default rounded-full': !isAttachment(lookupColumn),
                      'border-gray-200 rounded border-1': ![
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
                      :class="[
                        `${
                          [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User].includes(lookupColumn.uidt)
                            ? 'pl-2'
                            : !isAttachment(lookupColumn)
                            ? 'px-1'
                            : ''
                        }`,
                        {
                          'min-h-0 min-w-0': isAttachment(lookupColumn),
                          '!w-auto ': !isAttachment(lookupColumn),
                        },
                      ]"
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
          <template v-if="isVirtualCol(lookupColumn) && lookupColumn.uidt !== UITypes.Rollup">
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
              v-for="(v, i) of filteredArrValues"
              :key="i"
              class="flex-none"
              :class="{
                'bg-nc-bg-default rounded-full': !isAttachment(lookupColumn),
                'border-gray-200 rounded border-1': ![
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
                :class="[
                  `${
                    [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User].includes(lookupColumn.uidt)
                      ? 'pl-2'
                      : !isAttachment(lookupColumn)
                      ? 'px-1'
                      : ''
                  }`,
                  {
                    'min-h-0 min-w-0': isAttachment(lookupColumn),
                    '!w-auto ': !isAttachment(lookupColumn),
                  },
                ]"
              />
            </div>
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
}
.lookup-dropdown {
  .nc-cell-field > span {
    font-size: 13px !important;
  }
  .lookup-search-input {
    border: none;
    border-radius: 14px 14px 0 0;
    border-bottom: 1px solid;
    @apply !border-nc-border-gray-medium;
    box-shadow: none !important;
    input::placeholder {
      @apply !text-nc-content-gray-muted;
    }
    .ant-input-prefix {
      margin-right: 8px;
    }
  }
}
</style>
