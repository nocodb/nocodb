<script setup lang="ts">
const { isGrid, isForm, isGallery, isKanban, isMap, isCalendar } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isMobileMode } = storeToRefs(useConfigStore())
</script>

<template>
  <div v-if="(isForm || isGrid || isKanban || isGallery || isMap || isCalendar) && !isPublic && !isMobileMode">
    <LazyGeneralShareProject is-view-toolbar />
  </div>
</template>
