<script lang="ts" setup>
import type { Card as AntCard } from 'ant-design-vue'

const progress = ref<Record<string, any>[]>([])

const logRef = ref<typeof AntCard>()

const autoScroll = ref(true)

const scrollToBottom = () => {
  const container: HTMLDivElement = logRef.value?.$el?.firstElementChild
  if (!container) return
  container.scrollTop = container.scrollHeight
}

const pushProgress = (message: string, status: JobStatus | 'progress') => {
  if (!message?.trim()) return
  progress.value.push({ msg: message, status })

  if (autoScroll.value) {
    nextTick(scrollToBottom)
  }
}

const onUserScroll = (e: Event) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLDivElement

  // If user is not at the bottom, disable auto-scroll
  autoScroll.value = scrollTop + clientHeight >= scrollHeight - 10
}

function downloadLogs(filename: string) {
  let text = ''
  for (const { msg } of progress.value) {
    text += `${msg}\n`
  }

  const element = document.createElement('a')
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`)
  element.setAttribute('download', filename)

  element.style.display = 'none'
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}

const progressEnd = computed(() =>
  [JobStatus.FAILED, JobStatus.COMPLETED].includes(progress.value[progress.value.length - 1]?.status),
)

useEventListener(() => logRef.value?.$el?.firstElementChild, 'scroll', onUserScroll, {
  passive: true,
})

defineExpose({
  pushProgress,
})

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <a-card
    ref="logRef"
    :body-style="{
      'overflow': 'auto',
      'width': '100%',
      'height': '100%',
      'backgroundColor': '#101015',
      'borderRadius': '0.5rem',
      'padding': '16px !important',
      'scrollbar-color': 'var(--scrollbar-thumb) var(--scrollbar-track)',
      'scrollbar-width': 'thin',
      '--scrollbar-thumb': '#E7E7E9',
      '--scrollbar-track': 'transparent',
    }"
  >
    <div v-for="({ msg, status }, i) in progress" :key="i">
      <div v-if="status === JobStatus.FAILED" class="flex items-center">
        <component :is="iconMap.closeCircle" class="text-red-500" />

        <span class="text-red-500 ml-2">{{ msg }}</span>
      </div>

      <div v-else class="flex items-center">
        <MdiCurrencyUsd class="text-green-500" />

        <span class="text-green-500 ml-2">{{ msg }}</span>
      </div>
    </div>

    <div v-if="!progressEnd" class="flex items-center">
      <component :is="iconMap.loading" class="text-green-500 animate-spin" />
      <span class="text-green-500 ml-2">Loading...</span>
    </div>

    <a-button
      v-if="progressEnd"
      class="!absolute z-1 right-2 bottom-2 opacity-75 hover:opacity-100 !rounded-md !w-8 !h-8"
      size="small"
      @click="downloadLogs('logs.txt')"
    >
      <nc-tooltip>
        <template #title>Download Logs</template>
        <component :is="iconMap.download" />
      </nc-tooltip>
    </a-button>
  </a-card>
</template>

<style lang="scss" scoped>
.nc-progress-panel {
  @apply p-6 flex-1 flex justify-center;
}
</style>

<style lang="scss">
.nc-modal-create-source {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
}

.nc-dropdown-ext-db-type {
  @apply !z-1000;
}
</style>
