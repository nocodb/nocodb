<script setup lang="ts">
import { computed, onMounted, provide, watch } from 'vue'
import useMetas from '~/composables/useMetas'

const { tabMeta } = defineProps({
  tabMeta: Object,
})

const { getMeta, metas } = useMetas()

const meta = computed(() => {
  return metas.value?.[tabMeta?.id]
})

onMounted(async () => {
  await getMeta(tabMeta?.id)
})

provide('meta', meta)
provide('tabMeta', tabMeta)

watch(
  () => tabMeta && tabMeta?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) await getMeta(newVal)
  },
)
</script>

<template>
  <div class="overflow-auto">
    <v-toolbar height="32" dense class="nc-table-toolbar elevation-0 xc-toolbar xc-border-bottom mx-1" style="z-index: 7" />
    <template v-if="meta && tabMeta">
      <SmartsheetGrid />
    </template>
  </div>
</template>

<style scoped></style>
