<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import { ActiveViewInj, inject } from '#imports'

const selectedView = inject(ActiveViewInj)

const { activeTable } = storeToRefs(useTablesStore())
</script>

<template>
  <div class="flex flex-row font-medium ml-1.5 items-center border-gray-50">
    <MdiTable class="w-5 !text-gray-500 mb-0.25" :class="{}" />
    <div class="pl-1 text-gray-400">{{ activeTable?.title }}</div>
    <div class="px-2 text-gray-500">/</div>
    <component :is="viewIcons[ViewTypes.GRID].icon" class="flex text-gray-700 mb-0.25" />
    <div
      class="pl-1.5 text-gray-700"
      :style="{
        fontSize: '0.9rem',
      }"
    >
      {{ selectedView?.title }}
    </div>
  </div>
</template>
