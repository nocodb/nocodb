<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'
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
  <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_BOOKMARKS">
    <template #default="{ click }">
      <NcMenuItem @click="click(PlanFeatureTypes.FEATURE_BOOKMARKS, onClick)">
        <div class="w-full flex items-center gap-2">
          <GeneralIcon
            :icon="bookmarked ? 'ncBookmarkSolid' : 'ncBookmark'"
            :class="bookmarked ? 'text-nc-content-brand' : 'opacity-80'"
          />
          <span class="flex-1">{{ bookmarked ? $t('labels.removeFromBookmarks') : $t('labels.addToBookmarks') }}</span>
          <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_BOOKMARKS" show-as-lock/>
        </div>
      </NcMenuItem>
    </template>
  </PaymentUpgradeBadgeProvider>
</template>
