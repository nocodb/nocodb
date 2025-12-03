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
        <GeneralIcon :icon="getStatusIcon(execution.status)" class="h-5 w-5 text-base-white" />

        <div class="ml-2">Run {{ execution.id }}</div>

        <div class="flex-1" />

        <div class="text-body text-nc-content-gray-muted">
          {{ dayjs(execution.started_at).fromNow() }}
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
