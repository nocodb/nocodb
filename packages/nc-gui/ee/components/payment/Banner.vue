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
        <div class="text-xl font-semibold">Get more from NocoDB</div>
        <div class="my-4">
          Unlock more seats, extra records, more storage, conditional webhooks, integrations, NocoAI, and more!
        </div>
        <div class="flex">
          <NcButton
            class="mt-2 !bg-nc-fill-maroon-dark"
            type="primary"
            size="small"
            data-testid="nc-workspace-settings-upgrade-button"
            @click="onUpgradePlan"
          >
            <div class="flex items-center justify-center text-sm gap-1 font-weight-700">
              <span>Upgrade Plan</span>
              <GeneralIcon icon="ncArrowUpRight" class="h-4 w-4" />
            </div>
          </NcButton>
        </div>
      </div>
      <div class="w-full flex items-end justify-end pt-6">
        <img class="rounded-br-lg" src="~assets/img/upgrade-illustration.svg" alt="Upgrade Your Workspace" />
      </div>
    </div>
  </div>
</template>
