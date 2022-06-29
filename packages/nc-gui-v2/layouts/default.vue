<template>
  <v-layout>
    <v-app-bar color="grey-lighten-2"></v-app-bar>
<!--    <v-navigation-drawer color="grey-darken-2" permanent></v-navigation-drawer>-->
    <v-main>
      <slot></slot>
    </v-main>
  </v-layout>
</template>

<script>
export default {
  name: "default"
}
</script>

<style scoped>

</style>
