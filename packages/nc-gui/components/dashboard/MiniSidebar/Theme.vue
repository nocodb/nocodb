<script setup lang="ts">
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
  <NcTooltip v-if="isThemeEnabled" placement="right" :arrow="false">
    <template #title>
      <div class="capitalize">Appearance (beta): {{ selectedTheme }}</div>
    </template>
    <div v-e="['c:nocodb:theme']" class="nc-mini-sidebar-btn-full-width" data-testid="nc-sidebar-theme">
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
