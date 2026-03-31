<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  expiresAt?: string | null
  showAlways?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expiresAt: null,
  showAlways: false,
})

const { expiresAt, showAlways } = toRefs(props)

const remaining = ref({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 })

let intervalId: ReturnType<typeof setInterval> | null = null

const isActive = computed(() => {
  if (!expiresAt.value) return false
  return dayjs.utc(expiresAt.value).isAfter(dayjs.utc())
})

const isUrgent = computed(() => remaining.value.totalSeconds > 0 && remaining.value.totalSeconds <= 600)

const isCritical = computed(() => remaining.value.totalSeconds > 0 && remaining.value.totalSeconds <= 120)

function updateRemaining() {
  if (!expiresAt.value) return

  const diff = dayjs.utc(expiresAt.value).diff(dayjs.utc(), 'second')

  if (diff <= 0) {
    remaining.value = { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 }
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    window.location.reload()
    return
  }

  remaining.value = {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    totalSeconds: diff,
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

const { t } = useI18n()

const countdownText = computed(() => {
  const { days, hours, minutes, seconds } = remaining.value
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const remainingDays = days % 30

  if (years > 0) return `${years}y ${months}mo`
  if (months > 0) return `${months}mo ${remainingDays}d`
  if (days > 0) return `${days}d ${pad(hours)}h`
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
})

const tooltipText = computed(() => {
  const { days, hours, minutes } = remaining.value
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const remainingDays = days % 30

  const parts: string[] = []
  if (years > 0) parts.push(`${years}y`)
  if (months > 0) parts.push(`${months}mo`)
  if (remainingDays > 0 && years === 0) parts.push(`${remainingDays}d`)
  if (hours > 0 && years === 0 && months === 0) parts.push(`${hours}h`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`)
  return t('labels.formExpiryCountdownTooltip', { time: parts.join(' ') || '< 1m' })
})

onMounted(() => {
  if (isActive.value) {
    updateRemaining()
    intervalId = setInterval(updateRemaining, 1000)
  }
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<template>
  <NcTooltip v-if="isActive && remaining.totalSeconds > 0 && (showAlways || isUrgent)" :title="tooltipText">
    <span class="nc-expiry-inline" :class="{ 'nc-urgent': isUrgent, 'nc-critical': isCritical }">
      <GeneralIcon icon="ncClock" class="nc-expiry-inline-icon" />
      <span class="nc-expiry-inline-time">{{ countdownText }}</span>
    </span>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.nc-expiry-inline {
  @apply inline-flex items-center gap-1 py-0.5 px-2 rounded-full;
  @apply text-xs text-nc-content-gray-subtle tabular-nums;
  @apply bg-nc-bg-gray-light;
  @apply transition-all duration-300;

  &.nc-urgent {
    @apply bg-nc-bg-orange-light text-nc-content-orange-dark;
  }

  &.nc-critical {
    background-color: var(--nc-bg-red-light, #fef2f2);
    color: var(--nc-content-red-dark);
    animation: nc-blink 2s ease-in-out infinite;
  }
}

.nc-expiry-inline-icon {
  @apply w-3 h-3 flex-none;
}

.nc-expiry-inline-time {
  @apply font-semibold;
}

@keyframes nc-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
