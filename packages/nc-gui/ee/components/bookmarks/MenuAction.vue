<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import type { BookmarkReqType, WorkspaceType } from 'nocodb-sdk'

interface Props {
  targetType: string
  targetId: string
  meta?: Record<string, any>
  /**
   * Target workspace, used when the action targets a workspace different from
   * the active one (e.g. workspace bookmarks in the home sidebar). Drives the
   * lock-badge visibility based on the target workspace's plan rather than the
   * active workspace's. The actual click gate is handled inside `addBookmark`
   * which is always per-target-workspace.
   */
  workspace?: WorkspaceType
}

const props = withDefaults(defineProps<Props>(), {
  meta: () => ({}),
})

const emits = defineEmits<{
  (e: 'close'): void
}>()

const { targetType, targetId, meta, workspace } = toRefs(props)

const { isBookmarkAllowed, isBookmarked, addBookmark, removeBookmarkByTarget } = useBookmarks()

const { isEEFeatureBlocked, getPlanTitle, getFeatureForPlanTitle } = useEeConfig()

const { baseListAllWsMap } = useWsBaseListAll()

const bookmarked = computed(() => isBookmarked(targetType.value, targetId.value, meta.value))

const targetWsPlanTitle = computed(() => {
  if (!workspace.value) return undefined
  return (
    (workspace.value as any).payment?.plan?.title ||
    baseListAllWsMap.value.get(workspace.value.id!)?.plan_title ||
    PlanTitles.FREE
  )
})

const isFeatureEnabledForTargetWs = computed(() => {
  if (!workspace.value || isEEFeatureBlocked.value) return undefined
  return getFeatureForPlanTitle(PlanFeatureTypes.FEATURE_BOOKMARKS, targetWsPlanTitle.value)
})

const targetWsFeatureEnabledCallback = computed(() => {
  if (!workspace.value || isEEFeatureBlocked.value) return undefined
  return () => !!isFeatureEnabledForTargetWs.value
})

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
  <PaymentUpgradeBadgeProvider v-if="isBookmarkAllowed" :feature="PlanFeatureTypes.FEATURE_BOOKMARKS">
    <template #default="{ click }">
      <NcMenuItem
        :data-testid="`nc-sidebar-bookmark-${targetType}`"
        inner-class="w-full"
        @click="
          () => {
            // For cross-workspace targets, defer the gate to addBookmark
            // (which checks the target workspace plan). Otherwise use the
            // active-workspace-aware BadgeProvider click.
            if (workspace && !isEEFeatureBlocked) {
              onClick()
              emits('close')
            } else if (click(PlanFeatureTypes.FEATURE_BOOKMARKS, onClick)) {
              emits('close')
            }
          }
        "
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
            :feature-enabled-callback="targetWsFeatureEnabledCallback"
            show-as-lock
            remove-click
          />
        </div>
      </NcMenuItem>
    </template>
  </PaymentUpgradeBadgeProvider>
</template>
