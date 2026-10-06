<script setup lang="ts">
defineProps<{
  message?: string | null
}>()
</script>

<template>
  <Transition name="nc-auth-error">
    <div v-if="message" role="alert" class="nc-auth-error flex items-start gap-1.5 text-bodyDefaultSm">
      <GeneralIcon icon="ncAlertCircle" class="w-4 h-4 flex-none mt-px" />
      <span class="min-w-0 truncate" :title="message">{{ message }}</span>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-auth-error {
  color: var(--auth-danger, var(--nc-content-red-dark));
}

.nc-auth-error-enter-active,
.nc-auth-error-leave-active {
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.nc-auth-error-enter-from,
.nc-auth-error-leave-to {
  opacity: 0;
  transform: translateY(2px);
}
</style>
