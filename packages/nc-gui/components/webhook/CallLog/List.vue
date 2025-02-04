<script setup lang="ts">
import type { HookLogType } from 'nocodb-sdk'
import {hookLogFormatter} from "../../../utils/datetimeUtils";

interface Props {
  hookLogs: HookLogType[]
  activeItem: HookLogType
}

interface Emit {
  'update:activeItem': (hookLog: HookLogType) => void
}

defineProps<Props>()

const emit = defineEmits<Emit>()
</script>

<template>
  <div class="container">
    <template v-for="(log, i) of hookLogs" :key="log.id">
      <a-divider v-if="i" class="!my-0" />
      <div
        class="item"
        :class="{
          active: activeItem === log,
        }"
        @click="emit('update:activeItem', log)"
      >
        <div class="icon-wrapper">
          <GeneralIcon v-if="log.error" icon="ncAlertCircleFilled"></GeneralIcon>
          <GeneralIcon v-else icon="checkFill" class="text-white"></GeneralIcon>
        </div>
        <div class="flex flex-col">
          <h4 class="font-weight-bold">{{ hookLogFormatter(log.created_at) }}</h4>
          <span v-if="log.error">Failed in {{ log.execution_time }} ms</span>
          <span v-else>Succeeded in {{ log.execution_time }} ms</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-2 h-full overflow-auto;

  .item {
    @apply cursor-pointer flex gap-3 p-3 rounded-lg;
    &:hover {
      @apply bg-gray-50;
    }
    &.active {
      @apply bg-[#F0F3FF];
    }
  }
}
</style>
