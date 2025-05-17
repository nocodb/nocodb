<script lang="ts" setup>
import { LOYALTY_GRACE_PERIOD_END_DATE, PlanLimitTypes, PlanTitles } from 'nocodb-sdk'

const route = useRoute()

const { isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const {
  isRecordLimitReached,
  isStorageLimitReached,
  gracePeriodDaysLeft,
  navigateToBilling,
  activePlanTitle,
  isLoyaltyDiscountAvailable,
  gracePeriodEndDate,
  isPaymentEnabled,
  navigateToPricing,
  isSideBannerExpanded,
  activePlan,
  isWsOwner,
  getStatLimit,
  getLimit,
} = useEeConfig()

const isLimitReached = computed(() => {
  if (isLoyaltyDiscountAvailable.value) return false

  return isRecordLimitReached.value || isStorageLimitReached.value
})

const showBannerLocal = ref(false)

const contentRef = ref<HTMLDivElement>()

const { height: contentRefHeight } = useElementBounding(contentRef)

const showUpgradeToTeamBanner = computed(() => {
  const isNewUser = !activeWorkspace.value?.loyal

  let isRecordLimitReaching = false
  let isStorageLimitReaching = false

  if (getStatLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE)) {
    const value = getStatLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE)
    const total = getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE) ?? 1000
    isRecordLimitReaching = (value / total) * 100 > 70
  }

  if (getStatLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE)) {
    const value = getStatLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000
    const total = getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000
    isStorageLimitReaching = (value / total) * 100 > 70
  }

  return isNewUser && (isRecordLimitReaching || isStorageLimitReaching)
})

const showBanner = computed(() => {
  const isFreePlan = activePlan && activePlanTitle.value === PlanTitles.FREE

  if (route.name === 'index-typeOrId-settings' && route.query?.tab === 'billing') {
    return false
  }

  return (
    showBannerLocal.value &&
    isPaymentEnabled.value &&
    activeWorkspace.value?.id &&
    (isLimitReached.value || (isFreePlan && (isLoyaltyDiscountAvailable.value || showUpgradeToTeamBanner.value)))
  )
})

const showTimer = computed(() => {
  if (isLimitReached.value) {
    return gracePeriodDaysLeft.value > 0
  }

  if (isLoyaltyDiscountAvailable.value) return true

  return false
})

const timerDate = computed(() => {
  return isLimitReached.value ? gracePeriodEndDate.value : LOYALTY_GRACE_PERIOD_END_DATE
})

const handleNavigation = () => {
  if (isLimitReached.value) {
    navigateToBilling()
  } else {
    navigateToPricing()
  }
}

let timerId: NodeJS.Timeout

