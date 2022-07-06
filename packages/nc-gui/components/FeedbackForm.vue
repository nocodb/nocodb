<template>
  <div v-if="!feedbackFormHidden" class="nc-feedback-form-wrapper">
    <v-icon class="nc-close-icon" large @click="feedbackFormHidden = true"> mdi-close-circle-outline </v-icon>

    <iframe
      src="https://docs.google.com/forms/d/e/1FAIpQLSeTlAfZjszgr53lArz3NvUEnJGOT9JtG9NAU5d0oQwunDS2Pw/viewform?embedded=true"
      width="100%"
      height="500"
      frameborder="0"
      marginheight="0"
      marginwidth="0"
      >Loading…
    </iframe>
  </div>
  <div v-else />
</template>

<script>
export default {
  name: 'FeedbackForm',
  computed: {
    feedbackFormHidden: {
      get() {
        return this.$store.state.settings.feedbackFormHidden;
      },
      set(val) {
        this.$store.commit('settings/MutFeedbackFormHidden', val);
      },
    },
  },
};
</script>

<style scoped lang="scss">
.nc-feedback-form-wrapper {
  width: 100%;
  position: relative;

  iframe {
    margin: 0 auto;
  }

  .nc-close-icon {
    position: absolute;
    top: 5px;
    right: 10px;
  }
}
</style>
