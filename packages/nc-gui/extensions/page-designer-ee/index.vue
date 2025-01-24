<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { type TableType } from 'nocodb-sdk'
import PageEditor from './components/PageEditor.vue'
import { type PageDesignerPayload } from './lib/payload'
import { PageOrientation, PageType } from './lib/layout'
import { PageDesignerPayloadInj, PageDesignerRowInj } from './lib/context'
import TableAndViewPicker from './components/TableAndViewPicker.vue'

const { extension, fullscreen, getTableMeta } = useExtensionHelperOrThrow()

const KV_STORE_KEY = 'pageDesigner'

const savedPayload = ref<PageDesignerPayload>({
  widgets: [],
  orientation: PageOrientation.PORTRAIT,
  pageType: PageType.LETTER,
})

const row = ref<Row>()

provide(PageDesignerPayloadInj, savedPayload)
provide(PageDesignerRowInj, row)

const meta = ref<TableType>()

const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) || meta.value?.columns?.[0] || null)

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
      <div v-if="!fullscreen" class="flex flex-col gap-2">
        <div class="p-3 flex">
          <TableAndViewPicker />
        </div>
        <div class="p-3 flex">
          <NRecordPicker
            v-if="savedPayload.selectedTableId"
            :key="savedPayload.selectedTableId + savedPayload.selectedViewId"
            v-model:model-value="row"
            :label="row ? row[displayField?.title ?? ''] : 'Select record'"
            :table-id="savedPayload.selectedTableId"
            :view-id="savedPayload.selectedViewId"
            class="w-full"
          />
        </div>
      </div>
      <PageEditor v-else />
    </div>
  </ExtensionsExtensionWrapper>
</template>
