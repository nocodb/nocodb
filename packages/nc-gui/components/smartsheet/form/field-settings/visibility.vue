<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

const { visibleColumns, activeField, allViewFilters, localColumns, localColumnsMapByFkColumnId } = useFormViewStoreOrThrow()

const isOpen = ref<boolean>(false)

const allFilters = ref({})

provide(AllFiltersInj, allFilters)

const fieldAlias = computed(() => {
  return localColumns.value.reduce((acc, field) => {
    if (field?.fk_column_id && field?.label?.trim()) {
      acc[field.fk_column_id] = field.label
    }
    return acc
  }, {} as Record<string, string>)
})

provide(FieldNameAlias, fieldAlias)

const visibilityError = computed(() => {
  return parseProp(activeField.value?.meta)?.visibility?.errors || {}
})

const hasvisibilityError = computed(() => Object.keys(visibilityError.value).length)

const visibilityFilters = computed(() => {
  if (activeField.value?.fk_column_id && !allViewFilters.value[activeField.value.fk_column_id]) {
    allViewFilters.value[activeField.value.fk_column_id] = []
  }

  return allViewFilters.value[`${activeField.value?.fk_column_id}`]
})

const isFirstField = computed(() => {
  return !!(visibleColumns.value.length && visibleColumns.value[0].id === activeField.value?.id)
})

const filterOption = (column: ColumnType) => {
  // hide active field from filter option
  const isNotActiveField = column.id !== activeField.value?.fk_column_id

  // show only form view visible columns and order is less than active field
  const orderIsLessThanActiveField =
    column.id && localColumnsMapByFkColumnId.value[column.id]
      ? (localColumnsMapByFkColumnId.value[column.id].order ?? Infinity) < (activeField.value?.order ?? Infinity)
      : false

  const isVisible = localColumnsMapByFkColumnId.value[column.id]?.show

  return isNotActiveField && orderIsLessThanActiveField && isVisible
}
</script>

<template>
  <div v-if="activeField" class="flex flex-col">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="text-gray-800 font-medium">{{ $t('labels.showOnConditions') }}</div>

        <div class="flex flex-col">
          <NcDropdown
            v-if="visibilityFilters"
            v-model:visible="isOpen"
            placement="bottomLeft"
            :disabled="isFirstField && !visibilityFilters.length && !isOpen"
            overlay-class-name="nc-form-field-visibility-dropdown"
          >
            <NcTooltip placement="left" :disabled="!isFirstField">
              <template #title> Cannot add conditions to the first field in a form. </template>
              <div
                class="nc-form-field-visibility-btn border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all cursor-pointer select-none text-sm"
                :class="{
                  '!border-brand-500 shadow-selected': isOpen,
                  'border-gray-200': !isOpen,
                  'bg-[#F0F3FF]': visibilityFilters.length,
                  'opacity-70 cursor-default nc-disabled': isFirstField && !visibilityFilters.length,
                }"
                data-testid="nc-form-field-visibility-btn"
              >
                <div
                  class="nc-form-field-visibility-conditions-count flex-1"
                  :class="{
                    'text-brand-500 ': visibilityFilters.length,
                  }"
                >
                  {{
                    visibilityFilters.length
                      ? `${visibilityFilters.length} condition${visibilityFilters.length !== 1 ? 's' : ''}`
                      : 'No conditions'
                  }}
                </div>

                <GeneralIcon v-if="hasvisibilityError" icon="alertTriangle" class="flex-none !text-red-500" />

                <GeneralIcon
                  icon="settings"
                  class="flex-none w-4 h-4"
                  :class="{
                    'text-brand-500 ': visibilityFilters.length,
                  }"
                />
              </div>
            </NcTooltip>

            <template #overlay>
              <div
                class="nc-form-field-visibility-dropdown-container"
                :class="{
                  'py-2': !visibilityFilters.length,
                }"
              >
                <SmartsheetToolbarColumnFilter
                  ref="fieldVisibilityRef"
                  v-model="visibilityFilters"
                  class="w-full"
                  :auto-save="true"
                  data-testid="nc-filter-menu"
                  :show-loading="false"
                  :parent-col-id="activeField.fk_column_id"
                  :filter-option="filterOption"
                  :visibility-error="visibilityError"
                  :disable-add-new-filter="isFirstField"
                />
              </div>
            </template>
          </NcDropdown>
        </div>
      </div>
      <div>
        <div class="text-sm text-gray-500">{{ $t('labels.showFieldOnConditionsMet') }}</div>
        <div v-if="hasvisibilityError" class="mt-2 visibility-condition-input-error text-red-500">
          Error conditions will not be used for determining field visibility.
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

<style lang="scss">
.nc-form-field-visibility-dropdown {
  @apply rounded-2xl border-gray-200;
  box-shadow: 0px 20px 24px -4px rgba(0, 0, 0, 0.1), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
