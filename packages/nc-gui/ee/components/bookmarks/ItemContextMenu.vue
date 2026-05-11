<script setup lang="ts">
/**
 * Renders the kebab + dropdown menu for a bookmark item. Parent owns layout — it places the kebab
 * via `<BookmarksItemContextMenu ref="..." />` and forwards right-click via the exposed open().
 */
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

interface Props {
  bookmark: BookmarkType
  groups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { bookmark, groups } = toRefs(props)

const { removeBookmark, moveBookmarkToGroup, navigateToBookmark } = useBookmarks()

const isOpen = ref(false)

const otherGroups = computed(() => groups.value.filter((g) => g.id !== bookmark.value.fk_group_id))

defineExpose({
  open() {
    isOpen.value = true
  },
})

function onRemove() {
  removeBookmark(bookmark.value.id!)
  isOpen.value = false
}

async function onMoveTo(groupId: string) {
  await moveBookmarkToGroup(bookmark.value.id!, groupId)
  isOpen.value = false
}

function onOpenInNewTab() {
  isOpen.value = false
  // navigateToBookmark already fires a:bookmark:open with in_new_tab: true.
  navigateToBookmark(bookmark.value, { inNewTab: true })
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" :trigger="['click']" placement="bottomRight" overlay-class-name="nc-bookmark-context-menu">
    <NcButton
      type="text"
      size="xxsmall"
      class="nc-bookmark-item-kebab !rounded-md flex-none"
      :class="{ '!opacity-100': isOpen }"
      data-testid="nc-bookmark-item-kebab"
      @click.stop
    >
      <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
    </NcButton>
    <template #overlay>
      <NcMenu variant="small">
        <template v-if="otherGroups.length">
          <NcSubMenu key="moveTo" variant="small" popup-class-name="nc-bookmark-move-to-popup">
            <template #title>
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="ncMove" class="w-4 h-4" />
                {{ $t('labels.moveTo') }}
              </div>
            </template>
            <NcMenuItem
              v-for="group in otherGroups"
              :key="group.id"
              data-testid="nc-bookmark-move-to-group"
              @click="onMoveTo(group.id!)"
            >
              <div v-e="['c:bookmark:move']" class="flex gap-2 items-center">
                <GeneralIcon
                  icon="ncFolder"
                  class="w-4 h-4"
                  :style="parseProp(group?.meta).iconColor ? { color: parseProp(group?.meta).iconColor } : undefined"
                />
                {{ group.name }}
              </div>
            </NcMenuItem>
          </NcSubMenu>
          <NcDivider />
        </template>
        <NcMenuItem data-testid="nc-bookmark-open-new-tab" @click="onOpenInNewTab">
          <div v-e="['c:bookmark:open-new-tab']" class="flex gap-2 items-center">
            <GeneralIcon icon="openInNew" class="w-4 h-4" />
            {{ $t('labels.openInNewTab') }}
          </div>
        </NcMenuItem>
        <NcDivider />
        <NcMenuItem data-testid="nc-bookmark-remove" class="!text-nc-content-red-dark" @click="onRemove">
          <div v-e="['c:bookmark:remove']" class="flex gap-2 items-center">
            <GeneralIcon icon="delete" class="w-4 h-4" />
            {{ $t('labels.removeFromBookmarks') }}
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
/* Cap the "Move to" submenu's height so a large folder list scrolls
   instead of overflowing the viewport. Unscoped because the submenu
   popup is portal-rendered. */
.nc-bookmark-move-to-popup .ant-dropdown-menu {
  @apply nc-scrollbar-thin min-w-42;
  max-height: 320px;
}
</style>
