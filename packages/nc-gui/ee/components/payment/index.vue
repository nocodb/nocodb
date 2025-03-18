<script lang="ts" setup>
const { paymentState } = usePaymentStoreOrThrow()
</script>

<template>
  <div>
    <PaymentPlans v-if="paymentState === PaymentState.SELECT_PLAN" />
    <PaymentPay v-else-if="paymentState === PaymentState.PAYMENT" />
  </div>
</template>

<style lang="scss" scoped></style>
