<script lang="ts" setup>
const { states, close } = useExpandedFormDetached()

const shouldClose = (isVisible: boolean, i: number) => {
  if (!isVisible) close(i)
}
</script>

<template>
  <template v-for="(state, i) of states" :key="`expanded-form-${i}`">
    <LazySmartsheetExpandedForm
      v-model="state.isOpen"
      :row="state.row"
      :load-row="state.loadRow"
      :meta="state.meta"
      :row-id="state.rowId"
      :state="state.state"
      :use-meta-fields="state.useMetaFields"
      :maintain-default-view-order="state.maintainDefaultViewOrder"
      :view="state.view"
      :skip-reload="state.skipReload"
      :template-mode="state.templateMode"
      :template-name="state.templateName"
      :blueprint-mode="state.blueprintMode"
      :existing-template-names="state.existingTemplateNames"
      :editing-template-id="state.editingTemplateId"
      :blueprint-parent-table-id="state.blueprintParentTableId"
      :breadcrumbs="state.breadcrumbs"
      :new-record-submit-btn-text="state.newRecordSubmitBtnText"
      :new-record-header="state.newRecordHeader"
      @update:model-value="shouldClose($event, i)"
      @cancel="close(i)"
      @created-record="state?.createdRecord?.($event)"
    />
  </template>
</template>
