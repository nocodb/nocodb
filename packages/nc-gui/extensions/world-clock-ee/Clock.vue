<script setup lang="ts">
import { themes } from './theming'
import type { ClockDisplaySettings } from './types'
import { calculateTimeDifference, formatTime, getDateForTimezone } from './utils'
const props = defineProps<ClockDisplaySettings & { editMode: boolean }>()

const hourHand = ref<SVGPathElement>() as Ref<SVGPathElement>
const minuteHand = ref<SVGPathElement>() as Ref<SVGPathElement>
const secondHand = ref<SVGPathElement>() as Ref<SVGPathElement>
const numbersGroup = ref<SVGGElement>() as Ref<SVGGElement>

const theme = computed(() => themes[props.theme])

const date = ref<Date>(new Date())
const timeString = computed(() => formatTime(date.value, props.format))
const timeDifference = computed(() => calculateTimeDifference(props.timezone))

const updateClock = () => {
  nextTick(() => {
    const now = getDateForTimezone(props.timezone)
    const milliseconds = now.getMilliseconds()
    const seconds = now.getSeconds() + milliseconds / 1000
    const minutes = now.getMinutes() + seconds / 60
    const hours = (now.getHours() % 12) + minutes / 60

    date.value = now

    const secondAngle = seconds * 6 // 6 degrees per second
    const minuteAngle = minutes * 6 // 6 degrees per minute
    const hourAngle = hours * 30 // 30 degrees per hour

    secondHand.value.setAttribute('transform', `rotate(${secondAngle}, 180, 180)`)
    minuteHand.value.setAttribute('transform', `rotate(${minuteAngle}, 180, 180)`)
    hourHand.value.setAttribute('transform', `rotate(${hourAngle}, 180, 180)`)
    requestAnimationFrame(updateClock) // animate again
  })
}

onMounted(() => {
  requestAnimationFrame(updateClock)
  watch(
    () => props.showNumbers,
    (showNumbers) => {
      numbersGroup.value.style.display = showNumbers ? 'block' : 'none'
    },
    { immediate: true },
  )
})
</script>

<template>
  <div class="flex flex-col w-full h-full items-center space-y-4 min-w-45 max-w-90">
    <svg
      v-show="mode === 'Analog' || mode === 'Both'"
      :class="`${editMode ? 'w-60 h-60' : 'w-32 h-32'}`"
      viewBox="0 0 360 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clip-path="url(#clip0_1438_36481)">
        <rect width="360" height="360" rx="180" :fill="theme.code" />
        <path d="M180 0V24" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M92 24.6077L104 45.3923" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M25.96 88.6864L46.7446 100.686" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M0.000366211 180L24.0004 180" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M24.646 271.334L45.4306 259.334" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M90.7248 335.375L102.725 314.59" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M180 360L180 336" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M270.373 336.688L258.373 315.904" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M335.414 268.61L314.629 256.61" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M360 180L336 180" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M335.727 87.9617L314.942 99.9617" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />
        <path d="M269.648 23.9213L257.648 44.7059" :stroke="theme.textCode" stroke-width="3" stroke-linecap="round" />

        <g ref="numbersGroup">
          <text x="180" y="50" text-anchor="middle" :fill="theme.textCode" font-size="24" font-family="Arial">12</text>
          <text x="320" y="190" text-anchor="middle" :fill="theme.textCode" font-size="24" font-family="Arial">3</text>
          <text x="180" y="325" text-anchor="middle" :fill="theme.textCode" font-size="24" font-family="Arial">6</text>
          <text x="40" y="190" text-anchor="middle" :fill="theme.textCode" font-size="24" font-family="Arial">9</text>
        </g>

        <path ref="secondHand" d="M180 180L180 60" stroke="#FF6E65" stroke-width="3" stroke-linecap="round" />
        <path ref="minuteHand" d="M180 180L180 80" :stroke="theme.textCode" stroke-width="5" stroke-linecap="round" />
        <path ref="hourHand" d="M180 180L180 100" :stroke="theme.textCode" stroke-width="8" stroke-linecap="round" />
      </g>
      <rect x="1.5" y="1.5" width="357" height="357" rx="178.5" :stroke="theme.borderCode" stroke-width="3" />
      <defs>
        <clipPath id="clip0_1438_36481">
          <rect width="360" height="360" rx="180" fill="white" />
        </clipPath>
      </defs>
    </svg>
    <div
      v-if="mode === 'Digital'"
      class="w-full border-1 rounded-2xl p-4 font-bold text-center"
      :class="{ 'text-6xl': editMode, 'text-4xl': !editMode }"
      :style="{ background: theme.code, borderColor: theme.borderCode, color: theme.textCode }"
    >
      {{ timeString }}
    </div>
    <div class="w-full flex flex-col space-y-1">
      <span v-if="mode === 'Both'" class="text-center font-bold text-xl">{{ timeString }}</span>
      <span class="text-center text-xs">Today, {{ Number(timeDifference) >= 0 ? '+' : '' }}{{ timeDifference }} HRS</span>
    </div>
  </div>
</template>
