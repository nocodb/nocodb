<script lang="ts" setup>
import {
  type ColumnType,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  store: ReturnType<typeof useProvideExpandedFormStore>
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  isLoading: boolean
  forceVerticalMode?: boolean
}>()

const isLoading = toRef(props, 'isLoading')

const isPublic = inject(IsPublicInj, ref(false))

/* stores */

const { changedColumns, isNew, loadRow: _loadRow, row: _row } = props.store

const { isUIAllowed } = useRoles()
const { isMobileMode } = useGlobal()

/* flags */

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

/* initial focus and scroll fix */

const cellWrapperEl = ref()
const mentionedCell = ref('')

/* hidden fields */

const showHiddenFields = ref(false)

function toggleHiddenFields() {
  showHiddenFields.value = !showHiddenFields.value
}

/* utilities */

function isReadOnlyVirtualCell(column: ColumnType) {
  return (
    isRollup(column) ||
    isFormula(column) ||
    isBarcode(column) ||
    isLookup(column) ||
    isQrCode(column) ||
    isSystemColumn(column) ||
    isCreatedOrLastModifiedTimeCol(column) ||
    isCreatedOrLastModifiedByCol(column)
  )
}
</script>

<template>
  <div
    ref="expandedFormScrollWrapper"
    class="flex flex-col flex-grow gap-6 h-full max-h-full nc-scrollbar-thin items-center w-full p-4 xs:(px-4 pt-4 pb-2 gap-6) children:max-w-[588px] <lg:(children:max-w-[450px])"
  >
    <div
      v-for="(col, i) of fields"
      v-show="!isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
      :key="col.title"
      :class="`nc-expand-col-${col.title}`"
      :col-id="col.id"
      :data-testid="`nc-expand-col-${col.title}`"
      class="nc-expanded-form-row w-full"
    >
      <div
        class="flex items-start nc-expanded-cell min-h-[37px]"
        :class="{
          'flex-row sm:(gap-x-2) <lg:(flex-col w-full)': !props.forceVerticalMode,
          'flex-col w-full': props.forceVerticalMode,
        }"
      >
        <div
          class="flex items-center rounded-lg overflow-hidden"
          :class="{
            'w-45 <lg:(w-full px-0 mb-1) h-[37px] xs:(h-auto)': !props.forceVerticalMode,
            'w-full px-0 mb-1 h-auto': props.forceVerticalMode,
          }"
        >
          <LazySmartsheetHeaderVirtualCell
            v-if="isVirtualCol(col)"
            :column="col"
            class="nc-expanded-cell-header h-full flex-none"
          />
          <LazySmartsheetHeaderCell v-else :column="col" class="nc-expanded-cell-header flex-none" />
        </div>

        <template v-if="isLoading">
          <a-skeleton-input active class="h-[37px] flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden" size="small" />
        </template>
        <template v-else>
          <SmartsheetDivDataCell
            v-if="col.title"
            :ref="(el: any) => { if (i) cellWrapperEl = el }"
            class="bg-white flex-1 <lg:w-full px-1 min-h-[37px] flex items-center relative"
            :class="{
              'w-full': props.forceVerticalMode,
              '!select-text nc-system-field': isReadOnlyVirtualCell(col),
              '!select-text nc-readonly-div-data-cell': readOnly,
              'nc-mentioned-cell': col.id === mentionedCell,
            }"
          >
            <LazySmartsheetVirtualCell
              v-if="isVirtualCol(col)"
              v-model="_row.row[col.title]"
              :class="{
                'px-1': isReadOnlyVirtualCell(col),
              }"
              :column="col"
              :read-only="readOnly"
              :row="_row"
            />

            <LazySmartsheetCell
              v-else
              v-model="_row.row[col.title]"
              :active="true"
              :column="col"
              :edit-enabled="true"
              :read-only="readOnly"
              @update:model-value="changedColumns.add(col.title)"
            />
          </SmartsheetDivDataCell>
        </template>
      </div>
    </div>

    <div v-if="hiddenFields.length > 0" class="flex w-full <lg:(px-1) items-center py-6">
      <div class="flex-grow h-px mr-1 bg-gray-100" />
      <NcButton
        :size="isMobileMode ? 'medium' : 'small'"
        class="flex-shrink !text-sm overflow-hidden !text-gray-500 !font-weight-500"
        type="secondary"
        @click="toggleHiddenFields"
      >
        {{ showHiddenFields ? `Hide ${hiddenFields.length} hidden` : `Show ${hiddenFields.length} hidden` }}
        {{ hiddenFields.length > 1 ? `fields` : `field` }}
        <GeneralIcon icon="chevronDown" :class="showHiddenFields ? 'transform rotate-180' : ''" class="ml-1" />
      </NcButton>
      <div class="flex-grow h-px ml-1 bg-gray-100" />
    </div>

    <template v-if="hiddenFields.length > 0 && showHiddenFields">
      <div
        v-for="(col, i) of hiddenFields"
        v-show="isFormula(col) || !isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
        :key="`${col.id}-${col.title}`"
        :class="`nc-expand-col-${col.title}`"
        :data-testid="`nc-expand-col-${col.title}`"
        class="nc-expanded-form-row w-full"
      >
        <div class="flex items-start flex-row sm:(gap-x-2) <lg:(flex-col w-full) nc-expanded-cell min-h-[37px]">
          <div class="w-45 <lg:(w-full px-0) h-[37px] xs:(h-auto) flex items-center rounded-lg overflow-hidden">
            <LazySmartsheetHeaderVirtualCell
              v-if="isVirtualCol(col)"
              :column="col"
              is-hidden-col
              class="nc-expanded-cell-header flex-none"
            />

            <LazySmartsheetHeaderCell v-else :column="col" is-hidden-col class="nc-expanded-cell-header flex-none" />
          </div>

          <template v-if="isLoading">
            <a-skeleton-input active class="h-[37px] flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden" size="small" />
          </template>
          <template v-else>
            <LazySmartsheetDivDataCell
              v-if="col.title"
              :ref="(el: any) => { if (i) cellWrapperEl = el }"
              class="bg-white flex-1 <lg:w-full px-1 min-h-[37px] flex items-center relative"
              :class="{
                '!select-text nc-system-field': isReadOnlyVirtualCell(col),
                '!bg-gray-50 !select-text nc-readonly-div-data-cell': readOnly,
                'nc-mentioned-cell': col.id === mentionedCell,
              }"
            >
              <LazySmartsheetVirtualCell
                v-if="isVirtualCol(col)"
                v-model="_row.row[col.title]"
                :column="col"
                :read-only="readOnly"
                :row="_row"
              />

              <LazySmartsheetCell
                v-else
                v-model="_row.row[col.title]"
                :active="true"
                :column="col"
                :edit-enabled="true"
                :read-only="readOnly"
                @update:model-value="changedColumns.add(col.title)"
              />
            </LazySmartsheetDivDataCell>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
