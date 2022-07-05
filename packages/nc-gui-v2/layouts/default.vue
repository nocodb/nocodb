<script>
export default {
  name: 'General',
}
</script>

<template>
  <v-layout>
    <slot name="header">
      <v-app-bar color="" />
    </slot>
    <slot name="sidebar" />
    <v-main>
      <slot />
    </v-main>
  </v-layout>
</template>
