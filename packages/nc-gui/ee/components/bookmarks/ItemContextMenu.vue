<script setup lang="ts">
import type { BookmarkType, BookmarkGroupType } from 'nocodb-sdk'

interface Props {
  bookmark: BookmarkType
  groups: BookmarkGroupType[]
}

const props = defineProps<Props>()

const { bookmark, groups } = toRefs(props)

const { removeBookmark, moveBookmarkToGroup } = useBookmarks()

const isOpen = ref(false)

const otherGroups = computed(() =>
  groups.value.filter((g) => g.id !== bookmark.value.fk_group_id),
)

function onRemove() {
  removeBookmark(bookmark.value.id!)
  isOpen.value = false
}

async function onMoveTo(groupId: string) {
  await moveBookmarkToGroup(bookmark.value.id!, groupId)
  isOpen.value = false
}

function open() {
  isOpen.value = true
}

</script>

<template>
  <NcDropdown v-model:visible="isOpen" :trigger="['contextmenu']" placement="bottomRight" overlay-class-name="nc-bookmark-context-menu">
    <slot :open="open" :is-open="isOpen" />
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
