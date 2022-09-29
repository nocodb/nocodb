<template>
  <div v-if="!feedbackFormIsHidden" class="nc-feedback-form-wrapper">
    <v-icon class="nc-close-icon" large @click="feedbackFormIsHidden = true"> mdi-close-circle-outline </v-icon>

    <iframe :src="feedbackFormUrl" width="100%" height="500" frameborder="0" marginheight="0" marginwidth="0"
      >Loading…
    </iframe>
  </div>
  <div v-else />
</template>

<script>
export default {
  name: 'FeedbackForm',
  computed: {
    feedbackFormIsHidden: {
      get() {
        return this.$store.state.settings.feedbackForm.isHidden;
      },
      set(isHidden) {
        this.$store.commit('settings/MutFeedbackForm', { ...this.$store.state.settings.feedbackForm, isHidden });
      },
    },
    feedbackFormUrl() {
      return this.$store.state.settings.feedbackForm.url;
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
