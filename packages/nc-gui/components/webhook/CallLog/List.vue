<script setup lang="ts">
import type {HookLogType} from "nocodb-sdk";

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
    <div v-for="log of hookLogs" :key="log.id" @click="emit('update:activeItem', log)" class="flex gap-3">
      <div class="icon-wrapper">
        <GeneralIcon v-if="log.error" icon="checkFill" class=""></GeneralIcon>
        <GeneralIcon v-else icon="checkFill" class=""></GeneralIcon>
      </div>
      <div class="flex flex-col">
        <h4 class="font-weight-bold">{{ log.created_at }}</h4>
        <span>Succeeded in {{ log.execution_time }} ms</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-2;

  .icon-wrapper {
    @apply pt-1;
  }
}
</style>
