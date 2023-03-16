<script setup lang="ts">
import { ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ActiveViewInj, inject } from '#imports'

const selectedView = inject<Ref<ViewType>>(ActiveViewInj)
</script>

<template>
  <div class="flex gap-2 items-center ml-2 mr-2 pr-4 pb-1 py-0.5 border-r-1 border-gray-100">
    <GeneralViewIcon class="nc-view-icon" :meta="selectedView as ViewType" />

    <span class="!text-sm font-medium max-w-36 overflow-ellipsis overflow-hidden whitespace-nowrap">
      {{ selectedView?.title }}
    </span>
  </div>
</template>
