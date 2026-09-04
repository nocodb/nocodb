<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { isSharedBase, isPrivateBase } = storeToRefs(useBase())

const isPublic = inject(IsPublicInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { view: activeView } = useSmartsheetStoreOrThrow()

const { t } = useI18n()

const isOpen = ref(false)

const isVisible = computed(() => {
  if (isPublic.value || isSharedBase.value || isMobileMode.value) return false
  if (!isUIAllowed('viewShare')) return false
  // Private bases only allow Form view sharing
  if (isPrivateBase.value && activeView.value?.type !== ViewTypes.FORM) return false
  return true
})

const triggerLabel = computed(() =>
  activeView.value?.type === ViewTypes.FORM ? t('activity.shareForm') : t('activity.shareView'),
)
</script>

<template>
  <div v-if="isVisible" class="nc-share-view-trigger-wrapper flex-none flex flex-col justify-center">
    <NcDropdown
      v-model:visible="isOpen"
      placement="bottomRight"
      overlay-class-name="nc-share-view-popover-overlay"
      :overlay-style="{ width: '420px' }"
    >
      <NcButton
        v-e="['c:toolbar:share']"
        class="nc-toolbar-btn nc-share-view-trigger !border-0 !h-7"
        :class="{
          '!bg-nc-bg-purple-light !hover:bg-nc-bg-purple-dark !text-nc-content-purple-dark': !!activeView?.uuid,
        }"
        size="small"
        type="secondary"
        data-testid="nc-toolbar-share-view-btn"
      >
        <div class="flex items-center gap-1 pointer-events-none">
          <GeneralIcon icon="ncExternalLink" class="!h-4 !w-4" />
          <span v-if="!isToolbarIconMode">{{ triggerLabel }}</span>
        </div>
      </NcButton>

      <template #overlay>
        <ShareView v-if="isOpen" />
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss">
.nc-share-view-popover-overlay {
  @apply !p-0;
}
</style>
