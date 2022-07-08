<script setup lang="ts">
import { computed, onMounted, provide, watch } from '#imports'
import { MetaInj, TabMetaInj } from '~/components'
import useMetas from '~/composables/useMetas'

const { tabMeta } = defineProps({
  tabMeta: Object,
})

const { getMeta, metas } = useMetas()

const meta = computed(() => metas.value?.[tabMeta?.id])

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
    <SmartsheetToolbar />
    <template v-if="meta && tabMeta">
      <SmartsheetGrid />
    </template>
  </div>
</template>
