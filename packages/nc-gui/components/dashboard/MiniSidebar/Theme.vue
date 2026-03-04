<script setup lang="ts">
import type { TooltipPlacement } from 'ant-design-vue/lib/tooltip'

interface Props {
  placement?: TooltipPlacement
  renderAsBtn?: boolean
  buttonClass?: string
}

withDefaults(defineProps<Props>(), {
  placement: 'right',
  buttonClass: 'h-7 w-7',
})

const { toggleTheme, isThemeEnabled, selectedTheme } = useTheme()

const themeIcon = computed(
  () =>
    ({
      light: 'ncSun',
      dark: 'ncMoon',
      system: 'ncSunMoon',
    }[selectedTheme.value] as IconMapKey),
)
</script>

<template>
  <NcTooltip v-if="isThemeEnabled" :placement="placement" :arrow="false">
    <template #title>
      <div class="capitalize">Appearance (beta): {{ selectedTheme }}</div>
    </template>
    <div
      v-e="['c:nocodb:theme']"
      class="nc-mini-sidebar-btn-full-width"
      :class="[
        buttonClass,
        {
          'nc-render-as-btn': renderAsBtn,
        },
      ]"
      data-testid="nc-sidebar-theme"
    >
      <div class="nc-mini-sidebar-btn relative" @click="toggleTheme">
        <GeneralIcon
          :icon="themeIcon"
          :class="{
            'h-5 w-5': themeIcon === 'ncSunMoon',
            'h-4 w-4': themeIcon !== 'ncSunMoon',
          }"
        />
      </div>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.nc-mini-sidebar-btn-full-width {
  &.nc-render-as-btn {
    @apply text-nc-content-gray-subtle rounded-lg flex-none flex justify-center items-center cursor-pointer hover:bg-nc-bg-gray-medium transition-all duration-200;

    .nc-mini-sidebar-btn {
      @apply !p-1.5 flex items-center justify-center children:flex-none text-nc-content-gray-muted;
    }
  }
}
</style>
