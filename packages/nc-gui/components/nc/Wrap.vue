<script setup lang="ts">
interface Props {
  wrap?: boolean
  as?: string
}

withDefaults(defineProps<Props>(), {
  wrap: true,
  as: 'div',
})
</script>

<template>
  <component :is="as" v-if="wrap">
    <slot />
  </component>
  <slot v-else />
</template>
