<script lang="ts" setup>
interface Props {
  width?: number
  height?: number
  animate?: boolean
}

const { width = 90, height = 90, animate = false } = defineProps<Props>()
</script>

<template>
  <div :style="{ left: `calc(50% - ${width / 2}px)`, top: `-${height / 2}px` }" class="absolute rounded-lg pt-1 pl-1 -ml-1">
    <div class="relative">
      <img :width="width" :height="height" alt="NocoDB" src="~/assets/img/icons/512x512.png" />

      <template v-if="animate">
        <div class="animated-bg-gradient opacity-100 rounded-full z-0 absolute bottom-1.45 right-1.45 h-4.5 w-4.5" />
        <div class="animate-ping bg-primary bg-opacity-50 rounded-full z-0 absolute bottom-0.9 right-1 h-5.5 w-5.5" />
      </template>
    </div>
  </div>
</template>
