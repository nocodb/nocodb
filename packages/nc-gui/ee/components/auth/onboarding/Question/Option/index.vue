<script lang="ts" setup>
interface Props {
  option: OnboardingOptionType
}

const props = withDefaults(defineProps<Props>(), {})

const { option } = toRefs(props)
</script>

<template>
  <div class="nc-onboarding-option">
    <AuthOnboardingQuestionOptionIcon :option="option" />
    {{ option.value }}
  </div>
</template>

<style lang="scss" scoped>
.nc-onboarding-option {
  @apply flex items-center gap-2.5 px-3 py-2 border-1 border-nc-border-gray-medium rounded-xl cursor-pointer select-none transition-all duration-250;

  box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.08);

  &:hover {
    @apply bg-nc-bg-gray-extralight;
  }

  &.nc-selected {
    @apply border-nc-border-brand !shadow-selected;
  }
}
</style>
