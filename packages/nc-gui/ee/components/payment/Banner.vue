<script lang="ts" setup>
const { isPaidPlan, activeWorkspaceId } = useProvidePaymentStore()

const isLoading = ref(false)

const onUpgradePlan = async () => {
  navigateTo(`/account/workspace/${activeWorkspaceId.value}/billing`)
}
</script>

<template>
  <div
    v-if="!isPaidPlan"
    class="m-6 rounded-lg border-1 border-nc-border-gray-medium shadow-default max-w-350 bg-nc-bg-orange-light"
  >
    <div class="flex">
      <div class="flex flex-col max-w-[560px] p-4">
        <div class="text-xl font-semibold">Get more from NocoDB</div>
        <div class="my-4">
          Get access to additional features like more seats for your workspace, additional records for Bases, additional storage,
          conditional web-hooks, Integrations, NocoAI and much more!
        </div>
        <div class="flex">
          <NcButton
            class="mt-2"
            type="primary"
            size="small"
            data-testid="nc-workspace-settings-upgrade-button"
            :loading="isLoading"
            @click="onUpgradePlan"
          >
            <div class="flex items-center justify-center text-sm gap-1">
              <span>Upgrade Plan</span>
              <GeneralIcon icon="ncArrowRight" class="h-4 w-4" />
            </div>
          </NcButton>
        </div>
      </div>
      <div class="w-full flex items-end justify-end">
        <img class="rounded-br-lg" src="~assets/img/upgrade-illustration.svg" alt="Upgrade Your Workspace" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
