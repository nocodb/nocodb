<script lang="ts" setup>
const { isPaidPlan, paymentState } = usePaymentStoreOrThrow()
</script>

<template>
  <div>
    <PaymentManage v-if="isPaidPlan" />
    <PaymentPlans v-else-if="paymentState === PaymentState.SELECT_PLAN" />
    <PaymentPay v-else-if="paymentState === PaymentState.PAYMENT" />
  </div>
</template>

<style lang="scss" scoped></style>
