<script setup lang="ts">
/**
 * Renders the kebab + dropdown menu for a bookmark item. Parent owns layout — it places the kebab
 * via `<BookmarksV2ItemContextMenu ref="..." />` and forwards right-click via the exposed open().
 */
import type { BookmarkType, BookmarkGroupType } from 'nocodb-sdk'

interface Props {
  bookmark: BookmarkType
  groups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { bookmark, groups } = toRefs(props)

const { removeBookmark, moveBookmarkToGroup } = useBookmarks()

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
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    :trigger="['click']"
    placement="bottomRight"
    overlay-class-name="nc-bookmark-context-menu"
  >
    <NcButton
      type="text"
      size="xxsmall"
      class="nc-v2-item-kebab !rounded-md flex-none"
      :class="{ '!opacity-100': isOpen }"
      data-testid="nc-bookmark-item-kebab"
      @click.stop
    >
      <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
    </NcButton>
    <template #overlay>
      <NcMenu variant="small">
        <template v-if="otherGroups.length">
          <NcSubMenu key="moveTo">
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
                <GeneralIcon icon="ncFolder" class="w-4 h-4" />
                {{ group.name }}
              </div>
            </NcMenuItem>
          </NcSubMenu>
          <NcDivider />
        </template>
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
