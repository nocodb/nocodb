<script lang="ts" setup>

const activeCalendarMode = ref<'day' | 'week' | 'month' | 'year'>('week' as const);

const setActiveCalendarMode = (mode: 'day' | 'week' | 'month' | 'year') => {
  activeCalendarMode.value = mode;
};

</script>

<template>
  <div class="flex flex-row p-1 mx-3 mt-3 mb-3 bg-gray-100 rounded-lg gap-x-0.5 nc-calendar-mode-tab">
    <div
        :class="{ active: activeCalendarMode === 'day' }"
        class="tab"
        @click="setActiveCalendarMode('day')"
    >
      <div class="tab-title nc-tab">{{ $t('objects.day') }}</div>
    </div>
    <div
        :class="{ active: activeCalendarMode === 'week' }"
        class="tab"
        @click="setActiveCalendarMode('week')"
    >
      <div class="tab-title nc-tab">{{ $t('objects.week') }}</div>
    </div>
    <div
        :class="{ active: activeCalendarMode === 'month' }"
        class="tab"
        @click="setActiveCalendarMode('month')"
    >
      <div class="tab-title nc-tab">{{ $t('objects.month') }}</div>
    </div>
    <div
        :class="{ active: activeCalendarMode === 'year' }"
        class="tab"
        @click="setActiveCalendarMode('year')"
    >
      <div class="tab-title nc-tab">{{ $t('objects.year') }}</div>
    </div>
  </div>

</template>

<style lang="scss" scoped>

.tab {
  @apply flex flex-row items-center h-7.5 w-20 justify-center px-2 py-1 bg-gray-100 rounded-lg gap-x-1.5 text-gray-500 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab .tab-title {
  @apply min-w-0;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
  line-height: 0.95;
}

.active {
  @apply bg-white shadow text-black;
}

.nc-calendar-mode-tab {
  @apply -ml-120;
}

</style>