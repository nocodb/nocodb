<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

const query = defineModel<string>('query', { default: '' })

const emit = defineEmits<{
  (e: 'filterChange'): void
  (e: 'keydown', event: KeyboardEvent): void
}>()

const { t } = useI18n()

const {
  searchableColumns,
  searchField,
  selectedSearchField,
  isSearchFieldDateOrDateTime,
  relatedTableDisplayValueColumn,
  relatedTableDisplayValueProp,
} = useLTARStoreOrThrow()

const isSearchInputFocused = ref(false)

const filterQueryRef = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

const ALL_FIELDS_ID = 'all'

const allFieldsOption = computed<ColumnType>(() => ({
  id: ALL_FIELDS_ID,
  title: t('general.allVisibleFields'),
  uidt: 'SingleLineText' as any,
}))

const fieldOptions = computed(() => [allFieldsOption.value, ...searchableColumns.value])

const displayColumnLabel = computed(() => {
  if (searchField.value === ALL_FIELDS_ID) return allFieldsOption.value.title
  return selectedSearchField.value?.title ?? relatedTableDisplayValueProp.value
})

const onSelectOption = (option: Record<string, any>) => {
  searchField.value = option.id === ALL_FIELDS_ID ? ALL_FIELDS_ID : (option.id as string)
  isDropdownOpen.value = false

  query.value = ''

  nextTick(() => {
    filterQueryRef.value?.focus()
  })
}

defineExpose({
  filterQueryRef,
  isSearchInputFocused,
})
</script>

<template>
  <div class="flex-1 nc-dropdown-link-record-search-wrapper flex items-center rounded-md">
    <div class="flex items-center gap-1 flex-none">
      <GeneralIcon icon="search" class="h-3.5 w-3.5 text-nc-content-gray-muted flex-none" />
    </div>
    <NcDropdown
      v-model:visible="isDropdownOpen"
      placement="bottomLeft"
      overlay-class-name="nc-dropdown-toolbar-search-field-option"
    >
      <div class="flex items-center cursor-pointer flex-none px-1" @click="isDropdownOpen = !isDropdownOpen">
        <div class="h-7 flex items-center gap-1 px-1 rounded-md text-nc-content-brand bg-nc-bg-brand-inverted select-none">
          <template v-if="searchField === ALL_FIELDS_ID">
            <GeneralIcon icon="ncList" class="!w-3.5 !h-3.5 !mx-0" />
            <span class="text-bodyDefaultSm font-medium truncate max-w-16">{{ $t('general.allVisibleFields') }}</span>
          </template>
          <template v-else-if="selectedSearchField">
            <SmartsheetHeaderIcon :column="selectedSearchField" class="!w-3.5 !h-3.5 !mx-0" />
            <span class="text-bodyDefaultSm font-medium truncate max-w-16">{{ selectedSearchField.title }}</span>
          </template>
          <GeneralIcon
            icon="chevronDown"
            class="!text-current flex-none transform transition-transform duration-25 w-3.5 h-3.5"
            :class="{ '!rotate-180': isDropdownOpen }"
          />
        </div>
      </div>
      <template #overlay>
        <NcList
          show-selected-option
          option-label-key="title"
          option-value-key="id"
          :open="isDropdownOpen"
          :list="fieldOptions"
          :value="searchField"
          :min-items-for-search="10"
          variant="medium"
          class="!h-auto"
          @change="onSelectOption"
        >
          <template #listItemExtraLeft="{ option }">
            <GeneralIcon
              v-if="option.id === ALL_FIELDS_ID"
              icon="ncList"
              class="flex-none h-3.5 w-3.5 mx-1 text-nc-content-gray-muted"
            />
            <SmartsheetHeaderIcon v-else :column="option" class="flex-none" color="text-nc-content-gray-muted" />
          </template>
        </NcList>
      </template>
    </NcDropdown>

    <!-- Date/DateTime search input -->
    <SmartsheetToolbarFilterInput
      v-if="isSearchFieldDateOrDateTime"
      class="nc-filter-value-select rounded-md min-w-34 flex-1"
      :column="selectedSearchField || relatedTableDisplayValueColumn!"
      :filter="{
        comparison_op: 'eq',
        comparison_sub_op: 'exactDate',
        value: query,
      }"
      @update-filter-value="query = $event"
      @click.stop
    />
    <!-- Text search input -->
    <a-input
      v-else
      ref="filterQueryRef"
      v-model:value="query"
      :bordered="false"
      :placeholder="`${t('general.searchIn')} ${displayColumnLabel}...`"
      class="w-full nc-link-record-search-input min-h-4 !pl-0"
      size="small"
      autocomplete="off"
      @focus="isSearchInputFocused = true"
      @blur="isSearchInputFocused = false"
      @change="emit('filterChange')"
      @keydown.capture.stop="emit('keydown', $event)"
    />
  </div>
</template>
