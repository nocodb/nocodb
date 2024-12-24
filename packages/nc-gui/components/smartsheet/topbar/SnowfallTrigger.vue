<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import dayjs from 'dayjs'

const config = useRuntimeConfig()

const isSnowFallEnabled = useStorage(
  EasterEggs.SNOWFLAKE_ENABLED,
  dayjs().isBetween(dayjs(`${dayjs().year()}-12-20`), dayjs(`${dayjs().year()}-12-28`)),
)

const shouldShowToggleMenu = computed(() => {
  return isSnowFallEnabled.value || dayjs().isBetween(dayjs(`${dayjs().year()}-12-20`), dayjs(`${dayjs().year()}-12-31`))
})

const toggleSnowFall = () => {
  isSnowFallEnabled.value = !isSnowFallEnabled.value
}
</script>

<template>
  <NcButton
    v-if="!config.public.ci && shouldShowToggleMenu"
    v-e="['c:easter-egg-snowfall']"
    type="secondary"
    size="small"
    class="nc-topbar-snowfall-btn"
    :class="{ '!bg-brand-50 !hover:bg-brand-100/70 !text-brand-500': isSnowFallEnabled }"
    data-testid="nc-topbar-snowfall-btn"
    @click="toggleSnowFall"
  >
    <div class="flex items-center justify-center">
      <GeneralIcon
        icon="snow"
        class="w-4 h-4 !stroke-transparent"
        :class="{ 'border-l-1 border-transparent': isSnowFallEnabled }"
      />
    </div>
  </NcButton>
</template>

<style scoped lang="scss"></style>
