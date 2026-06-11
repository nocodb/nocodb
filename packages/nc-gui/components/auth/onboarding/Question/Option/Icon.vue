<script lang="ts" setup>
interface Props {
  iconItem: OnboardingOptionIconType
  optionIndex: number
  totalOptions: number
  iconSize?: OnboardingQuestionType['iconSize']
}

const props = defineProps<Props>()

const { iconItem } = toRefs(props)

const showIconMapIcon = computed(() => {
  return (!iconItem.value.iconType || iconItem.value.iconType === 'iconMap') && iconItem.value.icon
})

const shouldShowIcon = computed(() => {
  return iconItem.value.iconType || (!iconItem.value.iconType && iconItem.value.icon)
})

const iconColors = computed(() => {
  return {
    textColorClass: iconItem.value.iconColor ? onboardingFlowColoursMapping[iconItem.value.iconColor]?.content ?? '' : '',
    bgColorClass: iconItem.value.iconColor ? onboardingFlowColoursMapping[iconItem.value.iconColor]?.lightBg ?? '' : '',
  }
})
</script>

<template>
  <div v-if="shouldShowIcon">
    <div
      v-if="showIconMapIcon"
      class="flex items-center justify-center"
      :class="[
        iconColors.bgColorClass,
        {
          'rounded-l-lg': iconColors.bgColorClass,
        },
      ]"
      :style="{
        width: `${iconSize?.width ?? 24}px`,
        height: `${iconSize?.height ?? 24}px`,
      }"
    >
      <GeneralIcon
        :icon="iconItem.icon! as IconMapKey"
        class="flex-none"
        :class="[
          iconColors.textColorClass,
          {
            'w-full h-full': iconSize?.fullWidth,
          },
        ]"
      />
    </div>
    <div v-else-if="iconItem.iconType === 'indexedStepProgressBar'" class="flex items-stretch gap-0.5">
      <div
        v-for="i in totalOptions"
        :key="i"
        class="flex-none w-3 h-3"
        :class="{
          'bg-green-600': i <= optionIndex + 1,
          'bg-nc-bg-gray-dark': i > optionIndex + 1,
          'rounded-l-full': i === 1,
          'rounded-r-full': i === totalOptions,
        }"
      ></div>
    </div>
    <component :is="iconItem.icon" v-else-if="iconItem.iconType === 'vNode'" class="flex-none" />
    <div
      v-else-if="iconItem.iconType === 'image' && iconItem.img"
      class="flex items-center justify-center"
      :style="{
        width: `${iconSize?.width ?? 24}px`,
        height: `${iconSize?.height ?? 24}px`,
      }"
    >
      <img :src="iconItem.img" class="flex-none w-full h-full object-contain" />
    </div>
    <div v-else></div>
  </div>
</template>
