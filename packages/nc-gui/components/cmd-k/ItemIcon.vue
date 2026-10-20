<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import type { CmdIcon } from '~/lib/types'

const props = defineProps<{
  icon: CmdIcon
}>()

const { isDark } = useTheme()

const iconComponent = computed(() => {
  if (props.icon.type !== 'icon') return
  return (iconMap as Record<string, unknown>)[props.icon.name]
})

// Option colours are pale chip fills; a 10px dot needs the same hue at full strength.
const dotColor = computed(() => {
  if (props.icon.type !== 'color') return
  if (!props.icon.color) return 'var(--nc-content-gray-muted)'
  const { h, s } = tinycolor(props.icon.color).toHsl()
  // Greys stay grey; anything with a hue is pushed to a solid, theme-readable tone.
  return tinycolor({ h, s: s < 0.08 ? s : Math.max(s, 0.65), l: isDark.value ? 0.66 : 0.52 }).toHexString()
})
</script>

<template>
  <GeneralWorkspaceIcon
    v-if="icon.type === 'workspace'"
    :workspace="{ id: icon.id, title: icon.title, meta: { color: icon.color, icon: icon.icon, iconType: icon.iconType } }"
    size="small"
  />
  <!-- Base and table icons carry their own margins; a fixed box keeps them on the icon column. -->
  <div v-else-if="icon.type === 'base'" class="nc-cmdk-icon-box">
    <GeneralBaseIconColorPicker
      :key="`${icon.color}-${icon.managedAppId}-${icon.managedAppMaster}`"
      :model-value="icon.color"
      type="database"
      :managed-app="{ managed_app_master: icon.managedAppMaster, managed_app_id: icon.managedAppId }"
      readonly
      class="!w-4 !m-0"
    />
  </div>
  <div v-else-if="icon.type === 'table'" class="nc-cmdk-icon-box">
    <GeneralTableIcon size="xsmall" :meta="{ meta: { icon: icon.icon ?? '' }, synced: icon.synced }" class="!h-4 !w-4 !m-0" />
  </div>
  <GeneralViewIcon
    v-else-if="icon.type === 'view'"
    :meta="{ type: icon.viewType, meta: { icon: icon.icon } }"
    class="!w-4 !h-4"
  />
  <!-- Same ink as action icons; field icons otherwise come out lighter and links pink. -->
  <div v-else-if="icon.type === 'field'" class="nc-cmdk-icon-box nc-cmdk-field-icon">
    <SmartsheetHeaderIcon :column="icon.column" color="text-current" />
  </div>
  <div v-else-if="icon.type === 'color'" class="nc-cmdk-icon-box">
    <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: dotColor }" />
  </div>
  <component
    :is="iconComponent"
    v-else-if="iconComponent"
    class="h-4 w-4 flex-none"
    :class="icon.type === 'icon' ? icon.class : ''"
  />
  <div v-else-if="icon.type === 'icon' || icon.type === 'emoji'" class="max-w-4 flex items-center justify-center">
    <!-- The picker reads `emoji` once; the key remounts it when a reused row's emoji changes. -->
    <LazyGeneralEmojiPicker
      :key="icon.type === 'emoji' ? icon.emoji : icon.name"
      :emoji="icon.type === 'emoji' ? icon.emoji : icon.name"
      class="!text-sm !h-4 !w-4"
      readonly
      size="small"
    />
  </div>
</template>
