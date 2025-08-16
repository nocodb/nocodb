<script lang="ts" setup>
interface Props {
  option: OnboardingOptionType
  index: number
  totalOptions: number
  iconSize?: OnboardingQuestionType['iconSize']
}

const props = withDefaults(defineProps<Props>(), {})

const { option } = toRefs(props)
</script>

<template>
  <div
    class="nc-onboarding-option"
    :class="{
      '!px-2 !rounded-xl': option.iconColor,
    }"
  >
    <AuthOnboardingQuestionOptionIcon :option="option" :index="index" :total-options="totalOptions" :icon-size="iconSize" />
    <div v-if="option.description" class="flex flex-col gap-1">
      <div class="text-bodyDefaultSmBold text-nc-content-gray-subtle">
        {{ option.value }}
      </div>
      <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">
        {{ option.description }}
      </div>
    </div>
    <div v-else class="text-bodyBold text-nc-content-gray">
      {{ option.value }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-onboarding-option {
  @apply flex items-center gap-2.5 px-3 py-2 border-1 border-nc-border-gray-medium rounded-lg cursor-pointer select-none transition-all duration-250;

  box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.08);

  &:hover:not(.nc-selected) {
    @apply bg-nc-bg-gray-extralight;
  }

  &.nc-selected {
    @apply border-nc-border-brand bg-nc-bg-brand !shadow-selected;
  }
}
</style>
