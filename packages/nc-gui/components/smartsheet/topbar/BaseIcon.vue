<script setup lang="ts">
// The open base's icon wearing its environment dot. Always draws the base the
// user is in — `SmartsheetTopbarBaseEnvDot` reads the same store, so an icon for
// some other base would carry the wrong dot.

withDefaults(
  defineProps<{
    // Breadcrumb heads mute the icon; where the base is the subject rather than a
    // crumb — the app topbar, the sidebar — it keeps its colour.
    grayscale?: boolean
    iconClass?: string
  }>(),
  { grayscale: false, iconClass: '' },
)

const { base } = storeToRefs(useBase())
</script>

<template>
  <!-- The dot is positioned against this wrapper, so the two only ever ship together. -->
  <span class="relative inline-flex flex-none">
    <GeneralProjectIcon
      :color="parseProp(base?.meta).iconColor"
      :icon="parseProp(base?.meta).icon"
      :managed-app="{
        managed_app_master: base?.managed_app_master,
        managed_app_id: base?.managed_app_id,
      }"
      :class="[iconClass, { '!grayscale': grayscale }]"
    />
    <SmartsheetTopbarBaseEnvDot />
  </span>
</template>
