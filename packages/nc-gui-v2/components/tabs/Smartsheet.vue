<script setup lang="ts">
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { computed, onMounted, provide, watch } from '#imports'
import { ActiveViewInj, MetaInj, TabMetaInj } from '~/components'
import useMetas from '~/composables/useMetas'

const { tabMeta } = defineProps({
  tabMeta: Object,
})

const { getMeta, metas } = useMetas()

const activeView = ref<GridType | FormType | KanbanType | GalleryType>()
const meta = computed(() => metas.value?.[tabMeta?.id])

onMounted(async () => {
  await getMeta(tabMeta?.id)
})

provide(MetaInj, meta)
provide(TabMetaInj, tabMeta)
provide(ActiveViewInj, activeView)

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
    <template v-if="meta">
      <div class="d-flex">
        <div v-if="activeView" class="flex-grow-1 min-w-0">
          <SmartsheetGrid v-if="activeView.type === ViewTypes.GRID" />
        </div>
        <SmartsheetSidebar />
      </div>
    </template>
  </div>
</template>
