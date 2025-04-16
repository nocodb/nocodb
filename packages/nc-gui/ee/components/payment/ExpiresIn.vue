<script lang="ts" setup>
import dayjs from 'dayjs'

const props = defineProps<{
  endTime: string
}>()

const endTime = dayjs(props.endTime)

const timeLeft = ref({
  days: '00',
  hours: '00',
  minutes: '00',
  seconds: '00',
})

let interval: number

const updateTime = () => {
  const now = dayjs()
  const diff = endTime.diff(now)

  if (diff <= 0) {
    timeLeft.value = { days: '00', hours: '00', minutes: '00', seconds: '00' }
    clearInterval(interval)
    return
  }

  const seconds = Math.floor((diff / 1000) % 60)
  const minutes = Math.floor((diff / 1000 / 60) % 60)
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  timeLeft.value = {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  }
}

onMounted(() => {
  updateTime()
  interval = setInterval(updateTime, 1000) as any
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="bg-nc-fill-purple-medium text-white text-sm font-semibold rounded-md py-0.5 px-3 w-[fit-content]">
    Expires in
    <span class="font-bold">{{ timeLeft.days }}d</span> : <span class="font-bold">{{ timeLeft.hours }}h</span> :
    <span class="font-bold">{{ timeLeft.minutes }}m</span> :
    <span class="font-bold">{{ timeLeft.seconds }}s</span>
  </div>
</template>
