<script lang="ts" setup>
const { isPaidPlan, activeWorkspaceId } = useProvidePaymentStore()

const onUpgradePlan = async () => {
  navigateTo(`/account/workspace/${activeWorkspaceId.value}/settings`)
}
</script>

<template>
  <div
    v-if="!isPaidPlan"
    class="m-6 rounded-lg border-1 border-nc-border-gray-medium shadow-default max-w-350 bg-nc-bg-maroon-light"
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
      <div class="w-full flex items-end justify-end pt-6">
        <img class="rounded-br-lg" src="~assets/img/upgrade-illustration.svg" alt="Upgrade Your Workspace" />
      </div>
    </div>
  </div>
</template>
