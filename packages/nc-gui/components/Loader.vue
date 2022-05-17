<template>
  <v-overlay :value="message" z-index="99999" opacity=".9">
    <div class="d-flex flex-column align-center">
      <v-progress-circular
        v-if="progress !== null "
        :rotate="360"
        :size="100"
        :width="15"
        :value="progress"
      >
        {{ progress }}%
      </v-progress-circular>

      <v-progress-circular v-else indeterminate size="100" width="15" class="mb-10" />
      <span class="title">{{ message }}</span>
    </div>
  </v-overlay>
</template>

<script>
export default {
  name: 'Loader',
  props: {
  },
  computed: {
    message() {
      return this.$store.state.loader.message
    },
    progress() {
      return this.$store.state.loader.progress
    }
  }
}
</script>

<style scoped>

</style>
