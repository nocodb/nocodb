<script setup lang="ts">
const { orderedGroups } = useBookmarks()

const {
  isEditing,
  selectionCount,
  hasSelection,
  singleSelectedBookmark,
  exit,
  bulkDelete,
  bulkMoveToGroup,
  openSingleSelected,
  openAllInNewTab,
} = useBookmarkEdit()

const showSingleOnlyActions = computed(() => !!singleSelectedBookmark.value)

// Move-to destinations:
//  - single bookmark → every group except its current one (Ungrouped stays
//    available, since moving back to Ungrouped is a real workflow)
//  - multi-select → all groups (some bookmarks may live in different folders,
//    so we don't try to compute a "common source" to exclude)
const moveToGroups = computed(() => {
  if (showSingleOnlyActions.value) {
    const current = singleSelectedBookmark.value?.fk_group_id
    return orderedGroups.value.filter((g) => g.id !== current)
  }
  return orderedGroups.value
})
</script>

<template>
  <div v-if="isEditing" class="nc-bookmark-action-bar">
    <NcButton
      type="text"
      size="small"
      class="!rounded-md !px-1"
      data-testid="nc-bookmark-edit-exit"
      @click="exit('close-button')"
    >
      <GeneralIcon icon="close" class="text-nc-content-gray-muted" />
    </NcButton>

    <span class="nc-bookmark-action-bar-count" data-testid="nc-bookmark-edit-selection-count">
      {{ selectionCount }} {{ $t('general.selected') }}
    </span>

    <span class="grow" />

    <NcDropdown :disabled="!hasSelection" placement="topRight" overlay-class-name="nc-bookmark-bulk-more-dropdown">
      <NcButton type="text" size="small" class="!rounded-md" :disabled="!hasSelection" data-testid="nc-bookmark-bulk-more">
        <GeneralIcon icon="ncMoreVertical" class="text-nc-content-gray-muted" />
      </NcButton>

      <template #overlay>
        <NcMenu variant="small">
          <!-- Move to: works for single or multi-selection (each selected
               bookmark moves to the picked folder). Level-1 grouping rules
               out moving folders themselves, so a folder being in the
               selection just means its bookmarks come along. -->
          <NcSubMenu
            key="move-to"
            variant="small"
            popup-class-name="nc-bookmark-bulk-move-popup"
            data-testid="nc-bookmark-bulk-move"
            class="nc-bookmark-bulk-more-dropdown-move-to"
          >
            <template #title>
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="ncMove" class="w-4 h-4" />
                {{ $t('labels.moveTo') }} ({{ selectionCount }})
              </div>
            </template>
            <NcMenuItem
              v-for="g in moveToGroups"
              :key="g.id"
              :data-testid="`nc-bookmark-bulk-move-${g.id}`"
              @click="bulkMoveToGroup(g.id!)"
            >
              <div class="flex gap-2 items-center min-w-0">
                <GeneralIcon
                  icon="ncFolder"
                  class="w-4 h-4 flex-none"
                  :style="parseProp(g?.meta).iconColor ? { color: parseProp(g?.meta).iconColor } : undefined"
                />
                <span class="truncate">{{ g.name }}</span>
              </div>
            </NcMenuItem>
          </NcSubMenu>

          <NcMenuItem :disabled="!showSingleOnlyActions" data-testid="nc-bookmark-bulk-open" @click="openSingleSelected">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="ncArrowRight" class="w-4 h-4" />
              {{ $t('general.open') }}
            </div>
          </NcMenuItem>

          <NcMenuItem :disabled="!showSingleOnlyActions" data-testid="nc-bookmark-bulk-open-new-tab" @click="openAllInNewTab">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="openInNew" class="w-4 h-4" />
              {{ $t('labels.openInNewTab') }}
            </div>
          </NcMenuItem>

          <NcDivider />

          <NcMenuItem data-testid="nc-bookmark-bulk-delete" class="!text-nc-content-red-dark" @click="bulkDelete">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="delete" class="w-4 h-4" />
              {{ $t('general.delete') }} ({{ selectionCount }})
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-action-bar {
  @apply flex-none flex items-center gap-1 px-2 py-1.5 border-t-1 border-nc-border-gray-medium;
}
.nc-bookmark-action-bar-count {
  @apply text-bodySm text-nc-content-gray-muted ml-1;
}
.grow {
  flex: 1;
}
</style>

<style lang="scss">
/* Cap the "Move to" submenu's height so a large folder list scrolls
   instead of overflowing the viewport. Unscoped because the submenu
   popup is portal-rendered. Mirrors ItemContextMenu's submenu style. */
.nc-bookmark-bulk-move-popup .ant-dropdown-menu {
  @apply nc-scrollbar-thin min-w-42;
  max-height: 320px;
}
</style>
