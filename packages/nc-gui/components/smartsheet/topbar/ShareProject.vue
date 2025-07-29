<script setup lang="ts">
const isPublic = inject(IsPublicInj, ref(false))

const { isMobileMode } = storeToRefs(useConfigStore())
</script>

<template>
  <div v-if="!isPublic && !isMobileMode" class="empty:hidden">
    <LazyGeneralShareProject is-view-toolbar />
  </div>
</template>
