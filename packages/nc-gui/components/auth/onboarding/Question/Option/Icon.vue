<script lang="ts" setup>
interface Props {
  option: OnboardingOptionType
  iconSize?: OnboardingQuestionType['iconSize']
}

const props = withDefaults(defineProps<Props>(), {})

const { option, iconSize } = toRefs(props)

const showIconMapIcon = computed(() => {
  return (!option.value.iconType || option.value.iconType === 'iconMap') && option.value.icon
})

const shouldShowIcon = computed(() => {
  return option.value.iconType || (!option.value.iconType && option.value.icon)
})

const iconColor = computed(() => {
  return option.value.iconColor ? onboardingFlowColoursMapping[option.value.iconColor]?.content ?? '' : ''
})

const bgColorClass = computed(() => {
  return option.value.iconColor ? onboardingFlowColoursMapping[option.value.iconColor]?.lightBg ?? '' : ''
})
</script>

<template>
  <div v-if="shouldShowIcon">
    <div
      v-if="showIconMapIcon"
      class="flex items-center justify-center"
      :class="[
        bgColorClass,
        {
          'rounded-lg': bgColorClass,
        },
      ]"
      :style="{
        width: `${iconSize?.width ?? 24}px`,
        height: `${iconSize?.height ?? 24}px`,
      }"
    >
      <GeneralIcon :icon="option.icon!" class="flex-none" :class="iconColor" />
    </div>
    <div></div>
  </div>
</template>

<style lang="scss" scoped></style>
