<script setup lang="ts">
import { PageDesignerPayloadInj } from '../../src/context'

defineProps<{
  index: number
}>()

const payload = inject(PageDesignerPayloadInj)
</script>

<template>
  <div v-if="payload?.widgets?.[index]" class="flex">
    <a-input v-model:value="payload.widgets[index].value" type="text" placeholder="Value"></a-input>
    <a-input v-model:value="payload.widgets[index].fontSize" type="number" placeholder="Font size"></a-input>
  </div>
</template>
