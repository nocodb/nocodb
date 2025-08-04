<script lang="ts" setup>
interface Props {
  option: OnboardingOptionType
}

const props = withDefaults(defineProps<Props>(), {})

const { option } = toRefs(props)

const showIconMapIcon = computed(() => {
  return (!option.value.iconType || option.value.iconType === 'iconMap') && option.value.icon
})

const shouldShowIcon = computed(() => {
  return option.value.iconType || (!option.value.iconType && option.value.icon)
})
</script>

<template>
  <div v-if="shouldShowIcon">
    <div v-if="showIconMapIcon" class="flex">
      <GeneralIcon :icon="option.icon!" class="flex-none" />
    </div>
    <div></div>
  </div>
</template>

<style lang="scss" scoped></style>
