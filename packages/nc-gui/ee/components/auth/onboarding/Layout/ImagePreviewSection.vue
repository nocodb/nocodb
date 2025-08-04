<script lang="ts" setup>
const { questions, stepper } = useOnboardingFlow()

const { index: stepIndex } = stepper

const currentQuestion = computed(() => questions.value[stepIndex.value - 1])

const bgColorClass = computed(() => {
  return onboardingFlowColoursMapping['orange'].lightBg
})
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full" :class="[bgColorClass]">
    <div class="text-2xl font-bold">Welcome to NocoDB</div>
    <div class="text-sm text-gray-500">We're excited to have you on board. Let's get started with your onboarding process.</div>
  </div>
</template>

<style lang="scss" scoped></style>
