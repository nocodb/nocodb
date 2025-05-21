<script setup lang="ts">
interface Props {
  disabled?: boolean
  isViewToolbar?: boolean
}

const { disabled, isViewToolbar } = defineProps<Props>()

const { isMobileMode, getMainUrl } = useGlobal()

const { visibility, showShareModal } = storeToRefs(useShare())

const { activeTable } = storeToRefs(useTablesStore())

const { base, isSharedBase } = storeToRefs(useBase())

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const route = useRoute()

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

const copySharedBase = async () => {
  const baseUrl = getMainUrl()
  window.open(`${baseUrl || ''}#/copy-shared-base?base=${route.params.baseId}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div
    v-if="!isSharedBase && isUIAllowed('baseShare') && visibility !== 'hidden' && (activeTable || base)"
    class="nc-share-base-button flex flex-col justify-center"
    data-testid="share-base-button"
    :data-sharetype="visibility"
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
      :disabled="disabled"
      @click="showShareModal = true"
    >
      <div v-if="!isMobileMode" class="flex flex-row items-center w-full gap-x-1">
        <MaterialSymbolsPublic v-if="visibility === 'public'" class="h-3.5" />
        <MaterialSymbolsLockOutline v-else-if="visibility === 'private'" class="h-3.5" />
        <div class="flex">{{ $t('activity.share') }}</div>
      </div>
      <GeneralIcon v-else icon="mobileShare" />
    </NcButton>
  </div>

  <template v-else-if="isSharedBase">
    <div class="flex-1"></div>
    <div class="flex flex-col justify-center h-full">
      <div class="flex flex-row items-center w-full">
        <NcButton
          class="z-10 !rounded-lg !px-2 !bg-[#ff133e]"
          size="small"
          type="primary"
          :disabled="disabled"
          @click="copySharedBase"
        >
          <GeneralIcon class="mr-1" icon="duplicate" />
          Copy Base
        </NcButton>
      </div>
    </div>
  </template>

  <LazyDlgShareAndCollaborateView :is-view-toolbar="isViewToolbar" />
</template>
