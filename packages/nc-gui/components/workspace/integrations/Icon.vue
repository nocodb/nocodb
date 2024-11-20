<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    integrationItem: IntegrationItemType
    size?: 'xs' | 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  },
)
const { size, integrationItem } = toRefs(props)

const pxSize = computed(() => {
  switch (size.value) {
    case 'xs':
      return '16px'
    case 'sm':
      return '24px'
    case 'md':
      return '32px'
    case 'lg':
      return '48px'
  }
})
const pxWrapperPadding = computed(() => {
  switch (size.value) {
    case 'xs':
      return '8px'
    case 'sm':
      return '8px'
    default:
      return '10px'
  }
})
</script>

<template>
  <div
    class="logo-wrapper"
    :style="{
      padding: pxWrapperPadding,
    }"
  >
    <GeneralIcon
      v-if="typeof integrationItem === 'string'"
      :icon="integrationItem"
      class="text-gray-700"
      :style="{ width: pxSize, height: pxSize }"
    />
    <component
      :is="integrationItem.icon"
      v-else-if="integrationItem.icon"
      class="text-gray-700"
      :style="{ width: pxSize, height: pxSize }"
    />
  </div>
</template>

<style lang="scss" scoped>
.logo-wrapper {
  @apply bg-gray-200 rounded-lg flex items-center justify-center;
}
</style>
