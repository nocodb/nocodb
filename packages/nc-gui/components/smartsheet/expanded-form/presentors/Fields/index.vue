<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  rowId?: string
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  isUnsavedDuplicatedRecordExist: boolean
  isUnsavedFormExist: boolean
  isLoading: boolean
  isSaving: boolean
  newRecordSubmitBtnText?: string
}>()

const fields = toRef(props, 'fields')
const hiddenFields = toRef(props, 'hiddenFields')
const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')
const isLoading = toRef(props, 'isLoading')

/* stores */

const { commentsDrawer, isNew } = useExpandedFormStoreOrThrow()

const { isSqlView } = useSmartsheetStoreOrThrow()

const { isUIAllowed } = useRoles()

/* flags */
const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList') && !isSqlView.value)
</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsFields',
}
</script>

<template>
  <div class="h-full flex flex-row">
    <div
      class="h-full flex xs:w-full flex-col overflow-hidden"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <SmartsheetExpandedFormPresentorsFieldsColumns :fields="fields" :hidden-fields="hiddenFields" :is-loading="isLoading" />

      <div class="p-2" />
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-nc-border-gray-medium bg-nc-bg-gray-extralight w-1/3 max-w-[400px] min-w-0 h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormSidebar />
    </div>
  </div>
</template>
