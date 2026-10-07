<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  /** ISO string, epoch milliseconds or Date. A string without an offset (e.g. MySQL `2023-01-01 08:00:00`) is read as UTC. */
  value: string | number | Date
}

const props = defineProps<Props>()

const now = useRelativeTimeNow()

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone

const date = computed(() => {
  const value = props.value
  if (ncIsString(value) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return dayjs(`${value}+00:00`)
  return dayjs(value)
})

// Reads the shared clock so it recomputes on every tick.
const relative = computed(() => (now.value && date.value.isValid() ? timeAgo(date.value.toISOString()) : ''))

function zoneOffset(timeZone: string) {
  return (
    new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(date.value.toDate())
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  )
}

const rows = computed(() => {
  if (!date.value.isValid()) return []
  const zones = [
    { key: 'local', zone: localZone, label: localZone.replace(/_/g, ' ') },
    { key: 'utc', zone: 'UTC', label: 'UTC' },
  ]
  return zones.map(({ key, zone, label }) => ({
    key,
    label,
    offset: zone === 'UTC' ? '' : zoneOffset(zone),
    date: new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: 'medium' }).format(date.value.toDate()),
    time: new Intl.DateTimeFormat(undefined, { timeZone: zone, timeStyle: 'medium' }).format(date.value.toDate()),
  }))
})
</script>

<template>
  <NcTooltip v-if="relative" color="light" placement="top" :arrow="false" overlay-class-name="nc-relative-time-card">
    <template #title>
      <div class="flex flex-col gap-1.5 min-w-64" data-testid="nc-relative-time-card">
        <div class="text-captionBold text-nc-content-gray-emphasis mb-0.5">{{ relative }}</div>
        <div v-for="row in rows" :key="row.key" class="flex items-baseline justify-between gap-6">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-captionSm text-nc-content-gray-subtle whitespace-nowrap">{{ row.label }}</span>
            <span v-if="row.offset" class="text-captionSm text-nc-content-gray-muted flex-none">{{ row.offset }}</span>
          </div>
          <div class="flex items-baseline gap-2 flex-none text-captionSm tabular-nums">
            <span class="text-nc-content-gray-subtle">{{ row.date }}</span>
            <span class="text-nc-content-gray-emphasis">{{ row.time }}</span>
          </div>
        </div>
      </div>
    </template>
    <!-- Default trigger is the relative time; a slot can show any other form of the same moment. -->
    <time :datetime="date.toISOString()" class="nc-relative-time inline-flex flex-col gap-0.5 min-w-0 tabular-nums">
      <slot>{{ relative }}</slot>
    </time>
  </NcTooltip>
</template>

<style lang="scss">
// The card holds a time zone name plus two date columns; the default tooltip width cuts the name.
.nc-relative-time-card.ant-tooltip {
  max-width: none;

  .ant-tooltip-inner {
    // NcTooltip's light theme sets these with !important.
    @apply !bg-nc-bg-default !rounded-xl !px-3.5 !py-2.5;
    box-shadow: 0 0 0 1px rgba(var(--rgb-base), 0.08), 0 8px 24px rgba(var(--rgb-base), 0.12);
  }
}
</style>
