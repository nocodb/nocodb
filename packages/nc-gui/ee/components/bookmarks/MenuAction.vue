<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import type { BookmarkReqType } from 'nocodb-sdk'

interface Props {
  targetType: string
  targetId: string
  meta?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  meta: () => ({}),
})

const emits = defineEmits<{
  (e: 'close'): void
}>()

const { targetType, targetId, meta } = toRefs(props)

const { isBookmarked, addBookmark, removeBookmarkByTarget } = useBookmarks()

const { getPlanTitle } = useEeConfig()

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
      <NcMenuItem
        @click="
          () => {
            if (click(PlanFeatureTypes.FEATURE_BOOKMARKS, onClick)) {
              emits('close')
            }
          }
        "
        inner-class="w-full"
      >
        <div class="w-full flex items-center gap-2">
          <GeneralIcon
            :icon="bookmarked ? 'ncBookmarkSolid' : 'ncBookmark'"
            :class="bookmarked ? 'text-nc-content-brand' : 'opacity-80'"
          />
          <span class="flex-1">{{ bookmarked ? $t('labels.removeFromBookmarks') : $t('labels.addToBookmarks') }}</span>
          <LazyPaymentUpgradeBadge
            :feature="PlanFeatureTypes.FEATURE_BOOKMARKS"
            :title="$t('upgrade.upgradeToUseBookmarks')"
            :content="
              $t('upgrade.upgradeToUseBookmarksSubtitle', {
                plan: getPlanTitle(PlanTitles.PLUS),
              })
            "
            show-as-lock
            remove-click
          />
        </div>
      </NcMenuItem>
    </template>
  </PaymentUpgradeBadgeProvider>
</template>
