<script lang="ts">
export default {
  name: 'Default',
}
</script>

<template>
  <v-main>
    <slot name="sidebar">
      <div id="sidebar" />
    </slot>

    <slot />
  </v-main>
</template>
