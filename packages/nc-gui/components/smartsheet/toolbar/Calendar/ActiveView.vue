<script lang="ts" setup>
const { activeCalendarView } = useCalendarViewStoreOrThrow()
</script>

<template>
  <span class="opacity-0" data-testid="nc-active-calendar-view">
    {{ activeCalendarView }}
  </span>
</template>

<style lang="scss" scoped></style>
