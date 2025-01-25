<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { type TableType } from 'nocodb-sdk'
import PageEditor from './components/PageEditor.vue'
import { type PageDesignerPayload } from './lib/payload'
import { PageOrientation, PageType } from './lib/layout'
import { PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from './lib/context'
import TableAndViewPicker from './components/TableAndViewPicker.vue'

const { extension, fullscreen, getTableMeta } = useExtensionHelperOrThrow()

const KV_STORE_KEY = 'pageDesigner'

const savedPayload = ref<PageDesignerPayload>({
  widgets: {},
  orientation: PageOrientation.PORTRAIT,
  pageType: PageType.LETTER,
  lastWidgetId: 0,
  currentWidgetId: -1,
})

const row = ref<Partial<Row>>({})
const meta = ref<TableType>()
const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) || meta.value?.columns?.[0] || null)
provide(PageDesignerPayloadInj, savedPayload)
provide(PageDesignerRowInj, row)
provide(PageDesignerTableTypeInj, meta)

async function saveChanges() {
  await extension.value.kvStore.set(KV_STORE_KEY, savedPayload.value)
}

onMounted(async () => {
  const saved = (await extension.value.kvStore.get(KV_STORE_KEY)) as PageDesignerPayload
  if (saved) {
    savedPayload.value = saved
  }
})

watch(
  () => {
    return {
      selectedTableId: savedPayload.value.selectedTableId,
      selectedViewId: savedPayload.value.selectedViewId,
      pageName: savedPayload.value.pageName,
      widgets: savedPayload.value.widgets,
      orientation: savedPayload.value.orientation,
      pageType: savedPayload.value.pageType,
    }
  },
  () => {
    saveChanges()
  },
  { deep: true },
)

watch(
  () => savedPayload.value.selectedTableId,
  async (tableId) => {
    if (!tableId) return
    row.value = {}
    const tableMeta = await getTableMeta(tableId)
    if (tableMeta) meta.value = tableMeta
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <ExtensionsExtensionWrapper>
    <template v-if="fullscreen" #headerExtra>
      <!-- <NcButton> Header actions </NcButton> -->
    </template>
    <div class="flex flex-col h-full">
      <div v-if="!fullscreen" class="flex flex-col max-h-full">
        <div class="p-3 flex">
          <TableAndViewPicker />
        </div>
        <div class="px-3 flex">
          <NRecordPicker
            v-if="savedPayload.selectedTableId"
            :key="savedPayload.selectedTableId + savedPayload.selectedViewId"
            v-model:model-value="row"
            :label="row ? row[displayField?.title ?? ''] ?? 'Select Record' : 'Select Record'"
            :table-id="savedPayload.selectedTableId"
            :view-id="savedPayload.selectedViewId"
            class="w-full"
          />
        </div>
        <div class="overflow-y-auto flex-1 relative group px-3 my-3 mini-layout">
          <div
            class="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out transform -translate-x-2/4 -translate-y-2/4 left-2/4 top-2/4"
            style="z-index: 10000"
          >
            <NcButton @click="fullscreen = true">
              <template #icon>
                <GeneralIcon icon="ncEdit"></GeneralIcon>
              </template>
              Edit Layout
            </NcButton>
          </div>
          <PageEditor style="zoom: 50%" />
        </div>
      </div>
      <PageEditor v-else />
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped>
.mini-layout {
  :deep(.layout-wrapper) {
    @apply rounded-lg;
  }
}
</style>

<style lang="scss">
[data-inactive-widget='true'] {
  .moveable-control,
  .moveable-rotation-line {
    visibility: hidden;
  }
  .moveable-line {
    @apply !bg-nc-bg-gray-dark;
  }
}
</style>
