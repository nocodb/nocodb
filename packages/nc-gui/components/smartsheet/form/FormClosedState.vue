<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  mode: 'not-started' | 'expired'
  startsAt?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  startsAt: null,
})

const { mode, startsAt } = toRefs(props)

const { t } = useI18n()

const countdown = ref({ days: 0, hours: 0, minutes: 0, seconds: 0 })

const isCountdownActive = computed(() => mode.value === 'not-started' && startsAt.value)

let intervalId: ReturnType<typeof setInterval> | null = null

function updateCountdown() {
  if (!startsAt.value) return

  const now = dayjs()
  const target = dayjs(startsAt.value)
  const diff = target.diff(now, 'second')

  if (diff <= 0) {
    countdown.value = { days: 0, hours: 0, minutes: 0, seconds: 0 }
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    // Reload the page when countdown reaches zero
    window.location.reload()
    return
  }

  countdown.value = {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  }
}

onMounted(() => {
  if (isCountdownActive.value) {
    updateCountdown()
    intervalId = setInterval(updateCountdown, 1000)
  }
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

const countdownSegments = computed(() => [
  { value: countdown.value.days, label: t('labels.days') },
  { value: countdown.value.hours, label: t('labels.hours') },
  { value: countdown.value.minutes, label: t('labels.minutes') },
  { value: countdown.value.seconds, label: t('labels.seconds') },
])
</script>

<template>
  <div class="nc-form-closed-state flex flex-col items-center justify-center py-8 px-4 gap-6">
    <!-- Icon -->
    <div class="nc-form-closed-icon">
      <GeneralIcon
        :icon="mode === 'expired' ? 'ncLock' : 'ncClock'"
        class="w-12 h-12 text-nc-content-gray-muted"
      />
    </div>

    <!-- Title -->
    <h2 class="text-lg font-semibold text-nc-content-gray-emphasis text-center leading-tight">
      {{ mode === 'expired' ? $t('labels.formExpired') : $t('labels.formNotStarted') }}
    </h2>

    <!-- Subtitle -->
    <p class="text-sm text-nc-content-gray-muted text-center max-w-sm leading-relaxed">
      {{ mode === 'expired' ? $t('labels.formExpiredSubtext') : $t('labels.formNotStartedSubtext') }}
    </p>

    <!-- Countdown timer (only for not-started) -->
    <template v-if="isCountdownActive">
      <div class="text-xs font-medium text-nc-content-gray-subtle2 uppercase tracking-wider">
        {{ $t('labels.formOpensIn') }}
      </div>

      <div class="nc-countdown-grid flex items-center gap-3">
        <template v-for="(seg, i) in countdownSegments" :key="seg.label">
          <div class="nc-countdown-segment flex flex-col items-center">
            <div class="nc-countdown-value">
              {{ String(seg.value).padStart(2, '0') }}
            </div>
            <div class="nc-countdown-label">
              {{ seg.label }}
            </div>
          </div>
          <div v-if="i < countdownSegments.length - 1" class="nc-countdown-separator">
            :
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-closed-state {
  animation: nc-form-closed-fade-in 0.5s ease-out;
}

@keyframes nc-form-closed-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nc-form-closed-icon {
  @apply w-20 h-20 rounded-full flex items-center justify-center;
  @apply bg-nc-bg-gray-light;
}

.nc-countdown-grid {
  @apply select-none;
}

.nc-countdown-segment {
  @apply flex flex-col items-center gap-1;
}

.nc-countdown-value {
  @apply w-16 h-16 flex items-center justify-center;
  @apply text-2xl font-bold text-nc-content-gray-emphasis;
  @apply bg-nc-bg-gray-light rounded-xl;
  @apply border-1 border-nc-border-gray-medium;
  font-variant-numeric: tabular-nums;
  transition: all 0.3s ease;
}

.nc-countdown-label {
  @apply text-[11px] font-medium text-nc-content-gray-muted uppercase tracking-wider;
}

.nc-countdown-separator {
  @apply text-xl font-bold text-nc-content-gray-muted mb-5;
}
</style>
