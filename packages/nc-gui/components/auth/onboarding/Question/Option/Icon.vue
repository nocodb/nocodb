<script lang="ts" setup>
interface Props {
  option: OnboardingOptionType
  index: number
  totalOptions: number
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
          'rounded-l-lg': bgColorClass,
        },
      ]"
      :style="{
        width: `${iconSize?.width ?? 24}px`,
        height: `${iconSize?.height ?? 24}px`,
      }"
    >
      <GeneralIcon
        :icon="option.icon!"
        class="flex-none"
        :class="[
          iconColor,
          {
            'w-full h-full': iconSize?.fullWidth,
          },
        ]"
      />
    </div>
    <div v-else-if="option.iconType === 'indexedStepProgressBar'" class="flex items-stretch gap-0.5">
      <div
        v-for="i in totalOptions"
        :key="i"
        class="flex-none w-3 h-3"
        :class="{
          'bg-green-600': i <= index + 1,
          'bg-nc-bg-gray-dark': i > index + 1,
          'rounded-l-full': i === 1,
          'rounded-r-full': i === totalOptions,
        }"
      ></div>
    </div>
    <div v-else></div>
  </div>
</template>

<style lang="scss" scoped></style>
