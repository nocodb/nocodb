<script setup lang="ts">
import { type ViewType, ViewTypes } from 'nocodb-sdk'
import { PageDesignerPayloadInj } from '../lib/context'

const emit = defineEmits(['saveChanges'])

const savedPayloads = inject(PageDesignerPayloadInj)!
const views = ref<ViewType[]>([])

const { tables, getViewsForTable } = useExtensionHelperOrThrow()

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
  if (!savedPayloads.value.selectedTableId) return []
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

const router = useRouter()
const route = router.currentRoute

const activeTableId = computed(() => route.value.params.viewId as string | undefined)

const activeViewTitleOrId = computed(() => {
  return route.value.params.viewTitle
})

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}

async function reloadViews() {
  if (!savedPayloads.value.selectedTableId) return
  views.value = await getViewsForTable(savedPayloads.value.selectedTableId)
  console.log(views.value)
}

async function onTableSelect(tableId?: string) {
  if (!tableId) {
    savedPayloads.value.selectedTableId = activeTableId.value
    await reloadViews()
    savedPayloads.value.selectedViewId = activeViewTitleOrId.value
      ? views.value.find((view) => view.type === ViewTypes.GRID && view.id === activeViewTitleOrId.value)?.id
      : views.value.find((view) => view.is_default)?.id
  } else {
    savedPayloads.value.selectedTableId = tableId
    await reloadViews()
    savedPayloads.value.selectedViewId = views.value.find((view) => view.is_default)?.id
  }

  emit('saveChanges')
}

const onViewSelect = async (viewId: string) => {
  savedPayloads.value.selectedViewId = viewId

  emit('saveChanges')
}

onMounted(async () => {
  const availableTableIds = new Set(tableList.value?.map((t: { value: string }) => t.value) ?? [])
  if (savedPayloads.value.selectedTableId && !availableTableIds.has(savedPayloads.value.selectedTableId)) {
    savedPayloads.value.selectedTableId = ''
    savedPayloads.value.selectedViewId = ''
  }
  await reloadViews()
  if (!savedPayloads.value.selectedTableId && tableList.value.find((table) => table.value === activeTableId.value)) {
    onTableSelect()
  }
})
</script>

<template>
  <div class="flex-1 flex items-center rounded-lg relative max-w-full">
    <a-form-item class="!my-0 min-w-1/2 table-selector">
      <NcSelect
        v-model:value="savedPayloads.selectedTableId"
        placeholder="Select Table"
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
              v-if="savedPayloads.selectedTableId === table.value"
              id="nc-selected-item-icon"
              class="flex-none text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>
    </a-form-item>

    <a-form-item class="!my-0 min-w-1/2 view-selector">
      <NcSelect
        v-model:value="savedPayloads.selectedViewId"
        placeholder="Select View"
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
              v-if="savedPayloads.selectedViewId === view.value"
              id="nc-selected-item-icon"
              class="flex-none text-primary w-4 h-4"
            />
          </div> </a-select-option
      ></NcSelect>
    </a-form-item>
  </div>
</template>

<style lang="scss" scoped>
.table-selector {
  :deep(.ant-select-selector) {
    @apply !rounded-[8px_0_0_8px];
  }
}
.view-selector {
  :deep(.ant-select-selector) {
    @apply !rounded-[0_8px_8px_0];
  }
}
</style>
