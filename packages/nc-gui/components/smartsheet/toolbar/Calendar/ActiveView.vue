<script lang="ts" setup>
const { activeCalendarView } = useCalendarViewStoreOrThrow()

const { isMobileMode } = useGlobal()
</script>

<template>
  <span v-if="!isMobileMode" class="opacity-0" data-testid="nc-active-calendar-view">
    {{ activeCalendarView }}
  </span>
</template>

<style lang="scss" scoped></style>
