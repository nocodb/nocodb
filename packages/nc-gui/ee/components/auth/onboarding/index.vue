<script lang="ts" setup>
const { onInitOnboardingFlow } = useOnboardingFlow()

onMounted(() => {
  onInitOnboardingFlow()
})
</script>

<template>
  <AuthOnboardingLayout> </AuthOnboardingLayout>
</template>

<style lang="scss" scoped></style>
