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
      @update:model-value="shouldClose($event, i)"
      @cancel="close(i)"
    />
  </template>
</template>