watch(
  () => activeWorkspace.value?.id,
  () => {
    if (timerId) {
      clearTimeout(timerId)
    }

    timerId = setTimeout(() => {
      showBannerLocal.value = true
      clearTimeout(timerId)
    }, 5000)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    v-if="showBanner"
    class="-mx-1 pt-1.5 pointer-events-none"
    :class="{
      'px-2 pb-2': isLimitReached,
      'px-1 pb-1': !isLimitReached,
      'border-b border-nc-border-gray-medium': !isNewSidebarEnabled,
    }"
  >
    <div
      class="nc-upgrade-sidebar-banner-wrapper w-full !h-auto"
      :class="{
        'nc-limit-reached-banner': isLimitReached,
      }"
      :style="
        isLimitReached
          ? {}
          : {
              background:
                'conic-gradient(from 180deg at 50% 50%, #BBCBF6 0deg, #F4E0F7 48deg, #EBDAF8 130deg, #C8CFFA 178deg, #E1E1F7 232deg, #A3D1F9 332deg, #BBCBF6 360deg)',
            }
      "
    >
      <NcTooltip :disabled="isWsOwner">
        <template #title> Click to notify the workspace owner to upgrade the plan. </template>

        <div
          class="nc-upgrade-sidebar-banner w-full transition-all duration-250 ease-in-out overflow-hidden"
          :style="
            isLimitReached
              ? {
                  height: contentRefHeight ? `${contentRefHeight + 32}px` : undefined,
                }
              : {
                  background: 'linear-gradient(to bottom left, #ec7db1, #85a3ff)',
                  height: contentRefHeight ? `${contentRefHeight + 32}px` : undefined,
                }
          "
          @click="handleNavigation()"
        >
          <div ref="contentRef" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <div class="flex gap-2 items-center justify-between">
                <div class="flex-1 flex gap-2">
                  <GeneralIcon
                    v-if="!isLoyaltyDiscountAvailable"
                    :icon="isLimitReached ? 'alertTriangleSolid' : 'ncArrowUpCircleSolid'"
                    class="h-5 w-5 flex-none mt-0.5"
                    :class="{
                      'text-nc-content-orange-medium': isLimitReached,
                      'text-nc-content-brand': !isLimitReached,
                    }"
                  />
                  <div class="text-base font-700 text-nc-content-gray">
                    {{
                      isLimitReached
                        ? 'Plan Limit Reached'
                        : isLoyaltyDiscountAvailable
                        ? 'Preview Ending Soon 🎊'
                        : 'Upgrade to Team'
                    }}
                  </div>
                </div>
                <NcButton
                  type="text"
                  size="xxsmall"
                  class="text-gray-700 !hover:(text-gray-800 bg-transparent)"
                  @click.stop="isSideBannerExpanded = !isSideBannerExpanded"
                >
                  <GeneralIcon
                    icon="chevronRight"
                    class="cursor-pointer transform transition-transform duration-200 !text-current text-[20px]"
                    :class="{ '!rotate-90': isSideBannerExpanded }"
                  />
                </NcButton>
              </div>
              <div v-if="isSideBannerExpanded" class="text-nc-content-gray-subtle2 text-small leading-[18px]">
                {{
                  isLimitReached
                    ? `You have exceeded the ${
                        isRecordLimitReached ? 'records' : 'storage'
                      } limit allowed in the Free plan. Upgrade to increase your limit`
                    : isLoyaltyDiscountAvailable
                    ? 'Thank you for being an early adopter. Upgrade now with loyalty discounts to continue'
                    : 'Unlock more seats, extra records, more storage, conditional webhooks, integrations, NocoAI, and more!'
                }}
              </div>
            </div>

            <div v-if="isSideBannerExpanded" class="flex flex-col gap-1.5">
              <div v-if="showTimer && timerDate" class="flex items-center justify-center">
                <PaymentExpiresIn
                  :end-time="timerDate"
                  hide-icon
                  hide-label
                  class="!bg-transparent text-nc-content-gray-muted text-center"
                />
              </div>

              <NcButton size="small" class="w-full">
                {{ isWsOwner ? 'Upgrade Now' : $t('general.requestUpgrade') }}
              </NcButton>
            </div>
          </div>
        </div>
      </NcTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-upgrade-sidebar-banner-wrapper {
  @apply w-full rounded-2xl border-1;

  .nc-upgrade-sidebar-banner {
    @apply relative p-4 cursor-pointer pointer-events-auto rounded-[14px] border-1;
  }

  &.nc-limit-reached-banner {
    @apply border-0;

    .nc-upgrade-sidebar-banner {
      @apply border-nc-border-gray-medium overflow-hidden;

      box-shadow: 0px -2px 12px 0px rgba(0, 0, 0, 0.08) !important;
    }
  }
  &:not(.nc-limit-reached-banner) {
    @apply p-1 border-0 border-transparent;

    .nc-upgrade-sidebar-banner {
      @apply relative border-transparent z-1;
      &:before {
        @apply content-[''] block absolute inset-0 rounded-xl -z-1;
        background: linear-gradient(90deg, #faf6fe 0%, #e6f3fe 70.19%, #f1f6fe 100%);
      }
    }
  }
}

.nc-alert-icon {
  :deep(path + path) {
    @apply !stroke-nc-content-brand;
  }
}
</style>
