<script setup lang="ts">
interface Props {
  wrap?: boolean
  as?: string
}

withDefaults(defineProps<Props>(), {
  wrap: true,
  as: 'div',
})

// With wrap=false only the slot is rendered, so there is no element to inherit
// attrs onto — bind them explicitly on the wrapper instead of letting them fall through.
defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <component :is="as" v-if="wrap" v-bind="$attrs">
    <slot />
  </component>
  <slot v-else />
</template>
