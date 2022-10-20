<script lang="ts" setup>
import { useExpandedFormDetached } from '#imports'

const { isOpen, state, row, rowId, loadRow: shouldLoadRow, meta, useMetaFields, view, close } = useExpandedFormDetached()
</script>

<template>
  <LazySmartsheetExpandedForm
    v-if="!!row && !!meta"
    v-model="isOpen"
    :row="row"
    :load-row="shouldLoadRow"
    :meta="meta"
    :row-id="rowId"
    :state="state"
    :use-meta-fields="useMetaFields"
    :view="view"
    @cancel="close"
  />
</template>
