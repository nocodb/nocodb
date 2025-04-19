<script lang="ts" setup>
const route = useRoute()

const { navigateToPricing } = useEeConfig()

const { plansAvailable, loadPlans, paymentMode } = usePaymentStoreOrThrow()

const plan = ref<PaymentPlan>()

onMounted(() => {
  paymentMode.value = route.query.paymentMode === 'month' ? 'month' : 'year'

  const planId = route.params.planId as string

  if (!planId) {
    navigateToPricing()
    return
  }

  plan.value = plansAvailable.value.find((p) => p.id === planId)

  if (!plan.value) {
    loadPlans().then(() => {
      plan.value = plansAvailable.value.find((p) => p.id === planId)

      if (!plan.value) {
        navigateToPricing()
      }
    })
  }
})
</script>

<template>
  <template v-if="plan">
    <PaymentCheckoutUpdate :plan="plan" />
  </template>
</template>
