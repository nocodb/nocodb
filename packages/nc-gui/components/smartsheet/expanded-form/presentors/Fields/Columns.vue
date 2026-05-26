<script lang="ts" setup>
import { type ColumnType, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'
import { fieldMatchesSearch, isBlankFieldValue } from './searchUtils'

const props = defineProps<{
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  isLoading: boolean
  forceVerticalMode?: boolean
  searchQuery?: string
  hideBlankFields?: boolean
  compactMode?: boolean
}>()

const isLoading = toRef(props, 'isLoading')

const { isNew, loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

const { isMobileMode } = useGlobal()

// Default the hidden-fields section to open when this is a new row
// and at least one hidden field is required (#13838) — saves the user
// from hunting for the field that's blocking their save. For existing
// rows or when no hidden field is required, keep the section collapsed
// as before. The user can still toggle manually after the initial mount.
const showHiddenFields = ref(_row.value?.rowMeta?.new === true && props.hiddenFields.some(isHideBlockingRequired))

const normalizedSearch = computed(() => (props.searchQuery ?? '').trim().toLowerCase())

const isSearching = computed(() => normalizedSearch.value.length > 0)

const isFiltering = computed(() => isSearching.value || !!props.hideBlankFields)

// Mirror ColumnList.showCol's baseVisible gate so counts stay in sync with what
// actually renders. The hidden list uses `isFormula` as its showColCallback in
// the template below — pass the same callback here so visibleHiddenFieldsCount
// can't drift from the rendered count.
const passesBaseVisible = (col: ColumnType, showColCallback?: (col: ColumnType) => boolean) => {
  return !!(showColCallback?.(col) || !isVirtualCol(col) || !isNew.value || isLinksOrLTAR(col))
}

const passesActiveFilters = (col: ColumnType, showColCallback?: (col: ColumnType) => boolean) => {
  if (!passesBaseVisible(col, showColCallback)) return false
  if (!fieldMatchesSearch(col, normalizedSearch.value, _row.value?.row)) return false
  if (props.hideBlankFields && col.title && isBlankFieldValue(_row.value?.row?.[col.title])) return false
  return true
}

const visibleHiddenFieldsCount = computed(() => {
  if (!isFiltering.value) return props.hiddenFields.length
  return props.hiddenFields.filter((col) => passesActiveFilters(col, isFormula)).length
})

const visibleFieldsCount = computed(() => {
  if (!isFiltering.value) return props.fields.length
  return props.fields.filter((col) => passesActiveFilters(col)).length
})

const showEmptyState = computed(() => isFiltering.value && visibleFieldsCount.value === 0 && visibleHiddenFieldsCount.value === 0)

const effectiveShowHidden = computed(() => isFiltering.value || showHiddenFields.value)

// While filtering, hide the hidden-fields section entirely if nothing in it
// matches — a "0 hidden fields" pill carries no useful signal.
const showHiddenFieldsSection = computed(() => {
  if (props.hiddenFields.length === 0) return false
  if (showEmptyState.value) return false
  if (isFiltering.value && visibleHiddenFieldsCount.value === 0) return false
  return true
})
</script>

<template>
  <div
    ref="expandedFormScrollWrapper"
    class="flex flex-col flex-grow h-full max-h-full nc-scrollbar-thin items-center w-full p-4 xs:(px-4 pt-4 pb-2) children:max-w-[588px] <lg:(children:max-w-[450px])"
    :class="[compactMode ? 'gap-2.5 xs:gap-3 nc-panel-fields-compact' : 'gap-5 xs:gap-6']"
  >
    <SmartsheetExpandedFormPresentorsFieldsColumnList
      :fields="fields"
      :force-vertical-mode="forceVerticalMode"
      :is-loading="isLoading"
      :search-query="normalizedSearch"
      :hide-blank-fields="hideBlankFields"
      :compact-mode="compactMode"
    />
    <div v-if="showHiddenFieldsSection" class="flex w-full <lg:(px-1) items-center py-6">
      <div class="flex-grow h-px mr-1 bg-nc-bg-gray-light" />
      <NcButton
        :size="isMobileMode ? 'medium' : 'small'"
        :disabled="isFiltering"
        class="flex-shrink !text-sm overflow-hidden !text-nc-content-gray-muted !font-weight-500"
        type="secondary"
        @click="showHiddenFields = !showHiddenFields"
      >
        <template v-if="isFiltering">
          {{ $t('labels.hiddenFieldCount', { count: visibleHiddenFieldsCount }, visibleHiddenFieldsCount) }}
        </template>
        <template v-else>
          {{
            showHiddenFields
              ? $t('labels.hideHiddenFields', { count: hiddenFields.length }, hiddenFields.length)
              : $t('labels.showHiddenFields', { count: hiddenFields.length }, hiddenFields.length)
          }}
        </template>
        <GeneralIcon
          v-if="!isFiltering"
          icon="chevronDown"
          :class="showHiddenFields ? 'transform rotate-180' : ''"
          class="ml-1"
        />
      </NcButton>
      <div class="flex-grow h-px ml-1 bg-nc-bg-gray-light" />
    </div>
    <SmartsheetExpandedFormPresentorsFieldsColumnList
      v-if="showHiddenFieldsSection && effectiveShowHidden"
      :fields="hiddenFields"
      is-hidden-col
      :force-vertical-mode="forceVerticalMode"
      :is-loading="isLoading"
      :search-query="normalizedSearch"
      :hide-blank-fields="hideBlankFields"
      :compact-mode="compactMode"
      :show-col-callback="(col) => isFormula(col)"
    />
    <div
      v-if="showEmptyState"
      class="nc-expanded-form-empty-search flex flex-col items-center justify-center gap-2 w-full py-12 text-nc-content-gray-muted"
      data-testid="nc-expanded-form-empty-search"
    >
      <GeneralIcon icon="search" class="h-6 w-6" />
      <span v-if="isSearching" class="text-sm">{{ $t('placeholder.noResultsFoundForYourSearch') }}</span>
      <span v-else class="text-sm">{{ $t('msg.info.allFieldsBlankForRecord') }}</span>
    </div>
  </div>
</template>
