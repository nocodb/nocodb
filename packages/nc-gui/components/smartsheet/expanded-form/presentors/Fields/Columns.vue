<script lang="ts" setup>
import { type ColumnType } from 'nocodb-sdk'
import { fieldMatchesSearch, isBlankFieldValue } from './searchUtils'

const props = defineProps<{
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  isLoading: boolean
  forceVerticalMode?: boolean
  searchQuery?: string
  hideBlankFields?: boolean
}>()

const isLoading = toRef(props, 'isLoading')

const { loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

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

const passesActiveFilters = (col: ColumnType) => {
  if (!fieldMatchesSearch(col, normalizedSearch.value, _row.value?.row)) return false
  if (props.hideBlankFields && col.title && isBlankFieldValue(_row.value?.row?.[col.title])) return false
  return true
}

const visibleHiddenFieldsCount = computed(() => {
  if (!isFiltering.value) return props.hiddenFields.length
  return props.hiddenFields.filter(passesActiveFilters).length
})

const visibleFieldsCount = computed(() => {
  if (!isFiltering.value) return props.fields.length
  return props.fields.filter(passesActiveFilters).length
})

const showEmptyState = computed(() => isFiltering.value && visibleFieldsCount.value === 0 && visibleHiddenFieldsCount.value === 0)

const effectiveShowHidden = computed(() => isFiltering.value || showHiddenFields.value)
</script>

<template>
  <div
    ref="expandedFormScrollWrapper"
    class="flex flex-col flex-grow gap-5 h-full max-h-full nc-scrollbar-thin items-center w-full p-4 xs:(px-4 pt-4 pb-2 gap-6) children:max-w-[588px] <lg:(children:max-w-[450px])"
  >
    <SmartsheetExpandedFormPresentorsFieldsColumnList
      :fields="fields"
      :force-vertical-mode="forceVerticalMode"
      :is-loading="isLoading"
      :search-query="normalizedSearch"
      :hide-blank-fields="hideBlankFields"
    />
    <div v-if="hiddenFields.length > 0 && !showEmptyState" class="flex w-full <lg:(px-1) items-center py-6">
      <div class="flex-grow h-px mr-1 bg-nc-bg-gray-light" />
      <NcButton
        :size="isMobileMode ? 'medium' : 'small'"
        :disabled="isFiltering"
        class="flex-shrink !text-sm overflow-hidden !text-nc-content-gray-muted !font-weight-500"
        type="secondary"
        @click="showHiddenFields = !showHiddenFields"
      >
        <template v-if="isFiltering">
          {{ visibleHiddenFieldsCount }} matching hidden {{ visibleHiddenFieldsCount === 1 ? 'field' : 'fields' }}
        </template>
        <template v-else>
          {{ showHiddenFields ? `Hide ${hiddenFields.length} hidden` : `Show ${hiddenFields.length} hidden` }}
          {{ hiddenFields.length > 1 ? `fields` : `field` }}
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
      v-if="hiddenFields.length > 0 && effectiveShowHidden && !showEmptyState"
      :fields="hiddenFields"
      is-hidden-col
      :force-vertical-mode="forceVerticalMode"
      :is-loading="isLoading"
      :search-query="normalizedSearch"
      :hide-blank-fields="hideBlankFields"
      :show-col-callback="(col) => isFormula(col)"
    />
    <div
      v-if="showEmptyState"
      class="nc-expanded-form-empty-search flex flex-col items-center justify-center gap-2 w-full py-12 text-nc-content-gray-muted"
      data-testid="nc-expanded-form-empty-search"
    >
      <GeneralIcon icon="search" class="h-6 w-6" />
      <span v-if="isSearching" class="text-sm">{{ $t('placeholder.noResultsFoundForYourSearch') }}</span>
      <span v-else class="text-sm">All fields are blank for this record</span>
    </div>
  </div>
</template>
