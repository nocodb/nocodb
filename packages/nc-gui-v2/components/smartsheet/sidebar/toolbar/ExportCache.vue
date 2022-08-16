<script setup lang="ts">
import { message } from 'ant-design-vue'
import FileSaver from 'file-saver'

const { api } = useApi()

async function exportCache() {
  try {
    const data = await api.utils.cacheGet()
    if (!data) {
      message.info('Cache is empty')
      return
    }
    const blob = new Blob([JSON.stringify(data)], {
      type: 'text/plain;charset=utf-8',
    })
    FileSaver.saveAs(blob, 'cache_exported.json')
    message.info('Exported Cache Successfully')
  } catch (e: any) {
    message.error(e.message)
  }
}
</script>

<template>
  <!-- Export Cache -->
  <a-tooltip placement="bottom">
    <template #title>
      <span> Export Cache </span>
    </template>
    <mdi-export class="cursor-pointer" @click="exportCache" />
  </a-tooltip>
</template>
