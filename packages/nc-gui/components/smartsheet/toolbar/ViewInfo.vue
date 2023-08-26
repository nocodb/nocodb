<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import { ActiveViewInj, inject } from '#imports'

const selectedView = inject(ActiveViewInj)

const { activeTable } = storeToRefs(useTablesStore())
</script>

<template>
  <div
    class="flex flex-row font-medium items-center border-gray-50 mt-0.5"
    :class="{
      'min-w-2/5 max-w-2/5': selectedView?.type !== ViewTypes.KANBAN,
      'min-w-1/4 max-w-1/4': selectedView?.type === ViewTypes.KANBAN,
    }"
  >
    <div v-if="activeTable?.meta?.icon" class="text-lg mr-0.5">
      {{ activeTable?.meta?.icon }}
    </div>
    <MdiTable v-else class="min-w-5 !text-gray-500" :class="{}" />
    <span class="truncate overflow-hidden pl-1 text-gray-500 max-w-28/100">
      {{ activeTable?.title }}
    </span>

    <div class="px-2 text-gray-500">/</div>
    <div v-if="selectedView?.meta?.icon" class="text-lg mr-0.5">
      {{ selectedView?.meta?.icon }}
    </div>
    <GeneralViewIcon v-else :meta="{ type: selectedView?.type }" class="min-w-5 flex" />

    <span class="truncate pl-1.25 text-gray-700 max-w-28/100">
      {{ selectedView?.title }}
    </span>
    <LazySmartsheetToolbarReload />
  </div>
</template>
