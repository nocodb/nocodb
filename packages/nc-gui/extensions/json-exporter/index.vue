<script setup lang="ts">
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const { tables, getViewsForTable, getData } = useExtensionHelperOrThrow()

const views = ref<ViewType[]>([])

const exportPayload = ref<{
  tableId?: string
  viewId?: string
}>({})

const tableList = computed(() => {
  return tables.value.map((table) => {
    return {
      label: table.title,
      value: table.id,
    }
  })
})

const viewList = computed(() => {
  if (!exportPayload.value.tableId) return []
  return (
    views.value
      .filter((view) => view.type === ViewTypes.GRID)
      .map((view) => {
        return {
          label: view.is_default ? `Default` : view.title,
          value: view.id,
        }
      }) || []
  )
})

const reloadViews = async () => {
  if (exportPayload.value.tableId) {
    views.value = await getViewsForTable(exportPayload.value.tableId)
    exportPayload.value.viewId = views.value.find((view) => view.is_default)?.id
  }
}

const exportJson = async () => {
  if (!exportPayload.value.tableId || !exportPayload.value.viewId) return

  // TODO: implement full data export
  const data = await getData({
    tableId: exportPayload.value.tableId,
    viewId: exportPayload.value.viewId,
  })

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <NcSelect v-model:value="exportPayload.tableId" :options="tableList" @change="reloadViews" />
    <NcSelect v-model:value="exportPayload.viewId" :options="viewList" />
    <NcButton @click="exportJson">Export</NcButton>
  </div>
</template>

<style lang="scss"></style>
