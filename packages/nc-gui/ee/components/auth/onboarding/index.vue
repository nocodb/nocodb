<script lang="ts" setup>
interface Props {}

const props = withDefaults(defineProps<Props>(), {})

const {} = toRefs(props)

const { onInitOnboardingFlow } = useOnboardingFlow()

onMounted(() => {
  onInitOnboardingFlow()
})
</script>

<template>
  <AuthOnboardingLayout> </AuthOnboardingLayout>
</template>

<style lang="scss" scoped></style>
