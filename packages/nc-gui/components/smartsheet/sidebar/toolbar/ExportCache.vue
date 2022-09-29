<script setup lang="ts">
import { message } from 'ant-design-vue'
import FileSaver from 'file-saver'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { api } = useApi()

async function exportCache() {
  try {
    const data = await api.utils.cacheGet()
    if (!data) {
      // Cache is empty
      message.info(t('msg.info.cacheEmpty'))
      return
    }
    const blob = new Blob([JSON.stringify(data)], {
      type: 'text/plain;charset=utf-8',
    })
    FileSaver.saveAs(blob, 'cache_exported.json')
    // Exported Cache Successfully
    message.info(t('msg.info.exportedCache'))
  } catch (e: any) {
    message.error(e.message)
  }
}
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title>
      <span> Export Cache </span>
    </template>
    <mdi-export class="cursor-pointer" @click="exportCache" />
  </a-tooltip>
</template>
