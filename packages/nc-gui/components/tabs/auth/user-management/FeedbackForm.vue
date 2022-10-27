<script setup lang="ts">
import { ref, useGlobal } from '#imports'

const { feedbackForm } = useGlobal()

const showForm = ref(false)

// todo: why this timeout?
setTimeout(() => (showForm.value = true), 60000)
</script>

<template>
  <div v-if="showForm && feedbackForm && !feedbackForm.isHidden" class="nc-feedback-form-wrapper mt-6">
    <MaterialSymbolsCloseRounded class="nc-close-icon" @click="feedbackForm.isHidden = true" />

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
