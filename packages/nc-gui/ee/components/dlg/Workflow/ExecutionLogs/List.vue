<script setup lang="ts">
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

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

const formatRelativeTime = (date: string) => {
  return dayjs(date).fromNow()
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return 'checkFill'
    case 'error':
      return 'alertTriangleSolid'
    case 'in_progress':
      return 'loading'
    default:
      return 'info'
  }
}

const getIconClass = (status: string) => {
  switch (status) {
    case 'success':
      return 'text-white'
    case 'error':
      return 'text-nc-content-red-dark'
    case 'in_progress':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

const formatDuration = (startedAt: string, finishedAt?: string) => {
  if (!finishedAt) return 'Running...'
  const start = dayjs(startedAt)
  const end = dayjs(finishedAt)
  const duration = end.diff(start, 'millisecond')
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`
  return `${(duration / 60000).toFixed(2)}m`
}
</script>

<template>
  <div ref="scrollContainer" class="container">
    <template v-for="(execution, i) of executions" :key="execution.id">
      <div
        class="item"
        :class="{
          active: activeItem === execution,
        }"
        @click="emit('update:activeItem', execution)"
      >
        <div class="icon-wrapper flex children:flex-none">
          <GeneralIcon :icon="getStatusIcon(execution.status)" :class="getIconClass(execution.status)" class="h-5 w-5" />
        </div>
        <div class="flex flex-col">
          <h4 class="font-bold">
            {{ formatRelativeTime(execution.created_at) }}
          </h4>
          <span class="text-nc-content-gray-subtle2 text-small1">
            <template v-if="execution.status === 'error'">
              Error occurred
            </template>
            <template v-else-if="execution.finished_at">
              Executed in {{ formatDuration(execution.started_at, execution.finished_at) }}
            </template>
            <template v-else> In progress... </template>
          </span>
        </div>
      </div>
      <a-divider
        class="!my-0"
        :class="{
          invisible: activeItem === execution || (i < executions.length - 1 && executions[i + 1] === activeItem),
        }"
      />
    </template>
    <div v-if="hasMore" class="flex flex-col items-center gap-2 py-4">
      <a-spin v-if="isLoadingMore" size="small" />
    </div>

    <div v-else-if="executions.length > 0" class="flex flex-col items-center gap-2 py-4">
      <span class="text-nc-content-gray-subtle2 text-small1">No more executions</span>
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
        @apply text-nc-content-brand-disabled;
        font-weight: bold;
      }
    }
  }
}
</style>
