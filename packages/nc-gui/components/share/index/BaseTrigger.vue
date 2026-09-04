<script lang="ts" setup>
const { isMobileMode, getMainUrl } = useGlobal()

const { visibility, showShareModal } = storeToRefs(useShare())

const { activeTable } = storeToRefs(useTablesStore())

const { base, isSharedBase, isManagedAppMaster, isSandbox } = storeToRefs(useBase())

const { hideSharedBaseBtn } = storeToRefs(useConfigStore())

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const route = useRoute()

const isVisible = computed(() => {
  if (isSharedBase.value || isManagedAppMaster.value || isSandbox.value) return false
  if (!isUIAllowed('baseShare')) return false
  if (visibility.value === 'hidden') return false
  return !!(activeTable.value || base.value)
})

// Dropdown visibility is bridged through the global `showShareModal` store flag so
// ALT+I and other call-sites keep working.
const isOpen = computed({
  get: () => showShareModal.value,
  set: (val: boolean) => {
    showShareModal.value = val
  },
})

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          isOpen.value = true
        }
        break
      }
    }
  }
})

const copySharedBase = async () => {
  const baseUrl = getMainUrl()
  window.open(`${baseUrl || ''}/copy-shared-base?base=${route.params.baseId}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div
    v-if="isVisible"
    class="nc-share-base-button flex flex-col justify-center"
    data-testid="share-base-button"
    :data-sharetype="visibility"
  >
    <NcDropdown
      v-model:visible="isOpen"
      placement="bottomRight"
      overlay-class-name="nc-share-base-popover-overlay"
      :overlay-style="{ width: '420px', minWidth: '420px' }"
    >
      <NcButton
        v-e="['c:share:open']"
        :size="isMobileMode ? 'medium' : 'small'"
        class="z-10 !rounded-lg"
        :class="{
          '!px-2': !isMobileMode,
          '!px-0 !max-w-8.5 !min-w-8.5': isMobileMode,
        }"
        type="primary"
      >
        <div v-if="!isMobileMode" class="flex flex-row items-center w-full gap-x-1">
          <MaterialSymbolsPublic v-if="visibility === 'public'" class="h-3.5" />
          <MaterialSymbolsLockOutline v-else-if="visibility === 'private'" class="h-3.5" />
          <div class="flex">{{ $t('activity.share') }}</div>
        </div>
        <GeneralIcon v-else icon="mobileShare" />
      </NcButton>

      <template #overlay>
        <ShareBase v-if="isOpen" />
      </template>
    </NcDropdown>
  </div>

  <template v-else-if="isSharedBase && !hideSharedBaseBtn">
    <div class="flex-1"></div>
    <div class="flex flex-col justify-center h-full">
      <div class="flex flex-row items-center w-full">
        <NcButton class="z-10 !rounded-lg !px-2 !bg-[#ff133e]" size="small" type="primary" @click="copySharedBase">
          <GeneralIcon class="mr-1" icon="duplicate" />
          Copy Base
        </NcButton>
      </div>
    </div>
  </template>
</template>

<style lang="scss">
.nc-share-base-popover-overlay {
  @apply !p-0;
}
</style>
