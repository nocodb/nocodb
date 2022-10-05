<script lang="ts" setup>
import { autoResetRef, useThrottleFn } from '#imports'

interface Props {
  width?: number
  height?: number
  animate?: boolean
}

const { width = 90, height = 90, animate = false } = defineProps<Props>()

const ping = autoResetRef(false, 1000)

const onClick = useThrottleFn(() => {
  ping.value = true
}, 1000)
</script>

<template>
  <div
    :style="{ left: `calc(50% - ${width / 2}px)`, top: `-${height / 2}px` }"
    class="color-transition absolute rounded-lg pt-1 pl-1 -ml-1"
    @click="onClick"
  >
    <div class="relative">
      <img class="hidden dark:block" :width="width" :height="height" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
      <img class="dark:hidden" :width="width" :height="height" alt="NocoDB" src="~/assets/img/icons/512x512.png" />

      <TransitionGroup name="layout" :duration="500">
        <template v-if="animate || ping">
          <div
            :class="ping ? 'bg-primary bg-opacity-100' : 'animated-bg-gradient'"
            class="rounded-full z-0 absolute bottom-[6.25px] right-[6.25px] h-4.25 w-4.25 transform scale-102"
          />
          <div class="animate-ping bg-primary bg-opacity-50 rounded-full z-0 absolute bottom-0.9 right-1 h-5.5 w-5.5" />
        </template>
      </TransitionGroup>
    </div>
  </div>
</template>
