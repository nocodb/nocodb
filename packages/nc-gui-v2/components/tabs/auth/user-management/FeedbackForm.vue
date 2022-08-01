<script setup lang="ts">
import CloseIcon from '~icons/material-symbols/close-rounded'

const { feedbackForm } = $(useGlobalState())
</script>

<template>
  <div v-if="feedbackForm && !feedbackForm.isHidden" class="nc-feedback-form-wrapper mt-6">
    <CloseIcon class="nc-close-icon" @click="feedbackForm.isHidden = true" />

    <iframe :src="feedbackForm.url" width="100%" height="500" frameborder="0" marginheight="0" marginwidth="0">Loading… </iframe>
  </div>
  <div v-else />
</template>

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
