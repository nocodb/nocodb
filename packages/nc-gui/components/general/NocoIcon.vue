<script lang="ts" setup>
interface Props {
  size?: number
  animate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 90,
  animate: false,
})

const { size, animate } = toRefs(props)

const { isDark } = useTheme()

const { isWhiteLabelled, productName, logoUrl, logoDarkUrl, faviconUrl } = useBranding()

// Prefer the favicon (typically square — close to the icon shape we replace);
// fall back to the dark/light logo when a favicon isn't configured.
const brandIcon = computed(() => {
  if (!isWhiteLabelled.value) return null
  return faviconUrl.value || (isDark.value ? logoDarkUrl.value || logoUrl.value : logoUrl.value)
})

const ping = autoResetRef(false, 1000)

const onClick = useThrottleFn(() => {
  ping.value = true
}, 1000)
</script>

<template>
  <div
    :style="{ left: `calc(50% - ${size / 2}px)`, top: `-${size / 2}px` }"
    class="color-transition absolute rounded-lg pt-1 pl-1 -ml-1"
    @click="onClick"
  >
    <div class="relative">
      <img v-if="brandIcon" :width="size" :height="size" :alt="productName" :src="brandIcon" class="object-contain" />
      <template v-else>
        <img
          v-if="isDark"
          class="hidden dark:block"
          :width="size"
          :height="size"
          alt="NocoDB"
          src="~/assets/img/icons/256x256-trans.png"
        />
        <img v-else :width="size" :height="size" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
      </template>

      <TransitionGroup name="layout" :duration="500">
        <template v-if="!brandIcon && (animate || ping)">
          <div
            :class="ping ? 'bg-primary bg-opacity-100' : 'animated-bg-gradient'"
            :style="{
              bottom: `${6.25 / (90 / size)}px`,
              right: `${6.25 / (90 / size)}px`,
              width: `${1.1 / (90 / size)}rem`,
              height: `${1.1 / (90 / size)}rem`,
            }"
            class="rounded-full z-0 absolute transform scale-102"
          />
          <div
            :style="{
              bottom: `${0.225 / (90 / size)}rem`,
              right: `${0.25 / (90 / size)}rem`,
              width: `${1.375 / (90 / size)}rem`,
              height: `${1.375 / (90 / size)}rem`,
            }"
            class="animate-ping bg-primary bg-opacity-50 rounded-full z-0 absolute"
          />
        </template>
      </TransitionGroup>
    </div>
  </div>
</template>
