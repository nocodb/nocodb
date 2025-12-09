<script setup lang="ts">
import dayjs from 'dayjs'
interface Props {
  executions: any[]
  activeItem: any
  hasMore: boolean
}

interface Emit {
  'update:activeItem': (execution: any) => void
  'loadMore': () => void
}

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

const scrollContainer = ref<HTMLElement | null>(null)

const { isLoading: isLoadingMore } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoadingMore.value || !props.hasMore) return
    emit('loadMore')
  },
  { distance: 10, interval: 1000 },
)

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return 'ncCheck'
    case 'error':
      return 'ncX'
    case 'running':
      return 'refresh'
    case 'skipped':
      return 'ncMinus'
    case 'pending':
      return 'ncPending'
    default:
      return 'info'
  }
}
</script>

<template>
  <div ref="scrollContainer" class="log-container">
    <template v-for="execution of executions" :key="execution.id">
      <div
        class="cursor-pointer flex items-center hover:bg-nc-bg-gray-extralight py-2 px-3"
        :class="{
          '!bg-nc-bg-brand': activeItem === execution,
        }"
        @click="emit('update:activeItem', execution)"
      >
        <div
          :class="{
            'bg-nc-green-700 dark:bg-nc-green-200': execution.status === 'completed',
            'bg-nc-red-500 dark:bg-nc-red-500': execution.status === 'error',
            'bg-nc-brand-500 dark:bg-nc-brand-500': execution.status === 'running',
            'bg-nc-gray-400 dark:bg-nc-gray-500': execution.status === 'skipped',
          }"
          class="w-5 h-5 rounded-full flex items-center justify-center flex-none"
        >
          <GeneralIcon :icon="getStatusIcon(execution.status)" class="text-base-white !w-3 !h-3" />
        </div>

        <div class="ml-2 flex flex-1 min-w-0">
          <div class="font-semibold text-sm truncate">
            {{ hookLogFormatter(execution.started_at) }}
          </div>
          <div class="flex-1" />

          <div class="text-body text-nc-content-gray-muted">
            {{ dayjs(execution.started_at).fromNow() }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.log-container {
  @apply overflow-auto;
  height: calc(100svh - (3 * var(--topbar-height)) - 10px);
}
</style>
