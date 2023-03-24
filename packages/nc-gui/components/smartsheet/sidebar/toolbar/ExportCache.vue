<script setup lang="ts">
import { iconMap, message, useApi, useI18n } from '#imports'

const { t } = useI18n()

const { api } = useApi()

async function exportCache() {
  const FileSaver = await import('file-saver')

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

    <component :is="iconMap.export" class="cursor-pointer" @click="exportCache" />
  </a-tooltip>
</template>
