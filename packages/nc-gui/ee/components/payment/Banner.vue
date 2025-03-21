<script lang="ts" setup>
const { isPaidPlan } = useProvidePaymentStore()

const router = useRouter()
const route = router.currentRoute

const onUpgradePlan = async () => {
  router.push({ query: { ...route.value.query, tab: 'billing' } })
}
</script>

<template>
  <div
    v-if="!isPaidPlan"
    class="nc-payment-banner m-6 rounded-lg border-1 border-nc-border-gray-medium max-w-338 bg-nc-bg-maroon-light overflow-hidden"
  >
    <div class="flex">
      <div class="flex flex-col p-6">
        <div class="text-xl font-weight-700 text-nc-content-gray">{{ $t('title.getMoreFromNocodb') }}</div>
        <div class="mt-2">
          {{ $t('title.getMoreFromNocodbSubtitle') }}
        </div>
        <div class="flex gap-2 mt-5">
          <NcButton
            class="!bg-nc-fill-maroon-dark"
            type="primary"
            size="small"
            data-testid="nc-workspace-settings-upgrade-button"
            icon-position="right"
            inner-class="!gap-2"
            @click="onUpgradePlan"
          >
            <template #icon>
              <GeneralIcon icon="ncArrowUpRight" class="h-4 w-4" />
            </template>
            {{ $t('labels.upgradePlan') }}
          </NcButton>
          <NcButton type="text" size="small" data-testid="nc-workspace-settings-view-all-plan-btn">
            {{ $t('labels.viewAllPlanDetails') }}
          </NcButton>
        </div>
      </div>
      <div class="w-[60%] flex items-end justify-end pt-6 relative">
        <div class="absolute top-6 left-0 border-t-1 border-l-1 rounded-tl-lg overflow-hidden bg-nc-bg-gray-medium min-w-[500px]">
          <img class="!rounded-rl-lg" src="~assets/img/kanban-view.png" alt="Upgrade Your Workspace" />
        </div>
        <div class="absolute -bottom-[28px] overflow-hidden">
          <img
            class="!rounded-rl-lg nc-finance-img"
            src="~assets/img/finance.png"
            alt="Upgrade Your Workspace"
            height="126px"
            width="133px"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-payment-banner {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);

  .nc-finance-img {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }
}
</style>
