<script lang="ts" setup>
import { type ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  isLoading: boolean
  forceVerticalMode?: boolean
}>()

const isLoading = toRef(props, 'isLoading')

const { loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

const { isMobileMode } = useGlobal()

const showHiddenFields = ref(false)
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
    />
    <div v-if="hiddenFields.length > 0" class="flex w-full <lg:(px-1) items-center py-6">
      <div class="flex-grow h-px mr-1 bg-gray-100" />
      <NcButton
        :size="isMobileMode ? 'medium' : 'small'"
        class="flex-shrink !text-sm overflow-hidden !text-gray-500 !font-weight-500"
        type="secondary"
        @click="showHiddenFields = !showHiddenFields"
      >
        {{ showHiddenFields ? `Hide ${hiddenFields.length} hidden` : `Show ${hiddenFields.length} hidden` }}
        {{ hiddenFields.length > 1 ? `fields` : `field` }}
        <GeneralIcon icon="chevronDown" :class="showHiddenFields ? 'transform rotate-180' : ''" class="ml-1" />
      </NcButton>
      <div class="flex-grow h-px ml-1 bg-gray-100" />
    </div>
    <SmartsheetExpandedFormPresentorsFieldsColumnList
      v-if="hiddenFields.length > 0 && showHiddenFields"
      :fields="hiddenFields"
      :force-vertical-mode="forceVerticalMode"
      :is-loading="isLoading"
      :show-col-callback="(col) => isFormula(col)"
    />
  </div>
</template>
