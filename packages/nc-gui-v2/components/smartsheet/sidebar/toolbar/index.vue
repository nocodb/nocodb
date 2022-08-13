<script lang="ts" setup>
import FileSaver from 'file-saver'
import { message } from 'ant-design-vue'
import AddRow from './AddRow.vue'
import LockMenu from './LockMenu.vue'
import Reload from './Reload.vue'

const { isUIAllowed } = useUIPermission()

const { api } = useApi()

const debug = $ref(false)

const clickCount = $ref(0)

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

function deleteCache() {}
</script>

<template>
  <div
    class="flex gap-2"
    @click="
      () => {
        clickCount = clickCount + 1
        debug = clickCount >= 4
      }
    "
  >
    <slot name="start" />
    <div class="pt-2">
      <!-- Export Cache -->
      <a-tooltip v-if="debug">
        <template #title>
          <span class="caption"> Export Cache </span>
        </template>
        <mdi-export class="cursor-pointer mx-3" @click="exportCache" />
      </a-tooltip>

      <!-- Delete Cache -->
      <a-tooltip v-if="debug">
        <template #title>
          <span class="caption"> Delete Cache </span>
        </template>
        <mdi-delete class="cursor-pointer mx-3" @click="deleteCache" />
      </a-tooltip>

      <!-- TODO: -->
      <!-- <debug-metas v-if="debug" class="mr-3" /> -->
    </div>

    <LockMenu v-if="isUIAllowed('view-type')" />

    <div class="dot" />

    <Reload />

    <div class="dot" />

    <AddRow v-if="isUIAllowed('xcDatatableEditable')" />

    <slot name="end" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}

.dot {
  @apply w-[3px] h-[3px] bg-gray-300 rounded-full;
}
</style>
