<script lang="ts" setup>
import { useExpandedFormDetached } from '#imports'

const { states } = useExpandedFormDetached()
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
      :view="state.view"
    />
  </template>
</template>
