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
  <template v-if="isThemeEnabled">
    <!-- Standalone mode (renderAsBtn) — has its own tooltip -->
    <NcTooltip v-if="renderAsBtn" :placement="placement" :arrow="false">
      <template #title>
        <div class="capitalize">Appearance (beta): {{ selectedTheme }}</div>
      </template>
      <div
        v-e="['c:nocodb:theme']"
        class="nc-mini-sidebar-btn-full-width nc-render-as-btn"
        :class="[buttonClass]"
        data-testid="nc-sidebar-theme"
        @click="toggleTheme"
      >
        <div class="nc-mini-sidebar-btn">
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

    <!-- Mini sidebar mode — parent DashboardMiniSidebarItem handles tooltip -->
    <div v-else v-e="['c:nocodb:theme']" class="h-4.5 flex items-center justify-center" data-testid="nc-sidebar-theme" @click="toggleTheme">
      <GeneralIcon
        :icon="themeIcon"
        :class="{
          'h-5 w-5': themeIcon === 'ncSunMoon',
          'h-4 w-4': themeIcon !== 'ncSunMoon',
        }"
      />
    </div>
  </template>
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
