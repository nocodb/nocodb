<script setup lang="ts">
import { computed, onMounted, provide, watch } from 'vue'
import { MetaInj, TabMetaInj } from '~/components'
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

provide(MetaInj, meta)
provide(TabMetaInj, tabMeta)

watch(
  () => tabMeta && tabMeta?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) await getMeta(newVal)
  },
)
</script>

<template>
  <div class="overflow-auto">
    <v-toolbar dense class="nc-table-toolbar elevation-0 xc-toolbar xc-border-bottom mx-1" style="z-index: 7"> </v-toolbar>
    <template v-if="meta && tabMeta">
      <SmartsheetGrid />
    </template>
  </div>
</template>

<style scoped></style>
