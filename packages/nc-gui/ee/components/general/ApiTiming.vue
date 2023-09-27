<script lang="ts" setup>
import { computed, useApiTiming } from '#imports'
import NcServer from '~icons/nc-icons/server'
import NcCpu from '~icons/nc-icons/cpu'
import NcDatabase from '~icons/nc-icons/database1'

const { timing } = useApiTiming()

const timingThresholds = {
  network: {
    level1: 500,
    level2: 1000,
  },
  cpu: {
    level1: 500,
    level2: 1000,
  },
  db: {
    level1: 500,
    level2: 1000,
  },
}

const getLevel = (type: keyof typeof timingThresholds) => {
  if (timing.value[type] > timingThresholds[type].level2) {
    return 'level2'
  } else if (timing.value[type] > timingThresholds[type].level1) {
    return 'level1'
  } else {
    return ''
  }
}

const items = computed(() =>
  [
    {
      tootltip: 'Total time taken by API: ',
      icon: NcServer,
      key: 'network',
    },
    {
      tootltip: 'Time taken to pre-and-post process query: ',
      icon: NcCpu,
      key: 'cpu',
    },
    {
      tootltip: 'Time taken by query in DB: ',
      icon: NcDatabase,
      key: 'db',
    },
  ].filter((item) => timing.value[item.key] > timingThresholds[item.key].level1),
)

const tranformTime = (time: number) => {
  return `${(time / 1000).toFixed(1).replace('.0', '')}s`
}
</script>

<template>
  <div v-if="timing && items.length" class="wrapper">
    <NcTooltip v-for="item of items" :key="item.key" class="nc-tooltip" placement="topRight">
      <div class="item" :class="getLevel(item.key)">
        <component :is="item.icon" />
      </div>
      <template #title>
        <div class="tooltip-content-wrapper">
          <div class="item">
            <component :is="item.icon" class="text-white" />
            {{ item.tootltip }}{{ tranformTime(timing[item.key]) }}
          </div>
        </div>
      </template>
    </NcTooltip>
  </div>
  <span v-else></span>
</template>

<style scoped lang="scss">
.wrapper {
  @apply flex border-gray-200 border-1 rounded-md overflow-hidden h-8 items-stretch;

  :deep(.nc-tooltip) {
    @apply flex items-stretch;

    &:not(:last-child) {
      @apply !border-r-1 border-gray-200;
    }
  }

  .item {
    @apply px-2 py-1 flex gap-1 text-xs text-gray-500 items-center justify-center;

    &.level2 {
      @apply bg-red-500/10 text-red-500;
    }

    &.level1 {
      @apply bg-orange-500/10 text-orange-500;
    }
  }
}

.tooltip-content-wrapper {
  @apply flex flex-col gap-2 m-1 text-white;
  .item {
    @apply flex gap-2;
  }
}
</style>
