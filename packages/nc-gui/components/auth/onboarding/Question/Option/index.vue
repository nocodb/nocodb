<script lang="ts" setup>
interface Props {
  option: OnboardingOptionType
  index: number
  totalOptions: number
  iconSize?: OnboardingQuestionType['iconSize']
}

defineProps<Props>()
</script>

<template>
  <div class="nc-onboarding-option">
    <AuthOnboardingQuestionOptionIconGroup
      v-if="!option.iconPosition || option.iconPosition === 'left'"
      :option="option"
      :index="index"
      :total-options="totalOptions"
      :icon-size="iconSize"
    />
    <div v-if="option.description" class="flex-1 flex flex-col gap-1">
      <div class="text-bodyDefaultSmBold text-nc-content-gray-subtle">
        {{ option.value }}
      </div>
      <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">
        {{ option.description }}
      </div>
    </div>
    <div v-else class="flex-1 text-bodyBold text-nc-content-gray">
      {{ option.value }}
    </div>

    <AuthOnboardingQuestionOptionIconGroup
      v-if="option.iconPosition === 'right'"
      :option="option"
      :index="index"
      :total-options="totalOptions"
      :icon-size="iconSize"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-onboarding-option {
  @apply bg-white flex items-center gap-2.5 px-3 py-2 overflow-hidden border-1 border-nc-border-gray-medium rounded-lg cursor-pointer select-none transition-all duration-250;

  box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.08);

  &:hover:not(.nc-selected) {
    @apply bg-nc-bg-gray-extralight;
  }

  &.nc-has-icon-bg-color {
    @apply !py-0 !pl-0 pr-2 !rounded-xl;
  }

  &.nc-selected {
    @apply border-nc-border-brand bg-nc-bg-brand !shadow-selected;
  }
}
</style>
