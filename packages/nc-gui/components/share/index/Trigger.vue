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

const isOpen = ref(false)

const isVisible = computed(() => {
  if (isPublic.value || isSharedBase.value || isMobileMode.value) return false
  if (!isUIAllowed('viewShare')) return false
  // Private bases only allow Form view sharing
  if (isPrivateBase.value && activeView.value?.type !== ViewTypes.FORM) return false
  return true
})
</script>

<template>
  <NcDropdown
    v-if="isVisible"
    v-model:visible="isOpen"
    placement="bottomRight"
    overlay-class-name="nc-share-view-popover-overlay"
    :overlay-style="{ width: '420px', minWidth: '420px' }"
  >
    <NcButton
      v-e="['c:toolbar:share']"
      class="nc-toolbar-btn nc-share-view-trigger !h-7"
      size="small"
      type="secondary"
      data-testid="nc-toolbar-share-view-btn"
    >
      <div class="flex items-center gap-1">
        <GeneralIcon :icon="activeView?.uuid ? 'ncGlobe' : 'share'" class="!h-4 !w-4" />
        <span v-if="!isToolbarIconMode">{{ $t('activity.share') }}</span>
      </div>
    </NcButton>

    <template #overlay>
      <ShareView v-if="isOpen" />
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-share-view-popover-overlay {
  @apply !p-0;

  .ant-dropdown-menu {
    @apply !p-0;
  }
}
</style>
