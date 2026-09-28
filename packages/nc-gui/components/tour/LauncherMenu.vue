<script setup lang="ts">
import { resolveTourText } from '~/tours'

const emits = defineEmits<{
  (e: 'closeMenu'): void
}>()

const { availableTours, start, isSeen, reset } = useTours()

async function runTour(tourId: string) {
  emits('closeMenu')

  await nextTick()

  if (isSeen(tourId)) await reset(tourId)

  await start(tourId, 'help-menu')
}
</script>

<template>
  <NcMenuItem v-for="tour of availableTours" :key="tour.id" :data-testid="`nc-tour-launch-${tour.id}`" @click="runTour(tour.id)">
    <GeneralIcon :icon="tour.kind === 'onboarding' ? 'ncCompass' : 'megaPhone'" class="menu-icon" />
    <div class="flex items-center justify-between flex-1 gap-2">
      <span class="menu-btn truncate">{{ resolveTourText(tour.title) }}</span>
      <span v-if="isSeen(tour.id)" class="text-nc-content-gray-muted text-captionSm flex-none">
        {{ $t('general.replay') }}
      </span>
    </div>
  </NcMenuItem>
</template>
