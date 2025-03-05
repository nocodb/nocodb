<script lang="ts" setup>
const { activeWorkspace } = storeToRefs(useWorkspace())

const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

useProvidePaymentStore()
</script>

<template>
  <div>
    <PaymentManage v-if="isPaidPlan" />
    <PaymentBanner v-else />
  </div>
</template>

<style lang="scss" scoped></style>
