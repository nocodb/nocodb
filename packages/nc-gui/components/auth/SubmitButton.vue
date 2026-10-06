<script setup lang="ts">
const props = defineProps<{
  error?: string | null
  loading?: boolean
  errorTestid?: string
}>()

// The auth forms' primary action: a failed submit shows its error above the button and shakes it. Attrs go to the NcButton.
defineOptions({ inheritAttrs: false })

const shaking = ref(false)

let shakeTimer: ReturnType<typeof setTimeout> | undefined

function shake() {
  clearTimeout(shakeTimer)
  shaking.value = false
  requestAnimationFrame(() => {
    shaking.value = true
    shakeTimer = setTimeout(() => (shaking.value = false), 450)
  })
}

// a new error, or the same one again after another attempt, shakes
watch(
  () => [props.error, props.loading] as const,
  ([error, loading], [prevError, prevLoading]) => {
    if (!error || loading) return
    if (error !== prevError || prevLoading) shake()
  },
)

onBeforeUnmount(() => {
  clearTimeout(shakeTimer)
})
</script>

<template>
  <div class="flex flex-col gap-3 pt-2">
    <AuthFormError :message="error" :data-testid="errorTestid" />
    <NcButton
      v-bind="$attrs"
      type="primary"
      :loading="loading"
      class="nc-auth-primary w-full"
      :class="{ 'nc-auth-shake': shaking }"
    >
      <slot />
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
.nc-auth-shake {
  animation: nc-auth-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes nc-auth-shake {
  10%,
  90% {
    translate: -1px 0;
  }

  20%,
  80% {
    translate: 3px 0;
  }

  30%,
  50%,
  70% {
    translate: -5px 0;
  }

  40%,
  60% {
    translate: 5px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nc-auth-shake {
    animation: none;
  }
}
</style>
