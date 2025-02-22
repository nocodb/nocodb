<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { isActionPaneActive, actionPaneSize } = useSmartsheetStoreOrThrow()

const actionPaneHeaderRef = ref<HTMLDivElement>()

const panelSize = computed(() => {
  if (isActionPaneActive.value) {
    return actionPaneSize.value
  }
  return 0
})
const isReady = ref(false)

watch(isActionPaneActive, (newValue) => {
  if (newValue && !isReady.value) {
    setTimeout(() => {
      isReady.value = true
    }, 300)
  }
})

defineExpose({
  onReady: () => {
    isReady.value = true
  },
  isReady,
})
</script>

<template>
  <Pane
    v-show="isActionPaneActive || isReady"
    :size="panelSize"
    max-size="60%"
    class="nc-action-log-pane"
    :style="
      !isReady
        ? {
            maxWidth: `${actionPaneSize}%`,
          }
        : {}
    "
  >
    <Transition name="layout" :duration="150">
      <div v-show="isActionPaneActive" class="flex flex-col h-full">
        <div
          ref="actionPaneHeaderRef"
          class="h-[var(--toolbar-height)] flex items-center justify-between gap-3 px-4 py-2 border-b-1 border-gray-200 bg-white"
        >
          <div class="flex items-center gap-3 font-weight-700 text-nc-content-gray-emphasis text-base">
            <GeneralIcon icon="ncAiPlay" class="h-5 w-5 stroke-none text-content-gray-subtle opacity-85" />
            <span>{{ $t('labels.actionLogs') }}</span>
          </div>

          <NcButton type="text" size="small">
            <GeneralIcon icon="ncChevronsRight" class="text-nc-content-gray-subtle" @click="isActionPaneActive = false" />
          </NcButton>
        </div>

        <!-- here the conyent woll comes -->
      </div>
    </Transition>
  </Pane>
</template>

<style scoped lang="scss">
.nc-action-log-pane {
  @apply flex flex-col bg-gray-50 rounded-l-xl border-1 border-gray-200 z-30 -mt-1px;

  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
