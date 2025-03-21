<script lang="ts" setup>
const { paymentState } = usePaymentStoreOrThrow()
</script>

<template>
  <div>
    <div v-if="paymentState === PaymentState.SELECT_PLAN" class="flex flex-col gap-8">
      <PaymentPlans />
      <div class="w-[70%] max-w-[640px] mx-auto">
        <NcDivider class="!my-0" />
      </div>
      <PaymentMoreInfo />
    </div>
    <PaymentPay v-else-if="paymentState === PaymentState.PAYMENT" />
  </div>
</template>
