<template>
  <div>
    <template v-if="meta && tabMeta">
      <SmartsheetGrid :meta="meta" :tabMeta="tabMeta"></SmartsheetGrid>
    </template>
  </div>
</template>

<script setup lang="ts">
import {useMetas} from "~/composables/metas";
import {computed, onMounted, watch} from 'vue'

const {tabMeta} = defineProps({
  tabMeta: Object
})

const {getMeta, metas} = useMetas()

const meta = computed(() => {
  return metas.value?.[tabMeta?.id]
})

onMounted(async () => {
    await getMeta(tabMeta?.id)
})

watch(() => tabMeta && tabMeta?.id, async (newVal, oldVal) => {
  if (newVal !== oldVal) {
    await getMeta(newVal)
  }
})
</script>

<style scoped>

</style>
