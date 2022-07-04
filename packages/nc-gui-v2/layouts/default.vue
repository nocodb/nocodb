<script>
export default {
  name: 'Default',
}
</script>

<template>
  <v-layout>
    <v-app-bar color="" />
    <v-navigation-drawer :permanent="true" />
    <v-main>
      <slot />
    </v-main>
  </v-layout>
</template>
