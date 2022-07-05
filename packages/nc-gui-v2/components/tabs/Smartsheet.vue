<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useMetas } from '~/composables/metas'

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

watch(
  () => tabMeta && tabMeta?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) await getMeta(newVal)
  },
)
</script>

<template>
  <div>
    <template v-if="meta && tabMeta">
      <SmartsheetGrid :meta="meta" :tab-meta="tabMeta" />
    </template>
  </div>
</template>

<style scoped></style>
