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

  const allData: Record<string, any>[] = []

  getData({
    tableId: exportPayload.value.tableId,
    viewId: exportPayload.value.viewId,
    eachPage: (records, nextPage) => {
      allData.push(...records)
      nextPage()
    },
    done: () => {
      const json = JSON.stringify(allData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const table = tables.value.find((table) => table.id === exportPayload.value.tableId)
      const view = views.value.find((view) => view.id === exportPayload.value.viewId)

      if (table && view) {
        a.download = `${table.title} - ${view.is_default ? 'Default' : view.title}.json`
      } else {
        a.download = 'data.json'
      }

      a.href = url

      a.click()
      URL.revokeObjectURL(url)
    },
  })
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
