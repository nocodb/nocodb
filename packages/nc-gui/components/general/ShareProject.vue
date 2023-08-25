<script setup lang="ts">
import { isDrawerOrModalExist, isMac, useNuxtApp } from '#imports'

interface Props {
  disabled?: boolean
  isViewToolbar?: boolean
}

const { disabled, isViewToolbar } = defineProps<Props>()

const { visibility, showShareModal } = storeToRefs(useShare())

const { activeTable } = storeToRefs(useTablesStore())
const { project } = storeToRefs(useProject())

const { $e } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          showShareModal.value = true
        }
        break
      }
    }
  }
})
</script>

<template>
  <div
    v-if="isUIAllowed('shareProject') && visibility !== 'hidden' && (activeTable || project)"
    class="flex flex-col justify-center h-full"
    data-testid="share-project-button"
    :data-sharetype="visibility"
  >
    <NcButton size="small" class="z-10 !rounded-lg !px-2" type="primary" :disabled="disabled" @click="showShareModal = true">
      <div class="flex flex-row items-center w-full gap-x-1">
        <MaterialSymbolsPublic v-if="visibility === 'public'" class="h-3.5" />
        <MaterialSymbolsLockOutline v-else-if="visibility === 'private'" class="h-3.5" />
        <div class="flex">{{ $t('activity.share') }}</div>
      </div>
    </NcButton>
  </div>

  <LazyDlgShareAndCollaborateView :is-view-toolbar="isViewToolbar" />
</template>

<style lang="scss">
.share-status-tootltip {
  .ant-tooltip-inner {
    @apply !rounded-md !border-1 !border-gray-200;
  }
}
</style>
