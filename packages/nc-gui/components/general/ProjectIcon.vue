<script lang="ts" setup>
import tinycolor from 'tinycolor2'

const props = withDefaults(
  defineProps<{
    hoverable?: boolean
    color?: string
    // Custom base glyph (`base.meta.icon`) — an iconMap key. When set (and not a
    // managed app), render it instead of the default sphere so a base's chosen
    // icon shows everywhere, not just on the workspace landing cards.
    icon?: string
    managedApp?: {
      managed_app_master?: boolean
      managed_app_id?: string
    }
  }>(),
  {
    color: baseIconColors[0],
    icon: undefined,
    managedApp: () => ({}),
  },
)
const { color, icon, managedApp } = toRefs(props)

const managedAppInfo = computed(() => {
  return {
    isManagedApp: isEeUI && !!managedApp.value?.managed_app_id,
    isMaster: !!managedApp.value?.managed_app_master && !!managedApp.value?.managed_app_id,
  }
})

// A valid custom base icon takes precedence over the default sphere (managed
// apps keep their own iconography).
const customBaseIcon = computed(() => (managedAppInfo.value.isManagedApp ? undefined : resolveIconMapKey(icon.value)))

const { isDark } = useTheme()

// Tinted identity tile for the custom icon — same treatment as the
// workspace-landing card (`WorkspaceBaseListModalBaseNode`) so the base's icon
// looks the same everywhere, not a bare glyph.
const iconTileTint = computed(() =>
  getIconTileTint(color.value && tinycolor(color.value).isValid() ? color.value : baseIconColors[0], isDark.value),
)

const iconColor = computed(() => {
  return color.value && tinycolor(color.value).isValid()
    ? {
        tint: baseIconColors.includes(color.value) ? color.value : tinycolor(color.value).lighten(10).toHexString(),
        shade: tinycolor(color.value)
          .darken(managedAppInfo.value.isManagedApp ? 30 : 40)
          .toHexString(),
      }
    : {
        tint: baseIconColors[0],
        shade: tinycolor(baseIconColors[0])
          .darken(managedAppInfo.value.isManagedApp ? 30 : 40)
          .toHexString(),
      }
})

// Unique gradient ID based on app ID and color to avoid SVG gradient conflicts
const gradientId = computed(() => {
  const colorHash = color.value?.replace('#', '') || 'default'
  return `sphere-${managedApp.value?.managed_app_id || 'default'}-${colorHash}`
})
</script>

<template>
  <!-- Custom base icon (base.meta.icon) on a tinted tile -->
  <div
    v-if="customBaseIcon"
    class="w-5 h-5 nc-base-icon nc-base-custom-icon flex-none flex items-center justify-center rounded-md"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
    :style="{ backgroundColor: iconTileTint.bg }"
  >
    <GeneralIcon :icon="customBaseIcon" class="w-3/4 h-3/4" :style="{ color: iconTileTint.glyph }" />
  </div>
  <svg
    v-else-if="!managedAppInfo.isManagedApp"
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    class="text-[#2824FB] nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  >
    <path
      d="M20.9561 16.9326C20.9445 17.1394 20.7656 17.3451 20.4189 17.5029L13.2764 20.7549C12.5592 21.0813 11.3968 21.0813 10.6797 20.7549L3.53711 17.5029C3.19045 17.3451 3.01152 17.1394 3 16.9326H3.00293V10.9326H21.0029V16.9326H20.9561Z"
      :fill="iconColor.shade"
    />
    <path
      d="M21 12C20.9882 12.2033 20.8082 12.4054 20.4609 12.5605L13.3018 15.7588C12.5829 16.0799 11.4172 16.0799 10.6982 15.7588L3.53906 12.5605C3.19181 12.4054 3.01181 12.2033 3 12H21ZM10.6982 3.23926C11.4171 2.91975 12.5829 2.91975 13.3018 3.23926L20.4609 6.4209C20.8201 6.58052 20.9997 6.78982 21 6.99902H21.0068V11.999H3.00684V7.06055C2.9683 6.83124 3.14454 6.59625 3.53906 6.4209L10.6982 3.23926Z"
      :fill="iconColor.tint"
    />
  </svg>
  <!-- Master managed app - keep original icon -->
  <GeneralIcon
    v-else-if="managedAppInfo.isMaster"
    icon="ncBox"
    class="h-4.5 w-4.5 nc-base-icon text-nc-content-gray-subtle2"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  />
  <!-- 3D Sphere icon for installed managed apps -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    class="nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  >
    <defs>
      <!-- Radial gradient for 3D sphere effect - light from top-left -->
      <radialGradient :id="gradientId" cx="30%" cy="30%" r="70%" fx="25%" fy="25%">
        <stop offset="0%" :stop-color="iconColor.tint" />
        <stop offset="100%" :stop-color="iconColor.shade" />
      </radialGradient>
    </defs>
    <!-- Main sphere -->
    <circle cx="10" cy="10" r="8" :fill="`url(#${gradientId})`" />
  </svg>
</template>

<style scoped>
.nc-base-icon {
  @apply flex-none text-xl;
}
.nc-base-icon-hoverable {
  @apply cursor-pointer !hover:bg-nc-bg-gray-medium !hover:bg-opacity-50;
}
</style>
