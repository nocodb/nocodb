<script lang="ts" setup>
import type { SeatType } from 'nocodb-sdk'

const props = defineProps<{
  seatType: SeatType
}>()

const { t } = useI18n()

const badge = computed(() => {
  if (props.seatType === 'full') return { color: 'green', label: t('payment.appSeat.seatEditor') }
  if (props.seatType === 'app') return { color: 'blue', label: t('payment.appSeat.seatGuest') }

  return { color: 'gray', label: t('payment.appSeat.seatFree') }
})
</script>

<template>
  <NcBadge
    :border="false"
    :color="badge.color"
    class="flex-none flex items-center gap-1 text-[10px] leading-[14px] !h-[18px] font-semibold"
    :class="{
      'text-nc-content-green-dark dark:!bg-nc-bg-green-light': seatType === 'full',
      'text-nc-content-blue-dark': seatType === 'app',
      'text-nc-content-gray-subtle': seatType === 'free',
    }"
    :data-testid="`nc-seat-type-${seatType}`"
  >
    <GeneralIcon v-if="seatType === 'full'" icon="ncCrown" class="flex-none mb-0.5" />
    {{ badge.label }}
  </NcBadge>
</template>
