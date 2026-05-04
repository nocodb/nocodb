<script setup lang="ts">
import type { BookmarkReqType } from 'nocodb-sdk'

interface Props {
  targetType: string
  targetId: string
  meta?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  meta: () => ({}),
})

const { targetType, targetId, meta } = toRefs(props)

const { blockBookmarks } = useEeConfig()

const { isBookmarked, addBookmark, removeBookmarkByTarget } = useBookmarks()

const bookmarked = computed(() => isBookmarked(targetType.value, targetId.value, meta.value))

async function onClick() {
  if (bookmarked.value) {
    await removeBookmarkByTarget(targetType.value, targetId.value, meta.value)
  } else {
    await addBookmark({
      target_type: targetType.value,
      target_id: targetId.value,
      meta: meta.value,
    } as BookmarkReqType)
  }
}
</script>

<template>
  <NcMenuItem v-if="!blockBookmarks" @click="onClick">
    <div class="flex gap-2 items-center">
      <GeneralIcon
        :icon="bookmarked ? 'ncBookmarkSolid' : 'ncBookmark'"
        :class="bookmarked ? 'text-nc-content-brand' : 'opacity-80'"
      />
      {{ bookmarked ? $t('labels.removeFromBookmarks') : $t('labels.addToBookmarks') }}
    </div>
  </NcMenuItem>
</template>
