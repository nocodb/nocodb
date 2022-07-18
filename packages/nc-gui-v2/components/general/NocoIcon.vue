<script lang="ts" setup>
interface Props {
  width?: number
  height?: number
}

const { width = 90, height = 90 } = defineProps<Props>()
</script>

<template>
  <div :style="{ left: `calc(50% - ${width / 2}px)`, top: `-${height * 0.6}px` }" class="absolute rounded-lg bg-primary">
    <img :width="width" :height="height" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
  </div>
</template>
