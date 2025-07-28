<script setup lang="ts">
import type { HookLogType, PaginatedType } from 'nocodb-sdk'
import { hookLogFormatter } from '../../../utils/datetimeUtils'

interface Props {
  hookLogs: HookLogType[]
  activeItem: HookLogType
  logPaginationData: PaginatedType
}

interface Emit {
  'update:activeItem': (hookLog: HookLogType) => void
  'reload': () => void
  'pageSizeChange': (pageSize: number) => void
  'pageChange': (page: number) => void
}

defineProps<Props>()

const emit = defineEmits<Emit>()
</script>

<template>
  <div class="container">
    <template v-for="(log, i) of hookLogs" :key="log.id">
      <div
        class="item"
        :class="{
          active: activeItem === log,
        }"
        @click="emit('update:activeItem', log)"
      >
        <div class="icon-wrapper flex children:flex-none">
          <GeneralIcon v-if="log.error" icon="alertTriangleSolid" class="h-5 w-5 text-nc-content-red-dark"></GeneralIcon>
          <GeneralIcon v-else icon="checkFill" class="text-white h-5 w-5"></GeneralIcon>
        </div>
        <div class="flex flex-col">
          <h4 class="font-bold">
            {{ hookLogFormatter(log.created_at) }}
          </h4>
          <span class="text-nc-content-gray-subtle2 text-small1">
            <template v-if="log.error"> Error occurred {{ log.error_code ?? '' }}</template>
            <template v-else> Executed in {{ log.execution_time }} ms </template>
          </span>
        </div>
      </div>
      <a-divider
        class="!my-0"
        :class="{
          invisible: activeItem === log || (i < hookLogs.length - 1 && hookLogs[i + 1] === activeItem),
        }"
      />
    </template>
    <div class="flex flex-col items-center gap-2 flex-1 justify-end pt-2">
      <NcPaginationV2
        :current="logPaginationData.page"
        :page-size="logPaginationData.pageSize"
        :total="+logPaginationData.totalRows"
        variant="v2"
        @update:page-size="emit('pageSizeChange', $event)"
        @update:current="emit('pageChange', $event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-2 h-full overflow-auto nc-scrollbar-thin flex flex-col;

  .item {
    @apply cursor-pointer flex gap-2 p-3 rounded-lg;
    @apply hover:bg-nc-bg-gray-extralight;
    &.active {
      @apply bg-nc-bg-brand;

      h4 {
        @apply text-brand-600;
        font-weight: bold;
      }
    }
  }
}
</style>
