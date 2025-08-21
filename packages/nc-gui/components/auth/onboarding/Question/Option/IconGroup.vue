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
  <template v-if="option.icons?.length">
    <AuthOnboardingQuestionOptionIcon
      v-for="(iconItem, i) of option.icons"
      :key="i"
      :icon-item="iconItem"
      :option-index="index"
      :total-options="totalOptions"
      :icon-size="iconSize"
    />
  </template>
</template>
