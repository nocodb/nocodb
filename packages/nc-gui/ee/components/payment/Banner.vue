<script lang="ts" setup>
import { PaymentState } from '#imports'

const { loadPlans, paymentState, reset } = usePaymentStoreOrThrow()

const isLoading = ref(false)

const onUpgradePlan = async () => {
  isLoading.value = true
  await loadPlans()
  isLoading.value = false

  paymentState.value = PaymentState.SELECT_PLAN
}
</script>

<template>
  <div class="m-6 rounded-lg nc-border-gray-medium p-4 shadow-default max-w-350">
    <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="pb-4">
      <div class="flex items-center gap-2 cursor-pointer" @click="reset">
        <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
        <div class="text-sm">Back</div>
      </div>
    </div>
    <div v-if="!paymentState" class="flex">
      <div class="flex flex-col max-w-[560px]">
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
      <div></div>
    </div>
    <div v-else-if="paymentState === PaymentState.SELECT_PLAN">
      <PaymentPlans />
    </div>
    <div v-else-if="paymentState === PaymentState.PAYMENT">
      <PaymentPay />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
