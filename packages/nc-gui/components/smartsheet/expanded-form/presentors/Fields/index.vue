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
  searchQuery?: string
  hideBlankFields?: boolean
  /** When true, the right-side comments/audits drawer is forcibly hidden
   * regardless of the user's commentsDrawer preference. Used by the EE
   * docked panel when it is too narrow to host a sidebar. */
  hideSidebar?: boolean
  /** When true, each field row stacks (label above value) instead of the
   * default horizontal layout (label left, value right). Used by the EE
   * docked panel to fit fields in a narrower main pane and leave room for
   * the sidebar at lower thresholds. */
  forceVerticalMode?: boolean
  /** When true, the field list renders in compact mode — flat cells, tighter
   * row spacing, uppercase label, '--' placeholder for blank values. Forwarded
   * straight to Columns/ColumnList where the actual styling lives. */
  compactMode?: boolean
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
const showRightSections = computed(
  () => !props.hideSidebar && !isNew.value && commentsDrawer.value && isUIAllowed('commentList') && !isSqlView.value,
)
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
      <SmartsheetExpandedFormPresentorsFieldsColumns
        :fields="fields"
        :hidden-fields="hiddenFields"
        :is-loading="isLoading"
        :search-query="searchQuery"
        :hide-blank-fields="hideBlankFields"
        :force-vertical-mode="forceVerticalMode"
        :compact-mode="compactMode"
      />

      <div class="p-2" />
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 rtl:(border-l-0 border-r-1) relative border-nc-border-gray-medium bg-nc-bg-gray-extralight w-1/3 max-w-[400px] min-w-[240px] h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormSidebar />
    </div>
  </div>
</template>
