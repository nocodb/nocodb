<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { type TableType, type ViewType, ViewTypes } from 'nocodb-sdk'

const { extension, fullscreen, getViewsForTable, getTableMeta, tables } = useExtensionHelperOrThrow()

interface PageDesignerPayload {
  selectedTableId?: string
  selectedViewId?: string
}
const KV_STORE_KEY = 'pageDesigner'

const savedPayload = ref<PageDesignerPayload>({})
const views = ref<ViewType[]>([])
const meta = ref<TableType>()

const router = useRouter()
const route = router.currentRoute

const activeTableId = computed(() => route.value.params.viewId as string | undefined)
const activeViewTitleOrId = computed(() => {
  return route.value.params.viewTitle
})

const tableList = computed(() => {
  return tables.value.map((table) => {
    return {
      label: table.title,
      value: table.id,
      meta: table.meta,
    }
  })
})

const viewList = computed(() => {
  if (!savedPayload.value.selectedTableId) return []
  return (
    views.value
      .filter((view) => view.type === ViewTypes.GRID)
      .map((view) => {
        return {
          label: view.is_default ? `Default View` : view.title,
          value: view.id,
          meta: view.meta,
          type: view.type,
        }
      }) || []
  )
})

async function saveChanges() {
  await extension.value.kvStore.set(KV_STORE_KEY, savedPayload.value)
}

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}

async function reloadViews() {
  if (!savedPayload.value.selectedTableId) return

  views.value = await getViewsForTable(savedPayload.value.selectedTableId)
}

async function updateColumns() {
  if (!savedPayload.value.selectedTableId) return
  const tableMeta = await getTableMeta(savedPayload.value.selectedTableId)
  if (tableMeta) {
    meta.value = tableMeta
  }
}

async function onTableSelect(tableId?: string) {
  if (!tableId) {
    savedPayload.value.selectedTableId = activeTableId.value
    await reloadViews()
    savedPayload.value.selectedViewId = activeViewTitleOrId.value
      ? views.value.find((view) => view.type === ViewTypes.GRID && view.id === activeViewTitleOrId.value)?.id
      : views.value.find((view) => view.is_default)?.id
  } else {
    savedPayload.value.selectedTableId = tableId
    await reloadViews()
    savedPayload.value.selectedViewId = views.value.find((view) => view.is_default)?.id
  }

  await updateColumns()

  await saveChanges()
}

const onViewSelect = async (viewId: string) => {
  savedPayload.value.selectedViewId = viewId

  await saveChanges()
}

onMounted(async () => {
  const saved = (await extension.value.kvStore.get(KV_STORE_KEY)) as PageDesignerPayload
  if (saved) savedPayload.value = saved
  await updateColumns()
  await reloadViews()
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <template v-if="fullscreen" #headerExtra>
      <NcButton> Header actions </NcButton>
    </template>
    <div
      class="bulk-update-ee h-full flex flex-col"
      :class="{
        'gap-6 bg-nc-bg-gray-extralight': fullscreen,
      }"
    >
      <div v-if="!fullscreen" class="p-3 flex">
        <div
          class="nc-bulk-update-select-wrapper flex-1 flex items-center border-1 border-nc-border-gray-medium rounded-lg relative shadow-default max-w-full"
        >
          <a-form-item class="!my-0 min-w-1/2">
            <NcSelect
              v-model:value="savedPayload.selectedTableId"
              placeholder="-select table-"
              class="nc-bulk-update-table-select nc-select-shadow"
              :filter-option="filterOption"
              dropdown-class-name="w-[250px]"
              show-search
              @change="onTableSelect"
            >
              <a-select-option v-for="table of tableList" :key="table.label" :value="table.value">
                <div class="w-full flex items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralTableIcon :meta="{ meta: table.meta }" class="text-gray-500" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ table.label }}</template>
                    <span>{{ table.label }}</span>
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="savedPayload.selectedTableId === table.value"
                    id="nc-selected-item-icon"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <a-form-item class="!my-0 min-w-1/2">
            <NcSelect
              v-model:value="savedPayload.selectedViewId"
              placeholder="-select view-"
              class="nc-bulk-update-view-select nc-select-shadow"
              dropdown-class-name="w-[250px]"
              :filter-option="filterOption"
              show-search
              placement="bottomRight"
              @change="onViewSelect"
            >
              <a-select-option v-for="view of viewList" :key="view.label" :value="view.value">
                <div class="w-full flex items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralViewIcon :meta="{ meta: view.meta, type: view.type }" class="flex-none text-gray-500" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ view.label }}</template>
                    <span>{{ view.label }}</span>
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="savedPayload.selectedViewId === view.value"
                    id="nc-selected-item-icon"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>
        </div>
      </div>
    </div>
  </ExtensionsExtensionWrapper>
</template>
